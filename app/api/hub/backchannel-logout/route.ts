import {NextResponse} from 'next/server';
import {jwtVerify} from 'jose';
import {hubDiscovery, hubJwks} from '@/lib/hub/oidc-config';
import {createAdminClient} from '@/lib/supabase/admin';

// HUB GỌI VÀO ĐÂY KHI MỘT NGƯỜI ĐĂNG XUẤT BÊN HUB (mục 5.3 bản đấu nối, OIDC Back-Channel
// Logout) — thân request là form-urlencoded, MỘT trường `logout_token` (JWT do Hub ký).
//
// GIỚI HẠN THẬT, ghi rõ để không ai tưởng đây là huỷ phiên tức khắc: xem lib/hub/revocation.ts.
export const dynamic = 'force-dynamic';

const BACKCHANNEL_LOGOUT_EVENT = 'http://schemas.openid.net/event/backchannel-logout';

export async function POST(request: Request) {
  const appId = process.env.HUB_APP_ID;
  if (!appId) {
    console.error('[hub] backchannel-logout: thiếu HUB_APP_ID');
    return NextResponse.json({error: 'hub_not_configured'}, {status: 500});
  }

  const form = await request.formData().catch(() => null);
  const logoutToken = form?.get('logout_token');
  if (typeof logoutToken !== 'string' || !logoutToken) {
    return NextResponse.json({error: 'invalid_request'}, {status: 400});
  }

  const discovery = await hubDiscovery().catch(() => null);
  if (!discovery) return NextResponse.json({error: 'hub_unreachable'}, {status: 503});

  let claims: Record<string, unknown>;
  try {
    const jwks = await hubJwks();
    const {payload} = await jwtVerify(logoutToken, jwks, {
      issuer: discovery.issuer,
      audience: appId,
    });
    claims = payload;
  } catch (e) {
    // KHÔNG kiểm chữ ký = ai cũng đăng xuất được người khác (mục 5.2.6 bản đấu nối) — từ chối
    // thẳng, không cố "đoán" ý một token không xác minh được.
    console.error('[hub] logout_token verify', e instanceof Error ? e.message : e);
    return NextResponse.json({error: 'invalid_token'}, {status: 400});
  }

  const events = claims.events as Record<string, unknown> | undefined;
  const sub = typeof claims.sub === 'string' ? claims.sub : null;
  if (!events?.[BACKCHANNEL_LOGOUT_EVENT] || !sub) {
    return NextResponse.json({error: 'invalid_token'}, {status: 400});
  }
  // Chuẩn OIDC cấm logout_token mang `nonce` — không kiểm thêm gì khác ở đây theo yêu cầu chuẩn.

  const admin = createAdminClient();
  const {data: linked} = await admin
    .from('hub_identities')
    .select('profile_id')
    .eq('issuer', discovery.issuer)
    .eq('sub', sub)
    .maybeSingle();

  // Không có ánh xạ nào — người này chưa từng đăng nhập app qua Hub, hoặc đã đăng xuất trước đó.
  // Đây KHÔNG phải lỗi: Hub gọi backchannel-logout cho MỌI mini-app đã đăng ký, dù mini-app đó
  // người này có dùng hay không.
  if (linked) {
    const {error} = await admin
      .from('hub_revoked_sessions')
      .insert({profile_id: linked.profile_id, reason: 'hub_backchannel_logout'});
    if (error) console.error('[hub] backchannel-logout insert', error.message);
  }

  return new NextResponse(null, {status: 200});
}

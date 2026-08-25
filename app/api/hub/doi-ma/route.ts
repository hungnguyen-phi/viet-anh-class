import {NextResponse} from 'next/server';
import {jwtVerify} from 'jose';
import {hubDiscovery, hubJwks} from '@/lib/hub/oidc-config';
import {findOrLinkProfile} from '@/lib/hub/identity';
import {mintCallbackUrl} from '@/lib/hub/session-bridge';
import {SITE_URL} from '@/lib/site';

// ĐỔI MÃ (authorization_code) LẤY DANH TÍNH — chạy ở MÁY CHỦ vì bước này cần HUB_CLIENT_SECRET
// (mục 6.3 bản đấu nối: chuỗi bí mật KHÔNG BAO GIỜ được đặt vào mã chạy trong trình duyệt).
//
// Route này CHỈ phục vụ đường NHÚNG (mục 3.2): trình duyệt tự sinh PKCE, bắt tay `embed:ready` với
// Hub qua postMessage, nhận `code` qua `embed:token`, rồi POST {code, verifier} tới đây. App KHÔNG
// dựng thêm một luồng SSO độc lập (đăng nhập Hub khi mở app KHÔNG qua khung) ở đợt này — mọi lượt
// vào app này đều qua Hub, nên chỉ một đường là đủ; `redirectUris` trong phiếu đăng ký (mục 10) chỉ
// giữ chỗ cho khả năng đó, chưa có mã chạy thật đằng sau.
//
// route này nằm NGOÀI matcher của middleware.ts (loại trừ /api/**) — không có gì tự kiểm Origin
// hay chặn CSRF giúp, phải tự làm ở đây.
export const dynamic = 'force-dynamic';

type Body = {code?: unknown; verifier?: unknown};

export async function POST(request: Request) {
  // CHỈ NHẬN TỪ CHÍNH TRANG CỦA APP NÀY. Route bị gọi bằng fetch() từ trang của chính app (dù
  // trang đó đang nằm trong khung của Hub) — Origin của một fetch cùng-trang luôn là origin của
  // app, KHÔNG phải origin của Hub. Một request Origin khác nghĩa là ai đó đang gọi thẳng vào route
  // này từ nơi khác (không phải luồng bình thường) — từ chối sớm, trước khi tốn một vòng gọi Hub.
  const origin = request.headers.get('origin');
  if (origin && origin !== SITE_URL) {
    return NextResponse.json({error: 'bad_origin'}, {status: 403});
  }

  let body: Body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({error: 'bad_request'}, {status: 400});
  }
  const code = typeof body.code === 'string' ? body.code : null;
  const verifier = typeof body.verifier === 'string' ? body.verifier : null;
  if (!code || !verifier) {
    return NextResponse.json({error: 'bad_request'}, {status: 400});
  }

  const appId = process.env.HUB_APP_ID;
  const secret = process.env.HUB_CLIENT_SECRET;
  const hubOrigin = process.env.NEXT_PUBLIC_HUB_ORIGIN;
  if (!appId || !secret || !hubOrigin) {
    console.error('[hub] doi-ma: thiếu HUB_APP_ID/HUB_CLIENT_SECRET/NEXT_PUBLIC_HUB_ORIGIN');
    return NextResponse.json({error: 'hub_not_configured'}, {status: 500});
  }

  const discovery = await hubDiscovery().catch((e) => {
    console.error('[hub] discovery', e instanceof Error ? e.message : e);
    return null;
  });
  if (!discovery) return NextResponse.json({error: 'hub_unreachable'}, {status: 503});

  // ĐÂY LÀ CHỖ HAY SAI NHẤT (mục 6.3 bản đấu nối): khi chạy TRONG KHUNG, redirect_uri phải là
  // trang cầu nối CỦA HUB (`${hubOrigin}/embed/relay`), KHÔNG PHẢI một địa chỉ của app này — sai
  // chỗ này Hub trả invalid_grant mà câu lỗi không hề nhắc tới redirect_uri.
  let tokenRes: Response;
  try {
    tokenRes = await fetch(discovery.token_endpoint, {
      method: 'POST',
      headers: {
        authorization: 'Basic ' + Buffer.from(`${appId}:${secret}`).toString('base64'),
        'content-type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        code_verifier: verifier,
        redirect_uri: `${hubOrigin}/embed/relay`,
      }),
      signal: AbortSignal.timeout(10_000),
      cache: 'no-store',
    });
  } catch (e) {
    console.error('[hub] token exchange', e instanceof Error ? e.message : e);
    return NextResponse.json({error: 'hub_unreachable'}, {status: 503});
  }
  if (!tokenRes.ok) {
    const detail = await tokenRes.text().catch(() => '');
    console.error('[hub] token exchange', tokenRes.status, detail.slice(0, 300));
    return NextResponse.json({error: 'exchange_failed'}, {status: 502});
  }

  const tokenJson = (await tokenRes.json().catch(() => null)) as {id_token?: string} | null;
  if (!tokenJson?.id_token) {
    return NextResponse.json({error: 'exchange_failed'}, {status: 502});
  }

  let claims: Record<string, unknown>;
  try {
    const jwks = await hubJwks();
    const {payload} = await jwtVerify(tokenJson.id_token, jwks, {
      issuer: discovery.issuer,
      audience: appId,
    });
    claims = payload;
  } catch (e) {
    console.error('[hub] id_token verify', e instanceof Error ? e.message : e);
    return NextResponse.json({error: 'bad_id_token'}, {status: 502});
  }

  const sub = typeof claims.sub === 'string' ? claims.sub : null;
  const email = typeof claims.email === 'string' ? claims.email : null;
  if (!sub || !email) {
    // KHÔNG ÂM THẦM BỎ QUA (quyết định của chủ dự án): id_token thiếu email là lỗi cấu hình
    // Hub, không phải chuyện app tự vá bằng cách đoán danh tính — báo to ngay lúc test lớp Test,
    // đừng để nó trôi tới lúc dùng thật rồi mới lộ ra bằng một người bị gán nhầm hồ sơ.
    console.error('[hub] id_token thiếu sub/email — kiểm lại scope "email" phía Hub');
    return NextResponse.json({error: 'id_token_missing_email'}, {status: 502});
  }

  const profile = await findOrLinkProfile(discovery.issuer, sub, email).catch((e) => {
    console.error('[hub] findOrLinkProfile', e instanceof Error ? e.message : e);
    return undefined;
  });
  if (profile === undefined) return NextResponse.json({error: 'server_error'}, {status: 500});
  if (!profile) return NextResponse.json({error: 'no_matching_account'}, {status: 404});

  const locale = new URL(request.url).searchParams.get('locale') === 'en' ? 'en' : 'vi';
  const redirectTo = await mintCallbackUrl(profile, locale).catch((e) => {
    console.error('[hub] mintCallbackUrl', e instanceof Error ? e.message : e);
    return null;
  });
  if (!redirectTo) return NextResponse.json({error: 'server_error'}, {status: 500});

  return NextResponse.json({redirectTo});
}

import 'server-only';
import {createRemoteJWKSet} from 'jose';
import {nho} from '@/lib/dem-ram';

// BẢN KHAI (discovery) CỦA HUB — đọc một lần, nhớ lại cho cả tiến trình.
//
// KHÔNG dùng thư viện OIDC đầy đủ (openid-client…): thư viện đó tự quản lý toàn bộ vòng
// redirect (state/nonce/PKCE) trong MỘT object phiên do chính nó tạo, mà PKCE ở đây lại do
// TRÌNH DUYỆT sinh (đúng như bản đấu nối yêu cầu — verifier không bao giờ rời máy người dùng cho
// tới lúc đổi mã). Ép nó vào khuôn của thư viện phức tạp hơn là tự làm bằng fetch trần + jose để
// verify chữ ký — đúng cách bản đấu nối của Hub tự làm mẫu (mục 6.2/6.3), và đúng phong cách gọi
// HTTP trần đã dùng khắp dự án.
export type HubDiscovery = {
  issuer: string;
  authorization_endpoint: string;
  token_endpoint: string;
  jwks_uri: string;
};

function issuerUrl(): string {
  const v = process.env.HUB_ISSUER_URL;
  if (!v) throw new Error('Thiếu HUB_ISSUER_URL trong môi trường server.');
  return v.replace(/\/$/, '');
}

// 10 phút: đủ để không gọi lại mỗi request, đủ ngắn để một lần Hub xoay endpoint (hiếm khi xảy
// ra) không kẹt cả tiến trình lâu hơn một lượt khởi động lại container.
export async function hubDiscovery(): Promise<HubDiscovery> {
  return nho('hub:discovery', 600_000, async () => {
    const url = `${issuerUrl()}/.well-known/openid-configuration`;
    const res = await fetch(url, {cache: 'no-store', signal: AbortSignal.timeout(10_000)});
    if (!res.ok) throw new Error(`hub discovery ${res.status}`);
    const doc = (await res.json()) as Partial<HubDiscovery>;
    if (!doc.token_endpoint || !doc.jwks_uri || !doc.issuer) {
      throw new Error('hub discovery: thiếu token_endpoint/jwks_uri/issuer');
    }
    return doc as HubDiscovery;
  });
}

// createRemoteJWKSet TỰ CÓ bộ nhớ đệm + giới hạn tốc độ tải lại bên trong (jose) — chỉ cần dựng
// ĐÚNG MỘT LẦN cho cả tiến trình, giống cách giuKetNoiSupabase() dựng Agent một lần (lib/giu-ket-noi.ts).
let jwks: ReturnType<typeof createRemoteJWKSet> | null = null;
let jwksUri: string | null = null;

export async function hubJwks() {
  const {jwks_uri} = await hubDiscovery();
  if (!jwks || jwksUri !== jwks_uri) {
    jwks = createRemoteJWKSet(new URL(jwks_uri));
    jwksUri = jwks_uri;
  }
  return jwks;
}

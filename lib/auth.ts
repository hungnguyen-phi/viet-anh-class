import {cache} from 'react';
import {redirect} from 'next/navigation';
import {createClient} from '@/lib/supabase/server';
import {nho} from '@/lib/dem-ram';
import {isRevoked} from '@/lib/hub/revocation';
import type {Database} from '@/lib/database.types';

export type Role = Database['public']['Enums']['user_role'];
export type Profile = Database['public']['Tables']['profiles']['Row'];

// Trang mặc định theo vai trò (định tuyến sau đăng nhập — §6.2.1).
export function homeRouteForRole(role: Role): string {
  switch (role) {
    case 'admin':
      return '/admin';
    case 'principal':
      return '/campus';
    case 'parent':
      return '/report';
    case 'student':
      return '/student'; // scoreboard CÁ NHÂN (PRD §6.2.1) — không vào scoreboard lớp
    case 'teacher':
    default:
      return '/';
  }
}

// cache() theo request: layout + page cùng gọi requireProfile nhưng chỉ tốn
// 1 lượt xác thực + 1 lượt profiles cho mỗi request (trước đây nhân đôi).
//
// getClaims() thay cho getUser(): khi project bật asymmetric JWT keys, JWT được
// verify CỤC BỘ bằng WebCrypto — KHÔNG gọi mạng tới Auth server mỗi lần chuyển
// trang. Vẫn an toàn phiên vì getClaims gọi getSession() bên trong, tự refresh
// token khi gần/hết hạn. Với key đối xứng cũ (HS256), getClaims tự fallback sang
// getUser() nên hành vi không đổi (không hồi quy khi chưa bật toggle).
// AI ĐANG ĐĂNG NHẬP — KHÔNG TỐN VÒNG MẠNG NÀO.
//
// getClaims() verify JWT cục bộ bằng khoá ES256 (WebCrypto); khoá công khai tải đúng một lần cho
// cả tiến trình rồi cache 10 phút. Đo trên 1026 lượt gọi: 1 lượt tải khoá, 0 lượt /auth/v1/user.
//
// Tách riêng khỏi getCurrentProfile vì nhiều chỗ chỉ cần BIẾT MÌNH LÀ AI để bắn truy vấn, chứ
// không cần hàng `profiles` — mà chờ hàng ấy về là tự bắt mình xếp thêm một tầng mạng (xem vỏ
// trang ở (dashboard)/layout.tsx). Bọc cache() theo request nên gọi bao nhiêu lần cũng chỉ verify
// một lần.
export const getUserId = cache(async (): Promise<string | null> => {
  const supabase = await createClient();
  const {data} = await supabase.auth.getClaims();
  return data?.claims?.sub ?? null;
});

// HÀNG `profiles` NHỚ 60 GIÂY TRONG RAM (lib/dem-ram.ts, 16/08/2026): đây là vòng đi-về đứng đầu
// MỌI trang, mà vai trò của một người thì đổi vài lần một năm. Đổi vai/xoá người ở màn quản trị
// gọi quen('profile:') nên không ai bị kẹt vai cũ 60 giây. Khoá theo userId — không lẫn người.
export const getCurrentProfile = cache(async (): Promise<Profile | null> => {
  const supabase = await createClient();
  const {data} = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (!userId) return null;
  // ĐĂNG XUẤT NGƯỢC TỪ HUB (lib/hub/revocation.ts): kiểm TRƯỚC khi đọc đệm 60 giây, không sau —
  // nếu không, một người vừa bị thu hồi vẫn đọc trúng bản `profiles` cũ còn nằm trong đệm.
  // Coi như chưa đăng nhập: requireProfile() bên dưới tự đẩy về /login, đúng luồng bình thường.
  if (isRevoked(userId)) return null;
  return nho(`profile:${userId}`, 60_000, async () => {
    const {data: profile} = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle();
    return profile ?? null;
  });
});

// Dùng trong layout/page server: bắt buộc đã đăng nhập + đã được cấp quyền.
export async function requireProfile(): Promise<Profile> {
  const profile = await getCurrentProfile();
  if (!profile) redirect('/login');
  if (profile.role === 'pending') redirect('/unauthorized');
  return profile;
}

// BAN GIÁM HIỆU XEM, KHÔNG GHI (audit 04/09/2026): /wig và màn của em mở cho principal để họ thấy
// mục tiêu lớp/trường và bảng điểm trong cơ sở mình (ROLE_MATRIX), nhưng mọi nút ghi phải ẩn —
// luật thật vẫn ở RLS, cờ này chỉ để trang khỏi mời bấm một nút chắc chắn bị từ chối.
export function laChiDoc(profile: Profile): boolean {
  return profile.role === 'principal';
}

export async function requireRole(roles: Role[]): Promise<Profile> {
  const profile = await requireProfile();
  if (!roles.includes(profile.role)) redirect(homeRouteForRole(profile.role));
  return profile;
}

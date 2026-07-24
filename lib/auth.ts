import {cache} from 'react';
import {redirect} from 'next/navigation';
import {createClient} from '@/lib/supabase/server';
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
export const getCurrentProfile = cache(async (): Promise<Profile | null> => {
  const supabase = await createClient();
  const {data} = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (!userId) return null;
  const {data: profile} = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .maybeSingle();
  return profile ?? null;
});

// Dùng trong layout/page server: bắt buộc đã đăng nhập + đã được cấp quyền.
export async function requireProfile(): Promise<Profile> {
  const profile = await getCurrentProfile();
  if (!profile) redirect('/login');
  if (profile.role === 'pending') redirect('/unauthorized');
  return profile;
}

export async function requireRole(roles: Role[]): Promise<Profile> {
  const profile = await requireProfile();
  if (!roles.includes(profile.role)) redirect(homeRouteForRole(profile.role));
  return profile;
}

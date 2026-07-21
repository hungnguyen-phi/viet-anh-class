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
// 1 lượt getUser + 1 lượt profiles cho mỗi request (trước đây nhân đôi).
export const getCurrentProfile = cache(async (): Promise<Profile | null> => {
  const supabase = await createClient();
  const {
    data: {user},
  } = await supabase.auth.getUser();
  if (!user) return null;
  const {data} = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .maybeSingle();
  return data ?? null;
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

import type {SupabaseClient} from '@supabase/supabase-js';
import type {Database} from '@/lib/database.types';
import type {Profile} from '@/lib/auth';

type SB = SupabaseClient<Database>;
export type ClassRow = Database['public']['Tables']['classes']['Row'];

// Lớp "của tôi":
//  - Bất kỳ ai là GVCN của lớp → lớp đó.
//  - Học sinh → lớp đang học.
//  - Admin/BGH (xem/quản trị) → lớp đầu tiên trong phạm vi (để preview scoreboard/điểm danh).
export async function getMyClass(
  supabase: SB,
  profile: Profile,
  preferredClassId?: string,
): Promise<ClassRow | null> {
  // 0) Lớp được chọn rõ ràng (admin/BGH duyệt lớp; RLS đảm bảo có quyền truy cập)
  if (preferredClassId) {
    const {data} = await supabase
      .from('classes')
      .select('*')
      .eq('id', preferredClassId)
      .maybeSingle();
    if (data) return data;
  }

  // 1) Lớp mình chủ nhiệm (đúng cho cả admin nếu được gán GVCN) — bỏ qua lớp đã lưu-trữ.
  const {data: owned} = await supabase
    .from('classes')
    .select('*')
    .eq('homeroom_teacher_id', profile.id)
    .eq('is_active', true)
    .limit(1)
    .maybeSingle();
  if (owned) return owned;

  // 2) Học sinh → lớp đang học
  if (profile.role === 'student') {
    const {data: enr} = await supabase
      .from('enrollments')
      .select('class_id')
      .eq('student_id', profile.id)
      .eq('is_active', true)
      .limit(1)
      .maybeSingle();
    if (!enr) return null;
    const {data: cls} = await supabase
      .from('classes')
      .select('*')
      .eq('id', enr.class_id)
      .maybeSingle();
    return cls ?? null;
  }

  // 3) Admin/BGH → lớp đầu tiên truy cập được (RLS tự giới hạn phạm vi) — bỏ qua lớp đã lưu-trữ.
  if (profile.role === 'admin' || profile.role === 'principal') {
    const {data} = await supabase
      .from('classes')
      .select('*')
      .eq('is_active', true)
      .order('name')
      .limit(1)
      .maybeSingle();
    return data ?? null;
  }

  return null;
}

export type ClassOption = {id: string; name: string; school_year: string};

// Danh sách lớp người dùng được phép duyệt (admin: tất cả · BGH: campus · GVCN: lớp mình).
export async function getAccessibleClasses(
  supabase: SB,
  profile: Profile,
): Promise<ClassOption[]> {
  if (profile.role === 'admin' || profile.role === 'principal') {
    const {data} = await supabase
      .from('classes')
      .select('id, name, school_year')
      .eq('is_active', true)
      .order('name');
    return data ?? [];
  }
  if (profile.role === 'teacher') {
    const {data} = await supabase
      .from('classes')
      .select('id, name, school_year')
      .eq('homeroom_teacher_id', profile.id)
      .eq('is_active', true)
      .order('name');
    return data ?? [];
  }
  return [];
}

import type {SupabaseClient} from '@supabase/supabase-js';
import type {Database} from '@/lib/database.types';
import type {Profile} from '@/lib/auth';

type SB = SupabaseClient<Database>;
export type ClassRow = Database['public']['Tables']['classes']['Row'];

// Lớp "của tôi":
//  - Bất kỳ ai là GVCN của lớp → lớp đó.
//  - Học sinh → lớp đang học.
//  - Phụ huynh → lớp của con (con đang chọn, hoặc con đầu nếu có nhiều con).
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
  //
  // CHỈ hỏi với vai CÓ THỂ là chủ nhiệm. Trước đây câu này chạy cho MỌI vai, kể cả học sinh và
  // phụ huynh — mà học sinh thì không bao giờ chủ nhiệm lớp nào. Đo được trong log:
  // `classes?homeroom_teacher_id=eq.<id học sinh>` trên mọi lượt mở trang của các em.
  // Một vòng mạng vô ích, nhân với khoảng nửa số người dùng, nhân với mỗi lần chuyển trang.
  if (profile.role === 'teacher' || profile.role === 'admin') {
    const {data: owned} = await supabase
      .from('classes')
      .select('*')
      .eq('homeroom_teacher_id', profile.id)
      .eq('is_active', true)
      // SẮP THEO TÊN rồi mới limit(1). Không có order thì Postgres trả lớp NÀO TUỲ Ý — cô chủ
      // nhiệm hai lớp (ở đây: 7B1 và 7B2) sẽ thấy khi thì lớp này khi thì lớp kia giữa hai lần
      // tải trang, mà không hiểu vì sao. Lỗi có sẵn, bộ kiểm nội dung vừa bắt được: trang Báo bài
      // lúc hiện form, lúc hiện "lớp chưa khai môn nào".
      .order('name')
      .limit(1)
      .maybeSingle();
    if (owned) return owned;
  }

  // 2) Học sinh → lớp đang học.
  // Nhúng luôn `classes(*)` vào câu enrollments thay vì hỏi hai lượt nối tiếp. Khuôn này đã có
  // sẵn trong repo (components/student/StudentScoreboard.tsx) — chỉ là getMyClass chưa dùng.
  if (profile.role === 'student') {
    const {data: enr} = await supabase
      .from('enrollments')
      .select('classes(*)')
      .eq('student_id', profile.id)
      .eq('is_active', true)
      // Cùng lý do như nhánh trên: em chuyển lớp giữa năm có thể còn nhiều dòng ghi danh đang bật;
      // không order thì lớp hiện ra đổi ngẫu nhiên giữa các lần tải.
      .order('class_id')
      .limit(1)
      .maybeSingle();
    return ((enr as unknown as {classes: ClassRow | null} | null)?.classes) ?? null;
  }

  // 2b) Phụ huynh → lớp của con.
  //
  // Trước đây rơi thẳng xuống `return null`, nên phụ huynh mở /timetable là thấy "Chưa có lớp" —
  // dù RLS của timetable_slots ĐÃ cho họ đọc (is_parent_of_class). Nghĩa là dữ liệu vẫn đúng
  // quyền, chỉ là không có đường nào tìm ra lớp để hỏi. Ban giám hiệu xin "bổ sung thêm TKB cho
  // PH dễ theo dõi" — chính là lỗ này.
  //
  // Nhiều con thì lấy con đầu theo tên; trang gọi hàm này truyền preferredClassId khi phụ huynh
  // đổi con (nhánh 0 ở trên đã xử lý, và RLS chặn nếu đó không phải lớp của con họ).
  // MỘT truy vấn, không phải ba. Trước đây: parent_links → chờ → enrollments → chờ → classes.
  // Bỏ được parent_links vì RLS của enrollments đã tự giới hạn phụ huynh chỉ thấy ghi danh của
  // CON MÌNH (chính sách enr_parent_read) — hỏi parent_links trước chỉ là lặp lại điều RLS đã
  // làm, bằng một vòng mạng nữa. Và nhúng classes(*) luôn để bỏ nốt lượt thứ ba.
  if (profile.role === 'parent') {
    const {data: enr} = await supabase
      .from('enrollments')
      .select('classes(*)')
      .eq('is_active', true)
      // Phụ huynh nhiều con thì có nhiều dòng; không order thì "con mặc định" đổi ngẫu nhiên giữa
      // các lần tải trang. Trang gọi hàm này truyền ?class= khi họ chủ động đổi con.
      .order('student_id')
      .limit(1)
      .maybeSingle();
    return ((enr as unknown as {classes: ClassRow | null} | null)?.classes) ?? null;
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

export type ClassOption = {
  id: string;
  name: string;
  school_year: string;
  grade_name: string;
  grade_sort: number;
};

// Chuẩn hoá 1 dòng `classes` có kèm khối nhúng thành ClassOption.
// Lớp chưa gán khối rơi vào nhóm '—' và bị đẩy xuống cuối (sort 9999) thay vì trộn lẫn.
type RawClass = {
  id: string;
  name: string;
  school_year: string;
  grade: string | null;
  grades: {name: string; sort_order: number} | null;
};
function toOption(c: RawClass): ClassOption {
  return {
    id: c.id,
    name: c.name,
    school_year: c.school_year,
    grade_name: c.grades?.name ?? c.grade ?? '—',
    grade_sort: c.grades?.sort_order ?? 9999,
  };
}
function sortByGradeThenName(a: ClassOption, b: ClassOption): number {
  return a.grade_sort - b.grade_sort || a.name.localeCompare(b.name, 'vi');
}

// Danh sách lớp người dùng được phép duyệt (admin: tất cả · BGH: campus · GVCN: lớp mình).
// Kèm KHỐI để bộ chọn lớp gom nhóm được — BGH có vài chục lớp thì danh sách phẳng là không
// dùng nổi, phải thấy khối trước rồi mới tới lớp.
const CLASS_SELECT = 'id, name, school_year, grade, grades(name, sort_order)';

export async function getAccessibleClasses(
  supabase: SB,
  profile: Profile,
): Promise<ClassOption[]> {
  if (profile.role === 'admin' || profile.role === 'principal') {
    const {data} = await supabase
      .from('classes')
      .select(CLASS_SELECT)
      .eq('is_active', true)
      .order('name');
    return ((data ?? []) as unknown as RawClass[]).map(toOption).sort(sortByGradeThenName);
  }
  if (profile.role === 'teacher') {
    const {data} = await supabase
      .from('classes')
      .select(CLASS_SELECT)
      .eq('homeroom_teacher_id', profile.id)
      .eq('is_active', true)
      .order('name');
    return ((data ?? []) as unknown as RawClass[]).map(toOption).sort(sortByGradeThenName);
  }
  return [];
}

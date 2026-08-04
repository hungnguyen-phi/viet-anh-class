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

// ════════════════════════════════════════════════════════════════════════════
// MỘT CÂU `classes` THAY VÌ HAI.
//
// 11 trang gọi getMyClass() và getAccessibleClasses() cạnh nhau trong cùng một Promise.all. Hai
// hàm ấy hỏi CÙNG MỘT BẢNG, CÙNG MỘT BỘ LỌC (`is_active`, và với giáo viên là `homeroom_teacher_id
// = tôi`) — chỉ khác ở chỗ một cái `.limit(1)`. Nghĩa là mỗi lần mở trang, app gửi hai lượt hỏi
// classes gần như y hệt nhau tới Supabase.
//
// Chạy song song nên không dài thêm chuỗi chờ, nhưng vẫn là một gói tin nữa trên đường truyền
// VPS↔Supabase — mà đường này mất khoảng 5% gói: gói nào rụng thì phải chờ TCP truyền lại, và
// trang đứng im chừng ấy. Ít câu hỏi thì ít cơ hội rụng hơn.
//
// Hai hàm cũ VẪN GIỮ: /menu và TodayMenuCard chỉ cần lớp, /inbox chỉ cần danh sách.
export type ClassContext = {
  myClass: ClassRow | null;
  /** Danh sách cho bộ chọn lớp — rỗng với học sinh/phụ huynh (họ chỉ có đúng lớp mình). */
  classes: ClassOption[];
};

type ClassRowWithGrade = ClassRow & {grades: {name: string; sort_order: number} | null};

export async function getClassContext(
  supabase: SB,
  profile: Profile,
  preferredClassId?: string,
): Promise<ClassContext> {
  const laNhanSu =
    profile.role === 'teacher' || profile.role === 'admin' || profile.role === 'principal';

  // Học sinh/phụ huynh không có bộ chọn lớp (getAccessibleClasses trả [] mà không hỏi gì), nên
  // ở đây cũng đúng một câu — dùng lại nguyên nhánh của getMyClass.
  if (!laNhanSu) {
    return {myClass: await getMyClass(supabase, profile, preferredClassId), classes: []};
  }

  // `*` chứ không phải CLASS_SELECT: myClass được các trang dùng như một dòng `classes` đầy đủ
  // (campus_id, cover_image_url, tick_lock_dow...). Bảng có 11 cột, thêm vài cột rẻ hơn nhiều so
  // với thêm một vòng mạng.
  let q = supabase.from('classes').select('*, grades(name, sort_order)').eq('is_active', true);
  if (profile.role === 'teacher') q = q.eq('homeroom_teacher_id', profile.id);
  const {data} = await q.order('name');
  const rows = (data ?? []) as unknown as ClassRowWithGrade[];

  const classes = rows.map((r) => toOption(r as unknown as RawClass)).sort(sortByGradeThenName);

  let myClass: ClassRow | null = null;
  if (preferredClassId) {
    myClass = rows.find((r) => r.id === preferredClassId) ?? null;
    // Lớp NGOÀI danh sách vẫn có thể mở được: giáo viên bộ môn mở lớp mình dạy (không chủ nhiệm),
    // hoặc phụ huynh đổi con. Chỉ khi ấy mới tốn câu thứ hai, và RLS vẫn là thứ quyết được/không.
    if (!myClass) {
      const {data: one} = await supabase
        .from('classes')
        .select('*')
        .eq('id', preferredClassId)
        .maybeSingle();
      if (one) myClass = one;
    }
  }
  if (!myClass) {
    // ── CHỌN HỘ THÌ PHẢI CHỌN ĐÚNG ────────────────────────────────────────────────────────
    //
    // Bản cũ lấy `rows[0]` — dòng đầu tiên theo THỨ TỰ CHỮ CÁI của tên lớp. Nghe thì tất định,
    // nhưng đo trên production thì nó chọn sai một cách khá ngoạn mục: một cô chủ nhiệm ba lớp
    // (10A2, 6A1, 7A2) mở app lên là rơi vào 10A2 — vì ký tự '1' đứng trước '6' — mà 10A2 có
    // ĐÚNG 0 học sinh, 0 WIG, 0 tiết. Cả tám mục menu của cô đều là view của một lớp trống, và
    // không màn hình nào nói ra là còn hai lớp khác. Đọc thành "app này chưa có dữ liệu gì".
    //
    // Trớ trêu hơn: chính hàm này dựng `classes` cho bộ chọn lớp bằng MỘT THỨ TỰ KHÁC
    // (sortByGradeThenName), và 10A2 chưa gán khối nên rơi xuống cuối. Tức là lớp app chọn hộ
    // lại đúng là lớp nằm cuối danh sách người ta nhìn thấy.
    //
    // Nay: ưu tiên lớp CHỦ NHIỆM, trong đó ưu tiên lớp CÓ HỌC SINH, và theo ĐÚNG thứ tự của bộ
    // chọn lớp. Ba vế, vế nào cũng có lý do người dùng nhìn thấy được.
    const uuTienChuNhiem = profile.role === 'teacher' || profile.role === 'admin';
    const chuNhiem = uuTienChuNhiem
      ? rows.filter((r) => r.homeroom_teacher_id === profile.id)
      : [];
    const ungVien = chuNhiem.length > 0 ? chuNhiem : rows;
    // Sắp theo đúng thứ tự bộ chọn lớp đang bày ra, để "lớp app mở sẵn" và "lớp đầu danh sách"
    // luôn là một. Hai thứ tự khác nhau là hai nguồn sự thật cho cùng một câu hỏi.
    const viTri = new Map(classes.map((c, i) => [c.id, i]));
    const theoBoChon = [...ungVien].sort(
      (a, b) => (viTri.get(a.id) ?? 1e9) - (viTri.get(b.id) ?? 1e9),
    );

    if (theoBoChon.length > 1) {
      // Câu thứ hai CHỈ chạy khi thật sự có gì để chọn. Người chủ nhiệm một lớp — phần lớn giáo
      // viên — không trả thêm lượt đi về nào. Đường VPS↔Supabase mất ~5% gói nên mỗi câu tiết
      // kiệm được là một cơ hội rụng gói tiết kiệm được.
      const {data: dsGhiDanh} = await supabase
        .from('enrollments')
        .select('class_id')
        .in(
          'class_id',
          theoBoChon.map((c) => c.id),
        )
        .eq('is_active', true);
      const coEm = new Set((dsGhiDanh ?? []).map((e) => e.class_id));
      myClass = theoBoChon.find((c) => coEm.has(c.id)) ?? theoBoChon[0] ?? null;
    } else {
      myClass = theoBoChon[0] ?? null;
    }
  }

  return {myClass, classes};
}

// ════════════════════════════════════════════════════════════════════════════
// CON CỦA MỘT PHỤ HUYNH — MỘT DANH SÁCH, MỘT THỨ TỰ.
// ════════════════════════════════════════════════════════════════════════════
//
// Bốn trang của phụ huynh đều phải trả lời "đang xem con nào", và trước đây mỗi trang tự trả lời
// theo một luật riêng: /report và /homework sắp theo TÊN, còn getMyClass() sắp theo student_id
// (tức là theo UUID — một thứ tự không có nghĩa gì với con người). Nên /timetable mở ra một đứa,
// ba trang kia mở ra đứa khác, và không màn hình nào nói ra là vừa đổi người. Bố mẹ đọc điểm
// danh của đứa này rồi tưởng là của đứa kia.
//
// Nay một hàm, một thứ tự: theo tên, có dấu tiếng Việt.
export type Con = {id: string; name: string; classId: string; className: string};

export async function getChildren(supabase: SB): Promise<Con[]> {
  // RLS pl_parent_self chỉ trả link của chính họ, nên không cần lọc thêm theo parent_id.
  const {data: links} = await supabase
    .from('parent_links')
    .select('student_id, profiles!parent_links_student_id_fkey(full_name)');
  const rows = (links ?? []) as unknown as {
    student_id: string;
    profiles: {full_name: string | null} | null;
  }[];
  if (rows.length === 0) return [];

  const tenTheoId = new Map(rows.map((l) => [l.student_id, l.profiles?.full_name ?? l.student_id]));
  const {data: enr} = await supabase
    .from('enrollments')
    .select('student_id, class_id, classes(name)')
    .in(
      'student_id',
      rows.map((l) => l.student_id),
    )
    .eq('is_active', true);
  const enrRows = (enr ?? []) as unknown as {
    student_id: string;
    class_id: string;
    classes: {name: string} | null;
  }[];

  return enrRows
    .map((e) => ({
      id: e.student_id,
      name: tenTheoId.get(e.student_id) ?? e.student_id,
      classId: e.class_id,
      className: e.classes?.name ?? '',
    }))
    .sort((a, b) => a.name.localeCompare(b.name, 'vi'));
}

/** Con đang xem: theo ?child= nếu hợp lệ, không thì đứa đầu danh sách (theo tên). */
export function conDangXem(children: Con[], childParam?: string): Con | null {
  return (childParam ? children.find((c) => c.id === childParam) : undefined) ?? children[0] ?? null;
}

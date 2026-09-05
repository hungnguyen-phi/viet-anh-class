import {getTranslations, setRequestLocale} from 'next-intl/server';
import {requireRole} from '@/lib/auth';
import {createClient} from '@/lib/supabase/server';
import {getClassContext} from '@/lib/queries';
import {ClassPicker} from '@/components/shell/ClassPicker';
import {Flash} from '@/components/ui/Flash';
import {SubjectCreateForm} from '@/components/subjects/SubjectCreateForm';
import {SubjectTable, type SubjectRow} from '@/components/subjects/SubjectTable';
import {
  TeachingAssignmentBlock,
  type GiaoVien,
  type MonCuaLop,
  type PhanCong,
} from '@/components/subjects/TeachingAssignmentBlock';

// ════════════════════════════════════════════════════════════════════════════
// /subjects — DANH MỤC MÔN + PHÂN CÔNG GIÁO VIÊN BỘ MÔN.
//
// VÌ SAO HAI VIỆC NÀY CHUNG MỘT TRANG:
//   • Cùng MỘT nhóm người làm: policy ghi của cả subjects lẫn teaching_assignments đều là
//     "quản trị viên, hoặc hiệu trưởng trong cơ sở mình". GVCN không nằm trong nhóm đó, nên
//     đặt khối phân công vào trang chi tiết lớp (nơi GVCN sống) sẽ là một khối mà chủ nhà của
//     trang không bao giờ bấm được — vẽ nút không bấm được là cách chắc chắn nhất để người dùng
//     tưởng hệ thống hỏng.
//   • Chúng nối nhau thành MỘT việc: khai môn → khai môn đó dạy lớp mấy → chọn ai dạy môn đó ở
//     lớp nào. Đứng ở đây bấm được cả ba bước, không phải nhảy trang giữa chừng.
//   • Nửa dưới đọc trực tiếp kết quả của nửa trên: môn vừa tắt ở bảng trên hiện ngay nhãn
//     "môn đã tắt" ở bảng dưới, nên hậu quả của thao tác nhìn thấy được ngay tại chỗ.
//
// TRANG NÀY KHÔNG CÓ TRONG THANH MENU (components/shell/AppNav.tsx bị khoá, không sửa) —
// vào bằng đường dẫn /subjects. Xem ghi chú bàn giao.
// ════════════════════════════════════════════════════════════════════════════

type TeacherRow = {id: string; full_name: string | null; email: string; campus_id: string | null};
type AssignRow = {
  id: string;
  subject_id: string;
  teacher_id: string;
  profiles: {full_name: string | null; email: string} | null;
};

export default async function SubjectsPage({
  params,
  searchParams,
}: {
  params: Promise<{locale: string}>;
  searchParams: Promise<{class?: string; edit?: string; flash?: string}>;
}) {
  const {locale} = await params;
  const {class: classParam, edit: editId} = await searchParams;
  setRequestLocale(locale);
  // Đúng hai vai có quyền GHI ở cả hai bảng (rls_admin_subjects + rls_principal_subjects,
  // rls_write_teaching_assignments). Giáo viên vào đây cũng chỉ thấy nút không bấm được.
  const profile = await requireRole(['admin', 'principal']);
  const isAdmin = profile.role === 'admin';
  const t = await getTranslations('subjects');
  const supabase = await createClient();

  // Năm truy vấn độc lập — chạy song song, tránh waterfall.
  const [{data: subjectsData}, {data: gradesData}, {data: campusesData}, lop, {data: gvData}] =
    await Promise.all([
      supabase
        .from('subjects')
        .select('id, campus_id, code, name, short_name, sort_order, is_scored, is_active')
        .order('sort_order')
        .order('name'),
      supabase.from('subject_grades').select('subject_id, grade_no'),
      supabase.from('campuses').select('id, name'),
      getClassContext(supabase, profile, classParam),
      // DANH SÁCH GIÁO VIÊN — kéo từ khối phân công bên dưới lên đây. Nó lọc theo vai, không theo
      // lớp, nên chẳng có lý do gì phải chờ biết lớp đang chọn rồi mới hỏi; và nó là câu chậm
      // nhất của đợt dưới (tới 500 dòng profiles).
      // Chỉ vai 'teacher': trigger teaching_assignment_guard từ chối mọi vai khác (hiệu trưởng
      // KHÔNG được phân công dạy — nguyên tắc "ban giám hiệu không chạm một con điểm nào").
      // Hiệu trưởng gọi câu này chỉ nhận về giáo viên cơ sở mình (RLS của profiles lo việc đó).
      supabase
        .from('profiles')
        .select('id, full_name, email, campus_id')
        .eq('role', 'teacher')
        .order('full_name')
        .limit(500),
    ]);
  const {myClass, classes: accessible} = lop;

  const tenCoSo = new Map((campusesData ?? []).map((c) => [c.id, c.name] as const));

  // Gom "môn này dạy lớp mấy" thành mảng số cho từng môn. Môn KHÔNG có dòng nào ở đây là môn
  // CHƯA KHAI — bảng sẽ hiện chip cảnh báo, không lặng lẽ để trống.
  const lopTheoMon = new Map<string, number[]>();
  for (const g of gradesData ?? []) {
    const arr = lopTheoMon.get(g.subject_id) ?? [];
    arr.push(g.grade_no);
    lopTheoMon.set(g.subject_id, arr);
  }

  const rows: SubjectRow[] = (subjectsData ?? [])
    // Hiệu trưởng ĐỌC được cả môn riêng của cơ sở khác (policy select của subjects mở cho mọi
    // người đăng nhập), nhưng chẳng làm gì được với chúng và cũng không lớp nào của họ dùng
    // được. Lọc đi cho danh sách đúng thứ họ quản: môn dùng chung + môn riêng của cơ sở mình.
    .filter((s) => isAdmin || s.campus_id === null || s.campus_id === profile.campus_id)
    .map((s) => ({
      id: s.id,
      code: s.code,
      name: s.name,
      short_name: s.short_name,
      campus_id: s.campus_id,
      campusName: s.campus_id ? (tenCoSo.get(s.campus_id) ?? null) : null,
      is_active: s.is_active,
      is_scored: s.is_scored,
      grades: (lopTheoMon.get(s.id) ?? []).sort((a, b) => a - b),
      // ĐÚNG hai policy ghi của bảng subjects, không rộng hơn một ly: quản trị viên đụng được
      // mọi dòng; hiệu trưởng chỉ đụng dòng có campus_id = cơ sở mình (môn dùng chung mà cho họ
      // sửa thì đổi tên "Ngữ văn" một lần là đổi cho cả bốn cơ sở).
      canEdit: isAdmin || (s.campus_id !== null && s.campus_id === profile.campus_id),
    }));

  // ── Dữ liệu cho khối phân công (phụ thuộc lớp đang chọn nên phải chờ myClass) ──
  let monHoc: MonCuaLop[] = [];
  let phanCong: PhanCong[] = [];
  let giaoVien: GiaoVien[] = [];

  if (myClass) {
    const [{data: csData}, {data: taData}] = await Promise.all([
      supabase.from('class_subjects').select('subject_id').eq('class_id', myClass.id),
      // Chỉ phân công CÒN HIỆU LỰC. Dòng is_active=false vẫn nằm trong bảng để tra lại ai từng
      // dạy, nhưng người đó đã mất quyền nên không được hiện như đang dạy.
      // profiles có HAI khoá ngoại trỏ tới (teacher_id, created_by) → phải gọi đích danh khoá,
      // nếu không PostgREST không biết nhúng theo đường nào.
      supabase
        .from('teaching_assignments')
        .select(
          'id, subject_id, teacher_id, profiles!teaching_assignments_teacher_id_fkey(full_name, email)',
        )
        .eq('class_id', myClass.id)
        .eq('is_active', true),
    ]);

    // Tên + thứ tự môn lấy từ chính danh mục vừa đọc, không truy vấn lại.
    const monTheoId = new Map((subjectsData ?? []).map((s) => [s.id, s] as const));
    monHoc = (csData ?? [])
      .map((cs) => monTheoId.get(cs.subject_id))
      .filter((s): s is NonNullable<typeof s> => !!s)
      .sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name, 'vi'))
      .map((s) => ({subjectId: s.id, name: s.name, isActive: s.is_active}));

    phanCong = ((taData ?? []) as unknown as AssignRow[]).map((r) => ({
      id: r.id,
      subjectId: r.subject_id,
      teacherId: r.teacher_id,
      // Không đọc được hồ sơ (giáo viên đã chuyển cơ sở khác) thì vẫn phải hiện dòng phân công —
      // giấu đi là giấu mất một người đang có quyền ghi điểm lớp này.
      teacherName: r.profiles?.full_name || r.profiles?.email || t('otherCampusTeacher'),
    }));

    giaoVien = ((gvData ?? []) as TeacherRow[]).map((g) => ({
      id: g.id,
      name: g.full_name || g.email,
      cungCoSo: g.campus_id === myClass.campus_id,
    }));
  }

  const picker =
    accessible.length > 1 ? <ClassPicker classes={accessible} current={myClass?.id} /> : null;

  const soChuaKhai = rows.filter((r) => r.grades.length === 0).length;
  const soTat = rows.filter((r) => !r.is_active).length;

  return (
    <div className="flex flex-col gap-5">
      <h1 className="font-display text-dau font-bold text-navy">{t('title')}</h1>

      <Flash />

      {/* ① DANH MỤC MÔN TOÀN TRƯỜNG — sắp lại 05/09 (chủ dự án: "nhìn rối quá"): tiêu đề khu đánh
          số + một dòng tóm tắt (bao nhiêu môn, mấy môn chưa khai lớp), form thêm môn THU VÀO nút
          "+ Thêm môn" (<details>, không cần JS) vì việc thêm môn cả năm làm vài lần, không đáng
          chiếm cả đầu trang. */}
      <section className="flex flex-col gap-3">
        <div className="flex flex-wrap items-end gap-2">
          <div className="mr-auto min-w-0">
            <p className="text-nhan font-extrabold uppercase tracking-wide text-gold-text">{t('sec1Eyebrow')}</p>
            <h2 className="font-display text-tieu-de font-bold text-navy">{t('sec1Title')}</h2>
            <p className="text-chu-thich font-semibold text-grey-mid">
              {t('sec1Summary', {n: rows.length})}
              {soChuaKhai > 0 ? ` · ${t('sec1ChuaKhai', {n: soChuaKhai})}` : ''}
              {soTat > 0 ? ` · ${t('sec1Tat', {n: soTat})}` : ''}
            </p>
          </div>
          {profile.role === 'principal' && !profile.campus_id ? (
            <p className="text-chu-thich italic text-grey-mid">{t('noCampus')}</p>
          ) : (
            // <details> chiếm trọn hàng: nút nằm phải, form bung ra trải hết bề rộng ngay dưới tiêu đề.
            <details className="w-full">
              <summary className="btn-gold ml-auto flex min-h-[44px] w-fit cursor-pointer list-none items-center gap-1.5 rounded-[12px] px-4 text-than font-extrabold [&::-webkit-details-marker]:hidden">
                {t('addSubject')}
              </summary>
              <div className="mt-3 animate-rise">
                <SubjectCreateForm
                  scope={isAdmin ? 'chung' : 'rieng'}
                  campusName={profile.campus_id ? (tenCoSo.get(profile.campus_id) ?? null) : null}
                />
              </div>
            </details>
          )}
        </div>

        <SubjectTable rows={rows} isAdmin={isAdmin} classParam={classParam} editingId={editId} />
      </section>

      <hr className="border-navy/10" />

      {myClass ? (
        <TeachingAssignmentBlock
          classId={myClass.id}
          tenLop={myClass.name}
          monHoc={monHoc}
          phanCong={phanCong}
          giaoVien={giaoVien}
          picker={picker}
        />
      ) : (
        <div className="glass rounded-[20px] p-8 text-center">
          <p className="text-sm text-txt">{t('noClassForAssign')}</p>
        </div>
      )}
    </div>
  );
}

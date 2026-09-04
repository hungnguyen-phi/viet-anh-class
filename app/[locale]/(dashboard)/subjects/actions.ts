'use server';

import {revalidatePath} from 'next/cache';
import {getTranslations} from 'next-intl/server';
import {redirect} from 'next/navigation';
import {createClient} from '@/lib/supabase/server';
import {requireRole} from '@/lib/auth';
import {friendlyError, loi, tachLoi} from '@/lib/errors';

// ════════════════════════════════════════════════════════════════════════════
// Danh mục môn + phân công giáo viên bộ môn (migration 0069).
//
// BA LỚP CHẶN XẾP CHỒNG, không lớp nào đứng một mình:
//   1. requireRole ở đây — chỉ để báo lỗi tử tế và chặn người lạc đường.
//   2. RLS trong DB (rls_admin_subjects / rls_principal_subjects /
//      rls_admin_subject_grades / rls_write_teaching_assignments) — thứ giữ an toàn THẬT.
//   3. Trigger subject_guard + teaching_assignment_guard — chặn trùng tên môn và chặn phân
//      công cho người không phải giáo viên, kèm câu tiếng Việt sẵn (P0001 → friendlyError giữ
//      nguyên câu đó, xem lib/errors.ts).
// Vì lớp 2 và 3 mới là lớp thật, mọi ghi ở đây đều `.select(...)` sau khi ghi: không có dòng
// trả về nghĩa là RLS chặn im lặng, và phải báo "không có quyền" chứ KHÔNG báo thành công giả.
// ════════════════════════════════════════════════════════════════════════════

// Mọi flash phải mang lại ?class=: khối phân công nằm chung trang này, mất tham số là người
// dùng bị ném về lớp đầu danh sách ngay sau khi bấm — đúng kiểu "bấm xong lạc mất chỗ đang làm".
function subjectsFlash(msg: string, classId?: string | null): never {
  const keo = classId ? `class=${encodeURIComponent(classId)}&` : '';
  const g = tachLoi(msg);
  redirect(`/subjects?${keo}${g.laLoi ? 'flash_err' : 'flash'}=${encodeURIComponent(g.msg)}`);
}

// ── THÊM MÔN ────────────────────────────────────────────────────────────────
// Dùng useActionState (không redirect) vì đây là form nhiều ô: lỗi trùng tên phải hiện NGAY
// cạnh ô mã/tên và giữ nguyên những gì đã gõ, không bắt gõ lại 4 ô.
export type SubjectFormValues = {
  code: string;
  name: string;
  short_name: string;
  sort_order: string;
  is_scored: boolean;
};

export type SubjectFormState = {
  ok: boolean;
  message?: string;
  error?: string;
  fieldError?: string;
  values?: SubjectFormValues;
};

// Y hệt ràng buộc subjects_code_check trong DB — kiểm ở đây chỉ để báo sớm bằng tiếng người,
// DB vẫn là nơi chốt.
const CODE_RE = /^[A-Z0-9_]{2,12}$/;

export async function createSubject(
  _prev: SubjectFormState,
  formData: FormData,
): Promise<SubjectFormState> {
  const tLoi = await getTranslations('common');
  const me = await requireRole(['admin', 'principal']);
  const t = await getTranslations('loiPhu');
  const s = (k: string) => String(formData.get(k) ?? '').trim();
  const code = s('code').toUpperCase();
  const name = s('name');
  const short_name = s('short_name');
  const sort_order = s('sort_order');
  // Checkbox không tick thì KHÔNG có trong FormData — vắng mặt = đánh giá bằng nhận xét.
  const is_scored = formData.get('is_scored') != null;
  const values: SubjectFormValues = {code, name, short_name, sort_order, is_scored};

  if (!code)
    return {ok: false, fieldError: 'code', error: t('sNhapMa'), values};
  if (!CODE_RE.test(code))
    return {
      ok: false,
      fieldError: 'code',
      error: t('sMaSai'),
      values,
    };
  if (!name) return {ok: false, fieldError: 'name', error: t('sNhapTen'), values};
  if (name.length > 80)
    return {ok: false, fieldError: 'name', error: t('sTenDai'), values};
  if (short_name.length > 16)
    return {
      ok: false,
      fieldError: 'short_name',
      error: t('sMaNganDai'),
      values,
    };

  const order = sort_order ? Number(sort_order) : 500;
  if (!Number.isInteger(order) || order < 0 || order > 32000)
    return {ok: false, fieldError: 'sort_order', error: t('sThuTu'), values};

  // AI TẠO ĐƯỢC MÔN GÌ — đọc thẳng từ hai policy của bảng subjects:
  //   • rls_admin_subjects: quản trị viên làm gì cũng được → tạo môn DÙNG CHUNG (campus_id NULL).
  //   • rls_principal_subjects: chỉ đụng dòng có `campus_id is not null and campus_id = auth_campus()`
  //     → hiệu trưởng CHỈ tạo được môn riêng của chính cơ sở mình.
  // Không có nhánh thứ ba, và cũng đừng cho hiệu trưởng chọn cơ sở: policy sẽ chặn im lặng.
  const campus_id = me.role === 'admin' ? null : me.campus_id;
  if (me.role === 'principal' && !campus_id)
    return {
      ok: false,
      error: t('sChuaCoCoSo'),
      values,
    };

  const supabase = await createClient();
  const {data, error} = await supabase
    .from('subjects')
    // short_name để trống thì trigger subject_guard tự lấy mã máy; vẫn gửi sẵn vì kiểu Insert
    // đòi cột này, và gửi đúng thứ trigger sẽ điền thì không ai phải đoán.
    .insert({
      campus_id,
      code,
      name,
      short_name: short_name || code,
      sort_order: order,
      is_scored,
      created_by: me.id,
    })
    .select('id, name');

  if (error) {
    // 23505 = đụng một trong bốn chỉ mục duy nhất của subjects. friendlyError trả câu chung
    // "dữ liệu bị trùng" — ở đây nói rõ trùng cái gì để người dùng biết sửa ô nào.
    if (error.code === '23505')
      return {
        ok: false,
        fieldError: 'code',
        error: t('sTrung', {ma: code, ten: name}),
        values,
      };
    // P0001 = trigger subject_guard: "Môn ... đã có trong danh mục dùng chung...". friendlyError
    // giữ nguyên câu tiếng Việt đó, đúng thứ người dùng cần đọc.
    return {ok: false, error: (friendlyError(error, tLoi)), values};
  }
  if (!data || data.length === 0)
    return {ok: false, error: t('sKhongTao'), values};

  revalidatePath('/[locale]/subjects', 'page');
  return {
    ok: true,
    message: campus_id
      ? t('sDaThemRieng', {ten: name})
      : t('sDaThemChung', {ten: name}),
  };
}

// ── TẮT / DÙNG LẠI MÔN ──────────────────────────────────────────────────────
// KHÔNG có action xoá, cố ý: mọi khoá ngoại trỏ vào subjects đều `on delete restrict`, và điểm
// cũ phải đọc được mãi (comment trên cột is_active của 0069). Tắt = môn biến khỏi mọi ô chọn,
// dữ liệu cũ nguyên vẹn.
export async function setSubjectActive(formData: FormData) {
  const tLoi = await getTranslations('common');
  await requireRole(['admin', 'principal']);
  const t = await getTranslations('loiPhu');
  const subjectId = String(formData.get('subject_id') ?? '');
  const active = String(formData.get('active') ?? '') === 'true';
  const classId = String(formData.get('class_id') ?? '') || null;
  if (!subjectId) subjectsFlash(t('sThieuMon'), classId);

  const supabase = await createClient();
  const {data, error} = await supabase
    .from('subjects')
    .update({is_active: active})
    .eq('id', subjectId)
    .select('name');
  revalidatePath('/[locale]/subjects', 'page');
  if (error) subjectsFlash(loi(friendlyError(error, tLoi)), classId);
  if (!data || data.length === 0)
    subjectsFlash(
      t('sKhongDoiChung'),
      classId,
    );
  subjectsFlash(
    active
      ? t('sDungLai', {ten: data[0].name})
      : t('sDaTat', {ten: data[0].name}),
    classId,
  );
}

// ── MÔN NÀY DẠY LỚP MẤY ─────────────────────────────────────────────────────
// CHỈ QUẢN TRỊ VIÊN. Policy rls_admin_subject_grades là policy GHI duy nhất của bảng
// subject_grades — hiệu trưởng bị chặn kể cả với môn riêng của cơ sở mình. Vì thế màn hình
// KHÔNG vẽ nút này cho họ (nút bấm không được còn tệ hơn không có nút).
export async function saveSubjectGrades(formData: FormData) {
  const tLoi = await getTranslations('common');
  await requireRole(['admin']);
  const t = await getTranslations('loiPhu');
  const subjectId = String(formData.get('subject_id') ?? '');
  const classId = String(formData.get('class_id') ?? '') || null;
  if (!subjectId) subjectsFlash(t('sThieuMon'), classId);

  // 12 ô tick cùng name="grade" → getAll. Lọc lại ở đây vì FormData là thứ người dùng gửi lên,
  // không phải thứ mình vẽ ra (ràng buộc grade_no between 1 and 12 vẫn chốt ở DB).
  const chosen = [
    ...new Set(
      formData
        .getAll('grade')
        .map((v) => Number(String(v)))
        .filter((n) => Number.isInteger(n) && n >= 1 && n <= 12),
    ),
  ].sort((a, b) => a - b);

  const supabase = await createClient();
  // Xoá hết rồi ghi lại: bảng chỉ có đúng hai cột khoá chính, so từng dòng để tính thêm/bớt là
  // phức tạp hơn mà không được gì. KHÔNG nguyên tử với bước insert bên dưới — chấp nhận được vì
  // khoảng trống vài trăm ms chỉ làm môn tạm thời "chưa khai lớp", mà chưa khai = CHỌN ĐƯỢC CHO
  // MỌI LỚP (subject_fits_grade), tức là không chặn nhầm ai giữa chừng.
  const del = await supabase.from('subject_grades').delete().eq('subject_id', subjectId);
  if (del.error) subjectsFlash(loi(friendlyError(del.error)), classId);

  if (chosen.length > 0) {
    const {error} = await supabase
      .from('subject_grades')
      .insert(chosen.map((n) => ({subject_id: subjectId, grade_no: n})));
    revalidatePath('/[locale]/subjects', 'page');
    if (error) subjectsFlash(loi(friendlyError(error, tLoi)), classId);
    subjectsFlash(t('sDaLuuKhoi', {khoi: chosen.join(', ')}), classId);
  }

  revalidatePath('/[locale]/subjects', 'page');
  subjectsFlash(
    t('sXoaKhoi'),
    classId,
  );
}

// ── CHƯƠNG TRÌNH CỦA LỚP: gieo cả bộ môn chuẩn ──────────────────────────────
// RPC seed_class_subjects tự kiểm quyền bên trong (GVCN lớp / BGH cùng cơ sở / quản trị viên)
// và gọi lại bao nhiêu lần cũng an toàn (on conflict do nothing).
export async function seedClassSubjects(formData: FormData) {
  const tLoi = await getTranslations('common');
  await requireRole(['admin', 'principal']);
  const t = await getTranslations('loiPhu');
  const classId = String(formData.get('class_id') ?? '');
  if (!classId) subjectsFlash(t('sThieuLop'));

  const supabase = await createClient();
  const {data, error} = await supabase.rpc('seed_class_subjects', {p_class: classId});
  revalidatePath('/[locale]/subjects', 'page');
  if (error) subjectsFlash(loi(friendlyError(error, tLoi)), classId);
  const n = Number(data ?? 0);
  subjectsFlash(
    n > 0
      ? t('sThemMon', {n: n})
      : t('sDuMon'),
    classId,
  );
}

// ── PHÂN CÔNG GIÁO VIÊN BỘ MÔN ──────────────────────────────────────────────
// ĐÂY LÀ THAO TÁC CẤP QUYỀN: thêm một dòng = mở cho một người ghi vào học bạ của một lớp.
// Ai được làm: đọc rls_write_teaching_assignments — QUẢN TRỊ VIÊN, và HIỆU TRƯỞNG trong đúng
// cơ sở của lớp. GVCN KHÔNG (họ là người hưởng lợi trực tiếp, để họ tự cấp là mô hình sai từ
// gốc). requireRole ở đây khớp đúng policy đó, không nới thêm một ly.
export async function assignTeacher(formData: FormData) {
  const tLoi = await getTranslations('common');
  const me = await requireRole(['admin', 'principal']);
  const t = await getTranslations('loiPhu');
  const classId = String(formData.get('class_id') ?? '');
  const subjectId = String(formData.get('subject_id') ?? '');
  const teacherId = String(formData.get('teacher_id') ?? '');
  if (!classId || !subjectId) subjectsFlash(t('sThieuLopMon'), classId || null);
  if (!teacherId) subjectsFlash(t('sChonGV'), classId);

  const supabase = await createClient();
  const row = {class_id: classId, subject_id: subjectId, teacher_id: teacherId, created_by: me.id};
  const ins = await supabase.from('teaching_assignments').insert(row).select('id');

  // 23505 = đã có đúng bộ ba (lớp, môn, giáo viên) — gần như luôn là dòng ĐÃ GỠ trước đó.
  // BẬT LẠI dòng cũ thay vì upsert đè: upsert sẽ ghi đè created_by/created_at, xoá mất dấu vết
  // ai phân công lần đầu — chính thứ mà "gỡ chứ không xoá" đang cố giữ.
  if (ins.error?.code === '23505') {
    const {data, error} = await supabase
      .from('teaching_assignments')
      .update({is_active: true})
      .eq('class_id', classId)
      .eq('subject_id', subjectId)
      .eq('teacher_id', teacherId)
      .select('id');
    revalidatePath('/[locale]/subjects', 'page');
    revalidatePath('/[locale]/grades', 'page');
    if (error) subjectsFlash(loi(friendlyError(error, tLoi)), classId);
    if (!data || data.length === 0)
      subjectsFlash(t('sKhongPhanCong'), classId);
    subjectsFlash(
      t('sPhanCongLai'),
      classId,
    );
  }

  revalidatePath('/[locale]/subjects', 'page');
  revalidatePath('/[locale]/grades', 'page');
  // P0001 hay gặp nhất ở đây: "Chỉ phân công được cho tài khoản có vai GIÁO VIÊN" (trigger
  // teaching_assignment_guard). friendlyError giữ nguyên câu đó.
  if (ins.error) subjectsFlash(loi(friendlyError(ins.error)), classId);
  if (!ins.data || ins.data.length === 0)
    subjectsFlash(t('sKhongPhanCong'), classId);
  subjectsFlash(
    t('sDaPhanCong'),
    classId,
  );
}

// Gỡ phân công = TẮT CỜ, không xoá dòng.
// Hai lý do, cả hai đều nằm trong 0069: (1) is_active=false là MẤT QUYỀN NGAY vì mọi hàm quyền
// đều lọc cờ này; (2) giữ dòng lại thì còn tra được ai từng dạy môn này ở lớp này — cần thiết
// khi phải hỏi lại nguồn gốc một con điểm cũ.
export async function unassignTeacher(formData: FormData) {
  const tLoi = await getTranslations('common');
  await requireRole(['admin', 'principal']);
  const t = await getTranslations('loiPhu');
  const assignmentId = String(formData.get('assignment_id') ?? '');
  const classId = String(formData.get('class_id') ?? '') || null;
  if (!assignmentId) subjectsFlash(t('sThieuPhanCong'), classId);

  const supabase = await createClient();
  const {data, error} = await supabase
    .from('teaching_assignments')
    .update({is_active: false})
    .eq('id', assignmentId)
    .select('id');
  revalidatePath('/[locale]/subjects', 'page');
  revalidatePath('/[locale]/grades', 'page');
  if (error) subjectsFlash(loi(friendlyError(error, tLoi)), classId);
  if (!data || data.length === 0)
    subjectsFlash(t('sKhongGo'), classId);
  subjectsFlash(
    t('sDaGo'),
    classId,
  );
}

'use server';

import {revalidatePath} from 'next/cache';
import {redirect} from 'next/navigation';
import {createClient} from '@/lib/supabase/server';
import {getCurrentProfile, requireRole} from '@/lib/auth';
import {getTranslations} from 'next-intl/server';
import {friendlyError, loi, tachLoi} from '@/lib/errors';
import {isValidDayVN, mondayOf} from '@/lib/dates';

// Về trang của MỘT em kèm thông báo (xanh = thành công, đỏ = lỗi).
function veTrangEm(studentId: string, msg: string): never {
  const g = tachLoi(msg);
  redirect(`/student/${studentId}?${g.laLoi ? 'flash_err' : 'flash'}=${encodeURIComponent(g.msg)}`);
}

// ════════════════════════════════════════════════════════════════════════════════════════════
// YÊU CẦU-SỬA — tách khỏi actions.ts (PR-2). Ba kind của mô hình mới (C13):
//   · doi_ten_thuoc  — xin thầy cô đổi tên một việc (ref_id = thuoc.id; message = tên mới)
//   · mo_tuan_da_ky  — xin mở lại một tuần đã chốt trong buổi họp (tuan = thứ Hai tuần ấy)
//   · khac           — việc khác, nói bằng lời
// Trigger er_sau_duyet (20-QUYEN §3.7) TỰ ÁP dụng khi duyệt: đổi tên thước, hoặc sinh dòng
// luot_mo_khoa 48 giờ. App KHÔNG tự áp — chỉ đổi status, phần còn lại là việc của CSDL.
// ════════════════════════════════════════════════════════════════════════════════════════════

const KIND_HOP_LE = ['doi_ten_thuoc', 'mo_tuan_da_ky', 'khac'] as const;

// Học sinh (hoặc PH) gửi yêu cầu → GVCN duyệt. 23505 = đã có pending trùng (im lặng, coi như xong).
export async function createEditRequest(formData: FormData) {
  const t = await getTranslations('loi');
  const profile = await getCurrentProfile();
  if (!profile) redirect('/login');
  let student_id = String(formData.get('student_id') ?? '');
  const class_id = String(formData.get('class_id') ?? '');
  const kindRaw = String(formData.get('kind') ?? 'khac');
  const kind = (KIND_HOP_LE as readonly string[]).includes(kindRaw) ? kindRaw : 'khac';
  const ref_id = String(formData.get('ref_id') ?? '') || null;
  const message = String(formData.get('message') ?? '').trim();
  const tuanRaw = String(formData.get('tuan') ?? '').trim();

  // YÊU CẦU PHẢI ĐỨNG TÊN CHÍNH MÌNH: policy chỉ đòi requester_id=uid + cùng lớp, KHÔNG đòi
  // student_id=uid. Ép student_id = chính em để em A không gửi yêu cầu mang tên em B.
  if (profile.role === 'student') student_id = profile.id;
  const back = (m: string): never => veTrangEm(student_id, m);
  if (!student_id || !class_id) back(loi(t('ycThieuThongTin')));

  // Mở tuần đã ký: cần đích danh thứ Hai của tuần xin mở (không suy từ biên bản — vá lỗ khoá
  // vĩnh viễn của biên bản rỗng, C14). Kind khác thì không mang tuần.
  const tuan = kind === 'mo_tuan_da_ky' && isValidDayVN(tuanRaw) ? mondayOf(tuanRaw) : null;
  if (kind === 'mo_tuan_da_ky' && !tuan) back(loi(t('ycChuaRoTuan')));
  if (kind === 'doi_ten_thuoc' && (!ref_id || !message)) back(loi(t('ycDoiTenThieu')));

  const supabase = await createClient();
  const {error} = await supabase.from('edit_requests').insert({
    class_id,
    student_id,
    requester_id: profile.id,
    kind,
    ref_id,
    message: message || null,
    tuan,
  });
  revalidatePath('/[locale]/student/[id]', 'page');
  if (error && error.code !== '23505') back(loi(friendlyError(error)));
  back(t('ycDaGui'));
}

// Học sinh/PH SỬA lời nhắn của yêu cầu MÌNH đã gửi, khi còn 'pending'. `.eq('status','pending')`
// để phân biệt "thầy cô vừa xử lý xong" → báo cho em biết thay vì im lặng không đổi gì.
export async function updateEditRequest(formData: FormData) {
  const t = await getTranslations('loi');
  const profile = await getCurrentProfile();
  if (!profile) redirect('/login');
  const student_id = String(formData.get('student_id') ?? '');
  const id = String(formData.get('request_id') ?? '');
  const message = String(formData.get('message') ?? '').trim();
  const back = (m: string): never => veTrangEm(student_id, m);
  if (!id) back(loi(t('ycThieu')));
  const supabase = await createClient();
  const {data, error} = await supabase
    .from('edit_requests')
    .update({message: message || null})
    .eq('id', id)
    .eq('status', 'pending')
    .select('id');
  revalidatePath('/[locale]/student/[id]', 'page');
  revalidatePath('/[locale]/student', 'page');
  if (error) back(loi(friendlyError(error)));
  back(data && data.length ? t('ycDaCapNhat') : loi(t('ycKhongSuaDaXuLy')));
}

// Học sinh/PH RÚT LẠI yêu cầu của mình khi chưa xử lý. Rút lại giải phóng luôn unique index
// pending → gửi lại yêu cầu mới được ngay.
export async function withdrawEditRequest(formData: FormData) {
  const t = await getTranslations('loi');
  const profile = await getCurrentProfile();
  if (!profile) redirect('/login');
  const student_id = String(formData.get('student_id') ?? '');
  const id = String(formData.get('request_id') ?? '');
  const back = (m: string): never => veTrangEm(student_id, m);
  if (!id) back(loi(t('ycThieu')));
  const supabase = await createClient();
  const {data, error} = await supabase
    .from('edit_requests')
    .delete()
    .eq('id', id)
    .eq('status', 'pending')
    .select('id');
  revalidatePath('/[locale]/student/[id]', 'page');
  revalidatePath('/[locale]/student', 'page');
  if (error) back(loi(friendlyError(error)));
  back(data && data.length ? t('ycDaRut') : loi(t('ycKhongRutDaXuLy')));
}

// GVCN/Admin duyệt/từ chối. IDEMPOTENT: chỉ đổi khi đang 'pending'. Trigger er_truoc_sua tự điền
// resolved_by/resolved_at; er_sau_duyet tự áp dụng doi_ten_thuoc (đổi tên thước) và mo_tuan_da_ky
// (sinh luot_mo_khoa 48 giờ) — app KHÔNG tự làm hai việc ấy nữa (mô hình cũ tự áp rename_lead).
export async function resolveEditRequest(formData: FormData) {
  const t = await getTranslations('loi');
  await requireRole(['teacher', 'admin']);
  const student_id = String(formData.get('student_id') ?? '');
  const id = String(formData.get('request_id') ?? '');
  const decision = String(formData.get('decision') ?? '');
  if (!id || (decision !== 'approved' && decision !== 'rejected'))
    veTrangEm(student_id, loi(t('ycThieuThongTinDuyet')));
  const supabase = await createClient();
  const {data, error} = await supabase
    .from('edit_requests')
    .update({status: decision})
    .eq('id', id)
    .eq('status', 'pending')
    .select('id');
  revalidatePath('/[locale]/student/[id]', 'page');
  revalidatePath('/[locale]/wig', 'page');
  if (error) veTrangEm(student_id, loi(friendlyError(error)));
  if (!data || data.length === 0) veTrangEm(student_id, loi(t('ycDaXuLyTruoc')));
  veTrangEm(student_id, decision === 'approved' ? t('ycDaDuyet') : t('ycDaTuChoi'));
}

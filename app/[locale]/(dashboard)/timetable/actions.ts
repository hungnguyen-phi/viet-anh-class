'use server';

import {revalidatePath} from 'next/cache';
import {redirect} from 'next/navigation';
import {getTranslations} from 'next-intl/server';
import {createClient} from '@/lib/supabase/server';
import {requireRole, getCurrentProfile} from '@/lib/auth';
import {friendlyError, loi, tachLoi} from '@/lib/errors';

function flash(classId: string, msg: string): never {
  const g = tachLoi(msg);
  redirect(`/timetable?class=${encodeURIComponent(classId)}&${g.laLoi ? 'flash_err' : 'flash'}=${encodeURIComponent(g.msg)}`);
}

// MỌI CÂU BÁO ĐI QUA messages/timetable.* (audit 04/09: chuỗi Việt cứng trong action → màn tiếng
// Anh hiện tiếng Việt). getTranslations trong server action đọc đúng locale của request.
const tb = () => getTranslations('timetable');

// Hiệu trưởng nằm trong danh sách: ở trường thật, THỜI KHOÁ BIỂU do ban giám hiệu xếp, giáo
// viên chỉ đổi ngoại lệ (thi, thực hành, dạy thay). RLS ở migration 0057 giới hạn họ đúng các
// lớp trong cơ sở mình.
const KINDS = ['regular', 'practice', 'exam'] as const;
const QUAN_TKB = ['teacher', 'admin', 'principal'] as const;

// Ô môn giờ gửi lên id của danh mục. Kiểm dạng uuid ngay tại đây để câu lỗi là tiếng Việt dễ
// hiểu, thay vì để Postgres trả 22P02 rồi friendlyError chỉ nói được "Đã xảy ra lỗi".
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type LuuOState = {ok: boolean; error?: string; message?: string};

// Lưu (tạo/sửa) 1 ô thời khoá biểu. RLS tt_manage: chỉ GVCN lớp/admin.
//
// TRẢ STATE, KHÔNG CHUYỂN TRANG. Form này nay nằm trong hộp thoại mở ra từ chính ô lịch: chuyển
// trang kèm một câu lỗi ở đầu trang có nghĩa là hộp thoại biến mất, chữ vừa gõ mất theo, và câu
// lỗi hiện ở chỗ cách xa nơi vừa bấm. Trả state thì lỗi hiện ngay trong hộp, còn lưu xong thì
// hộp tự đóng (cùng lối đã dùng cho form sửa mục tiêu ở /wig).
export async function luuOTiet(_prev: LuuOState, formData: FormData): Promise<LuuOState> {
  const tLoi = await getTranslations('common');
  await requireRole([...QUAN_TKB]);
  const t = await tb();
  const class_id = String(formData.get('class_id') ?? '');
  const day_of_week = Number(formData.get('day_of_week') ?? 0);
  const period_no = Number(formData.get('period_no') ?? 0);
  const subject_id = String(formData.get('subject_id') ?? '').trim();
  const room = String(formData.get('room') ?? '').trim() || null;
  const teacher_name = String(formData.get('teacher_name') ?? '').trim() || null;
  const kindRaw = String(formData.get('kind') ?? 'regular');
  // Giá trị lạ từ form → về 'regular' cho khỏi dính CHECK ở DB rồi báo lỗi khó hiểu.
  const kind = (KINDS as readonly string[]).includes(kindRaw) ? kindRaw : 'regular';
  if (!class_id || !day_of_week || !period_no) return {ok: false, error: t('errMissingCell')};
  if (!UUID.test(subject_id)) return {ok: false, error: t('errPickSubject')};

  // ÁP CHO NHIỀU THỨ MỘT LẦN (18/08/2026 — "trình quản lý chuyên nghiệp"): môn học chính khoá
  // thường lặp 2–3 buổi/tuần, mà bản cũ bắt mở hộp thoại từng ô khai lại y hệt. Các checkbox
  // "áp thêm cho thứ…" gửi lên đây; ô gốc luôn nằm trong danh sách. Kiểm lại dải 2..8 vì
  // checkbox nằm trong trình duyệt.
  const cacThu = [
    ...new Set([
      day_of_week,
      ...formData
        .getAll('ap_thu')
        .map((d) => Number(String(d)))
        .filter((n) => Number.isInteger(n) && n >= 2 && n <= 8),
    ]),
  ];

  const supabase = await createClient();

  // KHÔNG GHI ĐÈ LẶNG LẼ (audit 18/08/2026): ngày được tick "áp thêm" mà ĐÃ có tiết khác môn thì
  // bỏ qua, chỉ ghi vào ô TRỐNG — xoá một ô đã bắt hỏi lại, nên áp đè cả tuần càng không được im.
  // Ô gốc (day_of_week) luôn ghi: ở chế độ thêm nó vốn trống; nếu là sửa thì chỉ có một thứ.
  const apThem = cacThu.filter((thu) => thu !== day_of_week);
  let biChiem: number[] = [];
  if (apThem.length > 0) {
    const {data: daCo} = await supabase
      .from('timetable_slots')
      .select('day_of_week')
      .eq('class_id', class_id)
      .eq('period_no', period_no)
      .in('day_of_week', apThem);
    biChiem = (daCo ?? []).map((r) => r.day_of_week);
  }
  const seChiem = new Set(biChiem);
  const seGhi = [day_of_week, ...apThem.filter((thu) => !seChiem.has(thu))];

  const {error} = await supabase
    .from('timetable_slots')
    // CHỈ ghi subject_id. Cột chữ `subject` cũ cố ý KHÔNG đụng tới: ghi cả hai là dựng lại đúng
    // hai nguồn sự thật mà 0069 vừa dẹp. onConflict giữ nguyên (class, thứ, tiết) — cột môn
    // không nằm trong khoá nên đổi môn của một ô vẫn là SỬA ô đó, không đẻ ô mới.
    .upsert(
      seGhi.map((thu) => ({class_id, day_of_week: thu, period_no, subject_id, room, teacher_name, kind})),
      {onConflict: 'class_id,day_of_week,period_no'},
    );
  if (error) return {ok: false, error: friendlyError(error, tLoi)};
  revalidatePath('/[locale]/timetable', 'page');
  const boQua = biChiem.length;
  return {
    ok: true,
    message:
      seGhi.length > 1
        ? t('savedDays', {n: seGhi.length}) + (boQua > 0 ? t('skippedDays', {n: boQua}) : '')
        : boQua > 0
          ? t('savedOne') + t('skippedDays', {n: boQua})
          : t('savedOne'),
  };
}

// ============================================================
// NHẬP HÀNG LOẠT (audit 04/09/2026): dán cả bảng từ Excel/Sheets, xem trước, lưu MỘT lần.
// 28 lớp × 40 ô mà nhập từng ô một thì không ai nhập — lớp thật trống trơn suốt năm.
// Trình duyệt đã đối chiếu tên môn → subject_id và dựng danh sách ô; ở đây chỉ kiểm lại từng ô
// (dải thứ/tiết, uuid) và tôn trọng luật "không ghi đè lặng lẽ": chỉ đè khi người bấm tick rõ.
// ============================================================
type ODan = {d: number; p: number; s: string};

function docCacO(raw: string): ODan[] | null {
  try {
    const arr = JSON.parse(raw) as unknown;
    if (!Array.isArray(arr)) return null;
    const ra: ODan[] = [];
    for (const o of arr) {
      if (!o || typeof o !== 'object') return null;
      const {d, p, s} = o as {d: unknown; p: unknown; s: unknown};
      if (!Number.isInteger(d) || (d as number) < 2 || (d as number) > 8) return null;
      if (!Number.isInteger(p) || (p as number) < 1 || (p as number) > 12) return null;
      if (typeof s !== 'string' || !UUID.test(s)) return null;
      ra.push({d: d as number, p: p as number, s});
    }
    return ra;
  } catch {
    return null;
  }
}

export async function nhapHangLoat(_prev: LuuOState, formData: FormData): Promise<LuuOState> {
  const tLoi = await getTranslations('common');
  await requireRole([...QUAN_TKB]);
  const t = await tb();
  const class_id = String(formData.get('class_id') ?? '');
  const ghiDe = String(formData.get('ghi_de') ?? '') === '1';
  if (!UUID.test(class_id)) return {ok: false, error: t('errMissingClass')};
  const cacO = docCacO(String(formData.get('cac_o') ?? '[]'));
  if (!cacO) return {ok: false, error: t('bulkErrBad')};
  if (cacO.length === 0) return {ok: false, error: t('bulkErrEmpty')};
  // Hai ô cùng toạ độ trong một lần dán → giữ ô sau (như người ta sửa đè trên bảng tính).
  const theoKhoa = new Map(cacO.map((o) => [`${o.d}-${o.p}`, o]));

  const supabase = await createClient();
  let boQua = 0;
  if (!ghiDe) {
    const {data: daCo, error} = await supabase
      .from('timetable_slots')
      .select('day_of_week, period_no')
      .eq('class_id', class_id);
    if (error) return {ok: false, error: friendlyError(error, tLoi)};
    for (const r of daCo ?? []) {
      if (theoKhoa.delete(`${r.day_of_week}-${r.period_no}`)) boQua++;
    }
  }
  const rows = [...theoKhoa.values()].map((o) => ({
    class_id,
    day_of_week: o.d,
    period_no: o.p,
    subject_id: o.s,
    kind: 'regular',
  }));
  if (rows.length === 0) return {ok: false, error: t('bulkAllExist', {n: boQua})};
  const {error} = await supabase
    .from('timetable_slots')
    .upsert(rows, {onConflict: 'class_id,day_of_week,period_no'});
  if (error) return {ok: false, error: friendlyError(error, tLoi)};
  revalidatePath('/[locale]/timetable', 'page');
  return {ok: true, message: t('bulkSaved', {n: rows.length}) + (boQua > 0 ? t('skippedDays', {n: boQua}) : '')};
}

// ============================================================
// SAO CHÉP THỜI KHOÁ BIỂU TỪ LỚP KHÁC (audit 04/09/2026): các lớp cùng khối thường học cùng
// một khung; xếp một lớp rồi nhân ra là xong cả khối. Môn của lớp nguồn chưa có trong chương
// trình lớp đích thì thêm vào class_subjects trước (không thì trigger subject_fits_class chặn
// từng ô một, người dùng không hiểu vì sao "lỗi").
// ============================================================
export async function saoChepTuLop(_prev: LuuOState, formData: FormData): Promise<LuuOState> {
  const tLoi = await getTranslations('common');
  await requireRole([...QUAN_TKB]);
  const t = await tb();
  const class_id = String(formData.get('class_id') ?? '');
  const nguon_id = String(formData.get('nguon_id') ?? '');
  const ghiDe = String(formData.get('ghi_de') ?? '') === '1';
  if (!UUID.test(class_id)) return {ok: false, error: t('errMissingClass')};
  if (!UUID.test(nguon_id)) return {ok: false, error: t('copyErrNoSource')};
  if (nguon_id === class_id) return {ok: false, error: t('copyErrSameClass')};

  const supabase = await createClient();
  const [{data: nguon, error: e1}, {data: daCoRes, error: e2}, {data: monDich, error: e3}] = await Promise.all([
    supabase
      .from('timetable_slots')
      .select('day_of_week, period_no, subject_id, room, teacher_name, kind')
      .eq('class_id', nguon_id)
      .not('subject_id', 'is', null),
    supabase.from('timetable_slots').select('day_of_week, period_no').eq('class_id', class_id),
    supabase.from('class_subjects').select('subject_id').eq('class_id', class_id),
  ]);
  if (e1 || e2 || e3) return {ok: false, error: friendlyError((e1 ?? e2 ?? e3)!)};
  if (!nguon || nguon.length === 0) return {ok: false, error: t('copyErrSourceEmpty')};

  // Môn lớp nguồn có mà lớp đích chưa khai → khai thêm (cùng cơ sở thì subject_fits_class cho qua;
  // khác cơ sở thì DB từ chối và câu báo nói thẳng).
  const daKhai = new Set((monDich ?? []).map((m) => m.subject_id));
  const thieu = [...new Set(nguon.map((s) => s.subject_id as string))].filter((id) => !daKhai.has(id));
  if (thieu.length > 0) {
    const {error} = await supabase
      .from('class_subjects')
      .upsert(thieu.map((subject_id) => ({class_id, subject_id, is_active: true})), {
        onConflict: 'class_id,subject_id',
        ignoreDuplicates: true,
      });
    if (error) return {ok: false, error: t('copyErrSubjects', {n: thieu.length}) + ' ' + friendlyError(error, tLoi)};
  }

  const daCo = new Set((daCoRes ?? []).map((r) => `${r.day_of_week}-${r.period_no}`));
  let boQua = 0;
  const rows = nguon
    .filter((s) => {
      if (ghiDe || !daCo.has(`${s.day_of_week}-${s.period_no}`)) return true;
      boQua++;
      return false;
    })
    .map((s) => ({
      class_id,
      day_of_week: s.day_of_week,
      period_no: s.period_no,
      subject_id: s.subject_id,
      room: s.room,
      teacher_name: s.teacher_name,
      kind: s.kind,
    }));
  if (rows.length === 0) return {ok: false, error: t('bulkAllExist', {n: boQua})};
  const {error} = await supabase
    .from('timetable_slots')
    .upsert(rows, {onConflict: 'class_id,day_of_week,period_no'});
  if (error) return {ok: false, error: friendlyError(error, tLoi)};
  revalidatePath('/[locale]/timetable', 'page');
  return {ok: true, message: t('copySaved', {n: rows.length}) + (boQua > 0 ? t('skippedDays', {n: boQua}) : '')};
}

// ============================================================
// KHUNG GIỜ TIẾT (0149): "Tiết 3" phải nói được là mấy giờ.
// Form gửi 12 cặp tu_N / den_N; cặp bỏ trống = tiết đó không khai (xoá dòng nếu có).
// ============================================================
export async function luuGioTiet(_prev: LuuOState, formData: FormData): Promise<LuuOState> {
  const tLoi = await getTranslations('common');
  const me = await requireRole([...QUAN_TKB]);
  const t = await tb();
  const class_id = String(formData.get('class_id') ?? '');
  if (!class_id) return {ok: false, error: t('errMissingClass')};

  const ghi: {class_id: string; period_no: number; start_time: string; end_time: string; updated_by: string}[] = [];
  const xoa: number[] = [];
  for (let p = 1; p <= 12; p++) {
    const tu = String(formData.get(`tu_${p}`) ?? '').trim();
    const den = String(formData.get(`den_${p}`) ?? '').trim();
    if (!tu && !den) {
      xoa.push(p);
      continue;
    }
    if (!tu || !den) return {ok: false, error: t('errPeriodBoth', {p})};
    if (den <= tu) return {ok: false, error: t('errPeriodOrder', {p})};
    ghi.push({class_id, period_no: p, start_time: tu, end_time: den, updated_by: me.id});
  }
  // Tiết sau không được BẮT ĐẦU trước khi tiết trước KẾT THÚC — khung giờ chồng nhau là lưới
  // nói dối hai kiểu cùng lúc.
  for (let i = 1; i < ghi.length; i++) {
    if (ghi[i].start_time < ghi[i - 1].end_time)
      return {ok: false, error: t('errPeriodOverlap', {p: ghi[i].period_no, q: ghi[i - 1].period_no})};
  }

  const supabase = await createClient();
  if (ghi.length > 0) {
    const {error} = await supabase
      .from('class_period_times')
      .upsert(ghi, {onConflict: 'class_id,period_no'});
    if (error) return {ok: false, error: friendlyError(error, tLoi)};
  }
  if (xoa.length > 0) {
    const {error} = await supabase
      .from('class_period_times')
      .delete()
      .eq('class_id', class_id)
      .in('period_no', xoa);
    if (error) return {ok: false, error: friendlyError(error, tLoi)};
  }
  revalidatePath('/[locale]/timetable', 'page');
  return {ok: true, message: t('savedTimes')};
}

// Gieo cả bộ môn của cơ sở vào chương trình lớp (class_subjects), để ô chọn môn thôi rỗng.
//
// Không tự làm ngầm khi mở trang: đây là một thao tác GHI, và người bấm phải là người chịu trách
// nhiệm về chương trình của lớp. RPC tự kiểm quyền (GVCN lớp / hiệu trưởng cùng cơ sở / admin) và
// tự bỏ qua môn đã có, nên bấm nhầm hai lần cũng không sao.
export async function seedSubjects(formData: FormData) {
  const tLoi = await getTranslations('common');
  await requireRole([...QUAN_TKB]);
  const t = await tb();
  const class_id = String(formData.get('class_id') ?? '');
  if (!class_id) flash(class_id, loi(t('errMissingClass')));
  const supabase = await createClient();
  const {data, error} = await supabase.rpc('seed_class_subjects', {p_class: class_id});
  revalidatePath('/[locale]/timetable', 'page');
  flash(class_id, error ? loi(friendlyError(error, tLoi)) : t('seededSubjects', {n: data ?? 0}));
}

// ============================================================
// Ngoại lệ THEO NGÀY: huỷ / dời / dạy thay (0044).
// timetable_slots là mẫu tuần lặp nên không thể biểu diễn "huỷ tiết 3 thứ Tư ngày 15/09" —
// phải ghi riêng theo ngày, nếu không sẽ phá cả các tuần khác.
// ============================================================
export async function saveOverride(formData: FormData) {
  const tLoi = await getTranslations('common');
  await requireRole([...QUAN_TKB]);
  const t = await tb();
  const class_id = String(formData.get('class_id') ?? '');
  const slot_id = String(formData.get('slot_id') ?? '');
  const date = String(formData.get('date') ?? '');
  const status = String(formData.get('status') ?? '');
  const note = String(formData.get('note') ?? '').trim() || null;
  const substitute_name = String(formData.get('substitute_name') ?? '').trim() || null;
  const new_date = String(formData.get('new_date') ?? '').trim() || null;
  const newPeriodRaw = String(formData.get('new_period_no') ?? '').trim();
  const new_period_no = newPeriodRaw ? Number(newPeriodRaw) : null;

  if (!slot_id || !date) flash(class_id, loi(t('errMissingSlotDate')));
  if (!['cancelled', 'moved', 'substituted'].includes(status)) flash(class_id, loi(t('errBadStatus')));
  // Kiểm ở đây để báo câu dễ hiểu; DB vẫn có CHECK tto_moved_needs_target / tto_sub_needs_name
  // làm chốt cuối (không tin form).
  if (status === 'moved' && (!new_date || !new_period_no)) flash(class_id, loi(t('errMovedNeedsTarget')));
  if (status === 'substituted' && !substitute_name) flash(class_id, loi(t('errSubNeedsName')));

  const supabase = await createClient();

  // NGÀY PHẢI KHỚP THỨ CỦA TIẾT (audit 18/08/2026): lưới tra ngoại lệ bằng khoá slot.id|ngày-của
  // -cột-đúng-thứ. Ghi ngoại lệ cho 'T2 tiết 3' vào một ngày thứ Tư thì lưu thành công nhưng
  // KHÔNG BAO GIỜ hiện — ô mờ đi mà không ai hiểu vì sao. Chặn ở đây. Thứ của repo là 2..8
  // (T2..CN); getUTCDay() trả 0..6 với 0=CN → quy đổi.
  const {data: slot} = await supabase
    .from('timetable_slots')
    .select('day_of_week')
    .eq('id', slot_id)
    .maybeSingle();
  if (!slot) flash(class_id, loi(t('errSlotGone')));
  const dowCuaNgay = (() => {
    const d = new Date(`${date}T00:00:00Z`).getUTCDay();
    return d === 0 ? 8 : d + 1;
  })();
  if (slot!.day_of_week !== dowCuaNgay) flash(class_id, loi(t('errDateMismatch')));

  // 1 ngoại lệ / (tiết, ngày) — ghi lại thì thay cái cũ, không chồng nhiều trạng thái lên nhau.
  const {error} = await supabase.from('timetable_overrides').upsert(
    {
      slot_id,
      date,
      status,
      note,
      substitute_name: status === 'substituted' ? substitute_name : null,
      new_date: status === 'moved' ? new_date : null,
      new_period_no: status === 'moved' ? new_period_no : null,
    },
    {onConflict: 'slot_id,date'},
  );
  revalidatePath('/[locale]/timetable', 'page');
  flash(class_id, error ? loi(friendlyError(error, tLoi)) : t('savedOverride'));
}

export async function deleteOverride(formData: FormData) {
  const tLoi = await getTranslations('common');
  await requireRole([...QUAN_TKB]);
  const t = await tb();
  const class_id = String(formData.get('class_id') ?? '');
  const id = String(formData.get('id') ?? '');
  const supabase = await createClient();
  const {error} = await supabase.from('timetable_overrides').delete().eq('id', id);
  revalidatePath('/[locale]/timetable', 'page');
  flash(class_id, error ? loi(friendlyError(error, tLoi)) : t('removedOverride'));
}

// ============================================================
// TKB CLB THEO CƠ SỞ (0152, chủ dự án 18/08/2026): CLB là LIÊN LỚP nên KHÔNG treo theo lớp nữa —
// một lịch dùng chung của cơ sở, BGH/Admin điều phối, cả cơ sở xem. RLS cc_manage là chốt thật
// (Admin / BGH cơ sở mình); ở đây trả state để lỗi hiện ngay dưới nút (form nằm cuối trang).
// ============================================================
export async function luuCLBCoSo(_prev: LuuOState, formData: FormData): Promise<LuuOState> {
  const tLoi = await getTranslations('common');
  await requireRole(['admin', 'principal']);
  const t = await tb();
  const campus_id = String(formData.get('campus_id') ?? '');
  const weekday = Number(formData.get('weekday') ?? 0);
  const name = String(formData.get('name') ?? '').trim();
  const start_time = String(formData.get('start_time') ?? '').trim();
  const end_time = String(formData.get('end_time') ?? '').trim();
  const room = String(formData.get('room') ?? '').trim() || null;
  const note = String(formData.get('note') ?? '').trim() || null;
  if (!campus_id || weekday < 2 || weekday > 8) return {ok: false, error: t('errClubDay')};
  if (!name) return {ok: false, error: t('errClubName')};
  if (name.length > 120) return {ok: false, error: t('errClubNameLong')};
  if (!start_time || !end_time) return {ok: false, error: t('errClubTime')};
  if (end_time <= start_time) return {ok: false, error: t('errClubTimeOrder')};

  const me = await getCurrentProfile();
  const supabase = await createClient();
  const {error} = await supabase
    .from('campus_clubs')
    .insert({campus_id, weekday, name, start_time, end_time, room, note, created_by: me?.id ?? null});
  if (error) return {ok: false, error: friendlyError(error, tLoi)};
  revalidatePath('/[locale]/timetable', 'page');
  return {ok: true, message: t('savedClub')};
}

export async function xoaCLBCoSo(formData: FormData) {
  const tLoi = await getTranslations('common');
  await requireRole(['admin', 'principal']);
  const t = await tb();
  const id = String(formData.get('id') ?? '');
  const supabase = await createClient();
  const {error} = await supabase.from('campus_clubs').delete().eq('id', id);
  revalidatePath('/[locale]/timetable', 'page');
  const g = tachLoi(error ? loi(friendlyError(error, tLoi)) : t('deletedClub'));
  redirect(`/timetable?${g.laLoi ? 'flash_err' : 'flash'}=${encodeURIComponent(g.msg)}`);
}

export async function deleteSlot(formData: FormData) {
  const tLoi = await getTranslations('common');
  await requireRole([...QUAN_TKB]);
  const t = await tb();
  const class_id = String(formData.get('class_id') ?? '');
  const id = String(formData.get('id') ?? '');
  const supabase = await createClient();
  const {error} = await supabase.from('timetable_slots').delete().eq('id', id);
  revalidatePath('/[locale]/timetable', 'page');
  flash(class_id, error ? loi(friendlyError(error, tLoi)) : t('deletedSlot'));
}

'use server';

import {redirect} from 'next/navigation';
import {revalidatePath} from 'next/cache';
import {createClient} from '@/lib/supabase/server';
import {requireRole} from '@/lib/auth';
import {friendlyError, loi, tachLoi} from '@/lib/errors';
import {SCHOOL_LEVELS, gradeNumbersFor, type SchoolLevel} from '@/lib/levels';
import {AREAS} from '@/lib/areas';
import {isValidDayVN, todayInVN, weekRangeVN, mondayOf, schoolYearRangeVN} from '@/lib/dates';
import type {Database} from '@/lib/database.types';

type WigDomain = Database['public']['Enums']['wig_domain'];

// Quản lý giáo viên ở cấp CƠ SỞ, dành cho Hiệu trưởng (Admin làm việc này ở /admin).
//
// Ba lớp chặn xếp chồng, cố ý KHÔNG dựa vào lớp nào một mình:
//   1. requireRole ở đây — chặn người không phải BGH/Admin gọi action.
//   2. RLS rls_all_pending_user_grants / rls_update_profiles — giới hạn đúng cơ sở của HT
//      và cấm vai trò admin/principal.
//   3. Trigger protect_profile_privileged_cols — cấm đổi email/cơ sở, cấm nâng vai trò.
// Lớp 1 chỉ để báo lỗi tử tế; hai lớp dưới mới là thứ giữ an toàn thật, vì chúng nằm trong DB
// nên đường nào đi tới cũng bị chặn.

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function flash(msg: string): never {
  const g = tachLoi(msg);
  redirect(`/campus?${g.laLoi ? 'flash_err' : 'flash'}=${encodeURIComponent(g.msg)}`);
}

// Cơ sở của chính người đang đăng nhập — HT không được tự chọn cơ sở khác.
//
// Trả về CẢ hồ sơ chứ không riêng campus_id: các action bên dưới cần biết mình là ai (để ghi
// invited_by, để chặn tự vô hiệu chính mình). Trước đây chúng gọi thêm supabase.auth.getUser()
// cho việc đó — mà getUser() là một vòng mạng THẬT tới Supabase Auth mỗi lần gọi, trong khi
// requireRole() vừa lấy xong đúng thông tin ấy. Lấy sẵn ở đây là bớt hẳn một vòng chờ cho mỗi
// lần mời giáo viên / vô hiệu giáo viên.
async function myCampus() {
  const profile = await requireRole(['principal', 'admin']);
  if (!profile.campus_id) flash('Tài khoản của bạn chưa được gán cơ sở. Nhờ quản trị viên gán trước.');
  return profile;
}

// Mời giáo viên: tạo lời mời theo email; vai trò + cơ sở được áp khi họ đăng nhập lần đầu
// (handle_new_user). Nhận nhiều email một lượt cho đỡ nhọc đầu năm học.
export async function inviteTeachers(formData: FormData) {
  const me = await myCampus();
  const campus_id = me.campus_id;
  const raw = String(formData.get('email') ?? '');
  const all = Array.from(
    new Set(
      raw
        .split(/[\s,;]+/)
        .map((e) => e.trim().toLowerCase())
        .filter(Boolean),
    ),
  );
  if (all.length === 0) flash('Chưa nhập email nào');
  const valid = all.filter((e) => EMAIL_RE.test(e));
  const skipped = all.length - valid.length;
  if (valid.length === 0) flash('Không có email hợp lệ (định dạng: ten@example.com).');

  const supabase = await createClient();
  const rows = valid.map((email) => ({
    email,
    role: 'teacher' as const,
    campus_id,
    invited_by: me.id,
  }));
  const {error} = await supabase.from('pending_user_grants').upsert(rows, {onConflict: 'email'});
  if (!error) {
    await supabase.rpc('log_audit', {
      p_action: 'principal_invite_teachers',
      p_detail: {count: valid.length, campus: campus_id},
    });
  }
  revalidatePath('/[locale]/campus', 'page');
  const msg =
    valid.length === 1
      ? `Đã mời ${valid[0]}. Vai trò giáo viên được gán khi họ đăng nhập lần đầu.`
      : `Đã mời ${valid.length} giáo viên. Vai trò được gán khi họ đăng nhập lần đầu.`;
  flash(error ? loi(friendlyError(error)) : msg + (skipped > 0 ? ` (bỏ qua ${skipped} email sai định dạng)` : ''));
}

export async function cancelInvite(formData: FormData) {
  await myCampus();
  const email = String(formData.get('email') ?? '');
  if (!email) flash('Thiếu email');
  const supabase = await createClient();
  // RLS giới hạn đúng cơ sở HT → không cần (và không nên) tự lọc campus ở đây.
  const {error} = await supabase.from('pending_user_grants').delete().eq('email', email);
  revalidatePath('/[locale]/campus', 'page');
  flash(error ? loi(friendlyError(error)) : `Đã huỷ lời mời ${email}`);
}

// Vô hiệu / khôi phục giáo viên. 'pending' = còn tài khoản nhưng không vào được gì —
// giữ nguyên lịch sử điểm danh, WIG… nên KHÔNG dùng xoá.
export async function setTeacherActive(formData: FormData) {
  const me = await myCampus();
  const userId = String(formData.get('userId') ?? '');
  const active = String(formData.get('active') ?? '') === 'true';
  if (!userId) flash('Thiếu giáo viên');
  if (me.id === userId) flash('Không thể tự vô hiệu chính mình.');

  const supabase = await createClient();
  const {error} = await supabase
    .from('profiles')
    .update({role: active ? 'teacher' : 'pending'})
    .eq('id', userId);
  if (!error) {
    await supabase.rpc('log_audit', {
      p_action: active ? 'principal_enable_teacher' : 'principal_disable_teacher',
      p_detail: {target_user: userId},
    });
  }
  revalidatePath('/[locale]/campus', 'page');
  flash(
    error
      ? loi(friendlyError(error))
      : active
        ? 'Đã khôi phục quyền giáo viên'
        : 'Đã vô hiệu (chuyển về "chờ cấp quyền")',
  );
}

// Khai cấp học cho cơ sở mình → DB sinh luôn bộ khối chuẩn của các cấp đó.
// Đi qua RPC set_my_campus_levels (SECURITY DEFINER) chứ không UPDATE thẳng bảng campuses: HT chỉ
// được đổi đúng cột `levels` của đúng cơ sở mình, không đụng tên/mã/trạng thái lưu-trữ.
export async function setCampusLevel(formData: FormData) {
  await myCampus();
  // Nhiều ô tick cùng name="level" → getAll. Trường liên cấp khai được cả THCS lẫn THPT.
  const levels = [...new Set(formData.getAll('level').map(String))].filter((lv) =>
    SCHOOL_LEVELS.includes(lv as SchoolLevel),
  ) as SchoolLevel[];
  if (levels.length === 0) flash('Hãy chọn ít nhất một cấp học');
  const supabase = await createClient();
  const {data, error} = await supabase.rpc('set_my_campus_levels', {p_levels: levels});
  revalidatePath('/[locale]/campus', 'page');
  if (error) flash(loi(friendlyError(error)));
  const nums = gradeNumbersFor(levels);
  flash(
    nums
      ? `Đã đặt cấp học và tạo ${data ?? nums.length} khối: ${nums.map((n) => `Khối ${n}`).join(', ')}`
      : 'Đã đặt cấp học mầm non — hãy thêm khối bằng tay.',
  );
}

// Phân công GVCN cho lớp trong cơ sở mình.
export async function assignHomeroom(formData: FormData) {
  await myCampus();
  const classId = String(formData.get('class_id') ?? '');
  const userId = String(formData.get('userId') ?? '') || null;
  if (!classId) flash('Thiếu lớp');
  const supabase = await createClient();
  const {error} = await supabase
    .from('classes')
    .update({homeroom_teacher_id: userId})
    .eq('id', classId);
  if (!error) {
    await supabase.rpc('log_audit', {
      p_action: 'principal_assign_homeroom',
      p_detail: {class: classId, teacher: userId},
    });
  }
  revalidatePath('/[locale]/campus', 'page');
  flash(error ? loi(friendlyError(error)) : userId ? 'Đã phân công GVCN' : 'Đã bỏ phân công GVCN');
}

// ════════════════════════════════════════════════════════════════════════════════════════════
// MỤC TIÊU CỦA CƠ SỞ + LỊCH TUẦN HỌC + NHẬP HỘ (PA2, màn /campus 40-C)
// ════════════════════════════════════════════════════════════════════════════════════════════
//
// Mô hình cũ (wigs/school_wig_rollup/cuon_so_lieu) đã DROP ở 0161–0169. Đường ghi nay trỏ bảng
// `muc_tieu` (bốn cấp) và bảng `tuan_hoc` (lịch nghỉ/thi của cơ sở). Luật thật nằm ở RLS/trigger
// của CSDL (20-QUYEN); mấy hàm dưới chỉ chặn sớm để trả câu tiếng người rồi để CHECK bắt phần còn
// lại. NutDuyet cần action kiểu A (trả state, không redirect) — xem type DuyetState.

type DuyetState = {ok: boolean; error?: string};
type TuanHocState = {ok: boolean; loai?: string; error?: string};

// BGH DUYỆT MỤC TIÊU CỦA LỚP (cap='lop', trạng thái 'gui' → 'duyet').
//
// GVCN tạo mục tiêu lớp là vào 'gui'; chỉ BGH/Admin đưa sang 'duyet' (chốt C11/0148). Trigger
// mt_truoc_sua (20 §3.2) chặn đường GVCN tự duyệt ở CSDL và tự ký duyet_boi/duyet_at — đây chỉ
// là cái nút. RLS giới hạn đúng cơ sở của hiệu trưởng, nên .select() trả 0 dòng = không còn chờ
// duyệt (chứ không phải lỗi).
export async function duyetMucTieuLop(_prev: DuyetState, formData: FormData): Promise<DuyetState> {
  await requireRole(['principal', 'admin']);
  const id = String(formData.get('muc_tieu_id') ?? '');
  if (!id) return {ok: false, error: 'Thiếu mục tiêu cần duyệt.'};
  const supabase = await createClient();
  const {data, error} = await supabase
    .from('muc_tieu')
    .update({trang_thai: 'duyet'})
    .eq('id', id)
    .eq('cap', 'lop')
    .eq('trang_thai', 'gui')
    .select('id');
  if (error) return {ok: false, error: friendlyError(error)};
  if ((data ?? []).length === 0) return {ok: false, error: 'Mục tiêu này không còn chờ duyệt.'};
  revalidatePath('/[locale]/campus', 'page');
  revalidatePath('/[locale]/wig', 'page');
  return {ok: true};
}

// BGH TRẢ LẠI mục tiêu của lớp kèm lý do (gui → tra_lai). Trigger đòi ly_do_tra_lai không rỗng
// (23514) — chặn sớm ở đây cho câu đẹp rồi để trigger là luật.
export async function traLaiMucTieuLop(_prev: DuyetState, formData: FormData): Promise<DuyetState> {
  await requireRole(['principal', 'admin']);
  const id = String(formData.get('muc_tieu_id') ?? '');
  const note = String(formData.get('note') ?? '').trim();
  if (!id) return {ok: false, error: 'Thiếu mục tiêu.'};
  if (!note) return {ok: false, error: 'Trả lại thì ghi cho lớp một câu vì sao nhé.'};
  if (note.length > 300) return {ok: false, error: 'Nhận xét tối đa 300 ký tự.'};
  const supabase = await createClient();
  const {data, error} = await supabase
    .from('muc_tieu')
    .update({trang_thai: 'tra_lai', ly_do_tra_lai: note})
    .eq('id', id)
    .eq('cap', 'lop')
    .eq('trang_thai', 'gui')
    .select('id');
  if (error) return {ok: false, error: friendlyError(error)};
  if ((data ?? []).length === 0) return {ok: false, error: 'Mục tiêu này không còn chờ duyệt.'};
  revalidatePath('/[locale]/campus', 'page');
  revalidatePath('/[locale]/wig', 'page');
  return {ok: true};
}

// ── TẠO MỤC TIÊU CỦA CƠ SỞ (cap='truong') ────────────────────────────────────────────────────
//
// BGH tạo là DUYỆT NGAY (người tạo = người duyệt): insert với trang_thai='duyet' → trigger
// mt_truoc_them thấy duyet_duoc_chu_the('truong', campus) = true nên giữ 'duyet' và tự ký
// duyet_boi/duyet_at. campus_id lấy từ chính BGH (không tự chọn cơ sở khác).
//
// Bốn nguồn số của mục tiêu trường (40-C1): gộp con (nguon_so='con'), lấy tỉ lệ lớp đạt
// (kieu_dich='ti_le_dat', lay_tu='muc_tieu_lop'), lọc theo lĩnh vực / điểm danh (nguon_so=
// 'he_thong'), gộp thành phần (nguon_so='thanh_phan'). Việc NỐI con / thêm dòng thành phần đi
// qua action riêng (noiNguon / thành_phan) như phía em; ở đây chỉ đặt cấu hình của mục tiêu.
// Mọi CHECK (mt_nguon_ck, mt_ti_le_ck, mt_don_vi_ck…) là luật thật — action lo câu đẹp, DB bắt nốt.
export async function taoMucTieuTruong(formData: FormData) {
  const me = await myCampus();
  const campus_id = me.campus_id as string;

  const ten = String(formData.get('ten') ?? '').trim();
  if (!ten) flash('Đặt tên cho mục tiêu của cơ sở đã nhé.');
  if (ten.length > 200) flash('Tối đa 200 ký tự.');

  const linhVucRaw = String(formData.get('linh_vuc') ?? 'knowledge');
  const linh_vuc = ([...AREAS, 'khac'] as string[]).includes(linhVucRaw)
    ? (linhVucRaw as WigDomain)
    : ('knowledge' as WigDomain);

  const kieu_dich = String(formData.get('kieu_dich') ?? 'ti_le_dat'); // toi/tran_tich_luy/giu/toc_do_ky/ti_le_dat/chu
  const chieu = String(formData.get('chieu') ?? 'tang'); // tang/giam/giu
  const ky = String(formData.get('ky') ?? '').trim() || null; // tuan/hai_tuan/thang
  const don_vi_id = String(formData.get('don_vi_id') ?? '').trim() || null;
  const chua_do_x = String(formData.get('chua_do_x') ?? '') === '1';

  const soHoac = (k: string): number | null => {
    const raw = String(formData.get(k) ?? '').trim();
    if (raw === '') return null;
    const n = Number(raw);
    return Number.isFinite(n) ? n : null;
  };
  const x_so = soHoac('x_so');
  const y_so = soHoac('y_so');
  const x_chu = String(formData.get('x_chu') ?? '').trim() || null;
  const y_chu = String(formData.get('y_chu') ?? '').trim() || null;

  const ket_thuc = String(formData.get('ket_thuc') ?? '').trim();
  const bat_dau = String(formData.get('bat_dau') ?? '').trim();
  if (!isValidDayVN(ket_thuc)) flash('Chọn ngày cơ sở cần đạt.');
  if (bat_dau && isValidDayVN(bat_dau) && bat_dau > ket_thuc) flash('Ngày bắt đầu phải trước ngày đạt.');

  // Đích bằng lời cần y_chu; đích bằng số (kể cả tỉ lệ %) cần y_so. Đơn vị bắt buộc trừ
  // chu/ti_le_dat (CHECK mt_don_vi_ck).
  if (kieu_dich === 'chu') {
    if (!y_chu) flash('Cơ sở sẽ đạt được gì? Viết bằng lời.');
  } else {
    if (y_so === null || y_so <= 0) flash('Đích phải là số lớn hơn 0.');
    if (kieu_dich !== 'ti_le_dat' && !don_vi_id) flash('Chọn đơn vị (lớp, %, buổi…).');
  }

  // Nguồn số + phần phụ thuộc. Chỉ giữ giá trị khi đúng nhánh để không đá CHECK (mt_gop_tp_ck…).
  const nguonRaw = String(formData.get('nguon_so') ?? '').trim();
  const nguon_so = ['con', 'ghi_tay', 'he_thong', 'thanh_phan'].includes(nguonRaw)
    ? nguonRaw
    : 'ghi_tay';
  const gopConRaw = String(formData.get('gop_con') ?? '').trim();
  const gop_con =
    nguon_so === 'con'
      ? ['cong', 'trung_binh', 'ti_le_dat'].includes(gopConRaw)
        ? gopConRaw
        : 'ti_le_dat'
      : null;
  const gopTpRaw = String(formData.get('gop_thanh_phan') ?? '').trim();
  const gop_thanh_phan =
    nguon_so === 'thanh_phan'
      ? ['cong', 'trung_binh'].includes(gopTpRaw)
        ? gopTpRaw
        : 'trung_binh'
      : null;
  const nguong_con = soHoac('nguong_con');
  const layTuRaw = String(formData.get('lay_tu') ?? '').trim();
  const lay_tu =
    kieu_dich === 'ti_le_dat'
      ? ['thuoc', 'muc_tieu_em', 'muc_tieu_lop'].includes(layTuRaw)
        ? layTuRaw
        : 'muc_tieu_lop'
      : null;
  const nguon_he_thong = nguon_so === 'he_thong' ? 'diem_danh' : null;

  const supabase = await createClient();
  const {data, error} = await supabase
    .from('muc_tieu')
    .insert({
      cap: 'truong',
      campus_id,
      trang_thai: 'duyet',
      ten,
      linh_vuc,
      kieu_dich,
      chieu,
      ky,
      don_vi_id: kieu_dich === 'chu' || kieu_dich === 'ti_le_dat' ? null : don_vi_id,
      x_so: kieu_dich === 'chu' ? null : x_so,
      y_so: kieu_dich === 'chu' ? null : y_so,
      x_chu: kieu_dich === 'chu' ? x_chu : null,
      y_chu: kieu_dich === 'chu' ? y_chu : null,
      chua_do_x,
      bat_dau: isValidDayVN(bat_dau) ? bat_dau : todayInVN(),
      ket_thuc,
      nguon_so,
      gop_con,
      gop_thanh_phan,
      nguong_con: nguong_con !== null && Number.isFinite(nguong_con) ? nguong_con : null,
      lay_tu,
      nguon_he_thong,
    })
    .select('id')
    .maybeSingle();
  revalidatePath('/[locale]/campus', 'page');
  if (error) flash(loi(friendlyError(error)));
  flash(data ? 'Đã tạo mục tiêu của cơ sở' : loi('Không tạo được — bạn không có quyền với cơ sở này.'));
}

// GỠ một mục tiêu của cơ sở. Mục tiêu trường BGH tạo luôn ở 'duyet', mà policy XOÁ chỉ mở cho
// 'nhap'/'gui'/'tra_lai' — nên thử XOÁ trước (bản nháp chưa dây), không được thì ĐÓNG lại
// (ly_do_dong='bo') để giữ lịch sử cuộn của các lớp đã góp vào. Cả hai đường đều qua RLS cấp
// trường, id của cơ sở khác bắn vào cũng ra 0 dòng.
export async function xoaMucTieuTruong(formData: FormData) {
  await myCampus();
  const id = String(formData.get('muc_tieu_id') ?? '').trim();
  if (!id) flash('Thiếu mục tiêu cần gỡ');
  const supabase = await createClient();
  const {data: xoa, error: eXoa} = await supabase
    .from('muc_tieu')
    .delete()
    .eq('id', id)
    .eq('cap', 'truong')
    .select('id');
  if (eXoa) {
    revalidatePath('/[locale]/campus', 'page');
    flash(loi(friendlyError(eXoa)));
  }
  if (xoa && xoa.length > 0) {
    revalidatePath('/[locale]/campus', 'page');
    flash('Đã gỡ mục tiêu của cơ sở');
  }
  // Không xoá được (đã duyệt / có dữ liệu cuộn) → đóng lại thay vì để nguyên.
  const {data: dong, error: eDong} = await supabase
    .from('muc_tieu')
    .update({trang_thai: 'dong', ly_do_dong: 'bo'})
    .eq('id', id)
    .eq('cap', 'truong')
    .neq('trang_thai', 'dong')
    .select('id');
  revalidatePath('/[locale]/campus', 'page');
  if (eDong) flash(loi(friendlyError(eDong)));
  flash(
    dong && dong.length > 0
      ? 'Đã đóng mục tiêu của cơ sở'
      : loi('Không gỡ được — bạn không có quyền với mục tiêu này.'),
  );
}

// ── LỊCH TUẦN HỌC (bảng tuan_hoc) ────────────────────────────────────────────────────────────
//
// Mỗi cơ sở tự khai tuần nào NGHỈ, tuần nào THI; còn lại mặc định là tuần học. Nhận LOẠI ĐÍCH
// tường minh (không "kế tiếp") để hai lần bấm nhanh không chồng nhau ra một kết quả bất ngờ.
// loai='hoc' nghĩa là trở về mặc định → XOÁ dòng cho gọn (mọi phép tính coi vắng mặt = tuần học).
//
// TRẢ về loại đã đặt để client (LichTuanHoc) hoàn màu, KHÔNG redirect: lưới 52 ô bấm liên tục,
// mỗi lần nhảy trang là hỏng. Đổi một tuần ĐÃ QUA sẽ tính lại thắng/thua của mọi lớp trong cơ sở
// — client đã hỏi lại bằng Popup (coSoMucTieu.lichQuaKhu) trước khi gọi; ở đây ghi vết kiểm toán.
export async function datTuanHoc(formData: FormData): Promise<TuanHocState> {
  const me = await requireRole(['principal', 'admin']);
  const campus_id = me.campus_id;
  if (!campus_id) return {ok: false, error: 'Tài khoản của bạn chưa được gán cơ sở.'};
  const raw = String(formData.get('week_start') ?? '').trim();
  const loai = String(formData.get('loai') ?? '').trim();
  const daQua = String(formData.get('da_qua') ?? '') === 'true';
  if (!isValidDayVN(raw)) return {ok: false, error: 'Thiếu tuần cần đặt.'};
  if (!['hoc', 'nghi', 'thi'].includes(loai)) return {ok: false, error: 'Loại tuần không hợp lệ.'};
  const week_start = mondayOf(raw);

  // Chặn tuần ngoài năm học (40-G). Neo mốc dưới về thứ Hai của tuần chứa ngày đầu năm học, để
  // tuần đầu tiên (thứ Hai có thể rơi vào cuối tháng 6) không bị loại nhầm.
  const nam = schoolYearRangeVN();
  if (week_start < mondayOf(nam.start) || week_start > nam.end)
    return {ok: false, error: 'Tuần này không thuộc năm học đang mở.'};

  const supabase = await createClient();
  const {error} =
    loai === 'hoc'
      ? await supabase.from('tuan_hoc').delete().eq('campus_id', campus_id).eq('week_start', week_start)
      : await supabase
          .from('tuan_hoc')
          .upsert({campus_id, week_start, loai}, {onConflict: 'campus_id,week_start'});
  if (error) return {ok: false, error: friendlyError(error)};

  if (daQua && week_start < weekRangeVN().start) {
    await supabase.rpc('log_audit', {
      p_action: 'doi_tuan_hoc_qua_khu',
      p_detail: {campus: campus_id, week_start, loai},
    });
  }
  revalidatePath('/[locale]/campus', 'page');
  return {ok: true, loai};
}

// ── NHẬP HỘ (classes.nhap_ho) ────────────────────────────────────────────────────────────────
//
// Bật cho lớp nhỏ (khối 1–3): thầy cô nhập mục tiêu / việc / cam kết / biên bản giúp em; chữ ký
// buổi họp vẫn là của em hoặc bạn em. protect_class_privileged_cols (20 §2.15) mở đúng vế này
// cho BGH cùng cơ sở + admin [H-15] — RLS là thứ chặn thật, đây chỉ là cái công tắc, và ghi vết
// vì đây là quyền được nới ("ai bật").
export async function toggleNhapHo(formData: FormData) {
  await myCampus();
  const class_id = String(formData.get('class_id') ?? '').trim();
  const bat = String(formData.get('bat') ?? '') === 'true';
  if (!class_id) flash('Thiếu lớp');
  const supabase = await createClient();
  const {data, error} = await supabase
    .from('classes')
    .update({nhap_ho: bat})
    .eq('id', class_id)
    .select('id');
  if (!error && data && data.length > 0) {
    await supabase.rpc('log_audit', {
      p_action: bat ? 'principal_bat_nhap_ho' : 'principal_tat_nhap_ho',
      p_detail: {class: class_id},
    });
  }
  revalidatePath('/[locale]/campus', 'page');
  if (error) flash(loi(friendlyError(error)));
  if (!data || data.length === 0) flash(loi('Không đổi được — bạn không có quyền với lớp này.'));
  flash(bat ? 'Đã bật nhập hộ cho lớp' : 'Đã tắt nhập hộ');
}

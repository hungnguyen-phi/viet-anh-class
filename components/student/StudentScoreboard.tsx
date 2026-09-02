import {getLocale, getTranslations} from 'next-intl/server';
import {headers} from 'next/headers';
import {createClient} from '@/lib/supabase/server';
import type {Profile} from '@/lib/auth';
import {clientIp} from '@/lib/ip';
import {getAreaMeta} from '@/lib/area-config';
import {AREAS, areaLabel} from '@/lib/areas';
import {
  todayInVN,
  isoWeekLabel,
  weekDaysVN,
  vnNoon,
  mondayOf,
  isValidDayVN,
  shiftWeeks,
  khoangTuan,
} from '@/lib/dates';
import {MoodCheckin, MoodGate, type MoodKey} from '@/components/student/MoodCheckin';
import {FlashToast} from '@/components/ui/FlashToast';
import {ChonTuanCuaEm} from '@/components/student/ChonTuanCuaEm';
import {HopPdr, type PdrMeeting} from '@/components/student/HopPdr';
import {MyRequests, type MyRequest} from '@/components/student/MyRequests';
import {RequestInbox, type EditRequest} from '@/components/student/RequestInbox';
import {tenHienThi} from '@/lib/ten-hien-thi';
import {MucTieuCuaCon} from '@/components/student/MucTieuCuaCon';
import {MucTieuLopChoEm, type MucTieuLopThe} from '@/components/student/MucTieuLopChoEm';
import type {DonViChon, MucTieuLopChon, MauMucTieu, BuocThe} from '@/components/student/FormMucTieu';
import {BangEmPA2, type ViecEm, type ViecTuan, type CamKetEm} from '@/components/student/BangEmPA2';
import type {Database} from '@/lib/database.types';

type MucTieuV = Database['public']['Views']['muc_tieu_v']['Row'];

// ── MÀN CỦA EM (PA2) ──────────────────────────────────────────────────────────────────────────
//
// Container đọc mô hình MỤC TIÊU mới rồi bày sáu khu dọc, đúng ở 360px:
//   ① Hero + điểm danh cảm xúc  (GIỮ NGUYÊN khối cũ — không đổi bản sắc)
//   ② Băng rôn 5 giây           (bang_ron — bày ngay ở máy chủ, không cần client)
//   ③ Mục tiêu của em           (<MucTieuCuaCon> đọc muc_tieu_v — đã viết lại)
//   ④ Việc + ⑤ Cam kết          (<BangEmPA2> đọc viec_bang/cam_ket_v — có ghi)
//   ⑥ Họp của em                (<HopPdr> — giữ)
//   ⑦ Yêu cầu sửa               (<MyRequests>/<RequestInbox> — giữ)
//
// Số liệu KHÔNG tự cộng ở đây (L12): mọi con số đi qua hàm/khung nhìn CSDL —
//   bang_ron() · muc_tieu_v · viec_bang()+thuoc_12_tuan() · cam_ket_v · luot (của chính em).
export async function StudentScoreboard({
  studentId,
  viewer,
  flash,
  weekParam,
  pathname,
}: {
  studentId: string;
  viewer: Profile;
  flash?: string;
  /** ?week= — tuần đang xem (bất kỳ ngày nào trong tuần); thiếu = tuần chứa hôm nay. */
  weekParam?: string;
  /** Đường dẫn của trang đang nhúng, để thanh tuần đổi ?week= tại chỗ. */
  pathname: string;
}) {
  const t = await getTranslations('student');
  const tm = await getTranslations('meeting');
  const tBang = await getTranslations('bangEm');
  const tTuan = await getTranslations('tuan');
  const supabase = await createClient();
  const canManage = viewer.role === 'teacher' || viewer.role === 'admin';
  const canEditMood = viewer.id === studentId && viewer.role === 'student';
  const canTick = viewer.id === studentId && viewer.role === 'student';

  const today = todayInVN();
  const thisMonday = mondayOf(today);
  const monday = isValidDayVN(weekParam) ? mondayOf(weekParam!) : thisMonday;
  const weekDays = weekDaysVN(monday);
  const nhanTuan = isoWeekLabel(vnNoon(monday));

  // ── ĐỢT MỘT: mọi thứ chỉ cần studentId/monday (đã biết ngay từ tham số) ─────────────────────
  const [
    {data: student},
    {data: enr},
    {data: moodRow},
    bangRonRes,
    mucTieuRes,
    viecRes,
    camKetRes,
    donViRes,
    pdrBuddyRes,
    pdrCoachRes,
    capRes,
    lichCoachRes,
    {data: myRequestRows},
    {data: reqs},
  ] = await Promise.all([
    supabase.from('profiles').select('id, full_name, email').eq('id', studentId).maybeSingle(),
    supabase
      .from('enrollments')
      .select('class_id, classes(name, school_year, campus_id)')
      .eq('student_id', studentId)
      .eq('is_active', true)
      .order('class_id')
      .limit(1)
      .maybeSingle(),
    supabase.from('mood_checkins').select('mood, buoi, created_at').eq('student_id', studentId).eq('date', today),
    supabase.rpc('bang_ron', {p_student: studentId}),
    supabase.from('muc_tieu_v').select('*').eq('student_id', studentId).eq('cap', 'em').order('created_at'),
    supabase.rpc('viec_bang', {p_student: studentId}),
    supabase
      .from('cam_ket_v')
      .select(
        'id, noi_dung, trang_thai, ket_qua, so_hua, so_dat, ten_don_vi, so_tuan, tuan_bat_dau, tuan_ket_thuc, xong_at, goi_y_may, so_dat_goi_y, muc_tieu_id, thuoc_id, lac_muc_tieu',
      )
      .eq('student_id', studentId),
    supabase.from('don_vi').select('id, ma, nhan_vi, nhan_en').eq('is_active', true).order('ma'),
    supabase
      .from('pdr_meetings')
      .select('id, week_label, q1_plan, q2_result, q3_obstacle, q4_overcome, q5_better_way, q6_commitment, acknowledged_at')
      .eq('student_id', studentId)
      .eq('type', 'buddy')
      .eq('week_label', nhanTuan)
      .maybeSingle(),
    supabase
      .from('pdr_meetings')
      .select('id, week_label, q1_plan, q2_result, q3_obstacle, q4_overcome, q5_better_way, q6_commitment, acknowledged_at')
      .eq('student_id', studentId)
      .eq('type', 'coach')
      .eq('week_label', nhanTuan)
      .maybeSingle(),
    supabase
      .from('buddy_pairs')
      .select('id, student_id, buddy_id')
      .eq('is_active', true)
      .or(`student_id.eq.${studentId},buddy_id.eq.${studentId}`)
      .order('created_at'),
    supabase
      .from('pdr_schedules')
      .select('monthly_day')
      .eq('student_id', studentId)
      .eq('type', 'coach')
      .eq('is_active', true)
      .maybeSingle(),
    canTick
      ? supabase
          .from('edit_requests')
          .select('id, kind, ref_id, message')
          .eq('requester_id', viewer.id)
          .eq('status', 'pending')
          .order('created_at', {ascending: false})
      : Promise.resolve({data: null}),
    canManage
      ? supabase
          .from('edit_requests')
          .select('id, kind, ref_id, message, created_at, requester:profiles!edit_requests_requester_id_fkey(full_name)')
          .eq('student_id', studentId)
          .eq('status', 'pending')
          .order('created_at', {ascending: false})
      : Promise.resolve({data: null}),
  ]);

  if (!student) {
    return (
      <div className="animate-rise glass mt-4 rounded-[26px] p-10 text-center">
        <p className="text-sm font-semibold text-grey-mid">{t('notFound')}</p>
      </div>
    );
  }

  const enrRow = enr as unknown as {
    class_id: string;
    classes: {name: string; school_year: string; campus_id: string | null} | null;
  } | null;
  const cls = enrRow?.classes;
  const classId = enrRow?.class_id ?? null;
  const campusId = cls?.campus_id ?? null;

  const moodSang = (moodRow ?? []).find((r) => r.buoi === 'sang') ?? null;
  const moodChieu = (moodRow ?? []).find((r) => r.buoi === 'chieu') ?? null;
  const mood = (moodSang?.mood ?? null) as MoodKey | null;

  // ── Nhãn + màu 4 lĩnh vực (area_config) cho khối Mục tiêu ───────────────────────────────────
  const [areaMeta, locale] = await Promise.all([getAreaMeta(), getLocale()]);
  const nhanTheoArea = Object.fromEntries(AREAS.map((a) => [a, areaLabel(areaMeta[a], locale)]));
  const mauTheoArea = Object.fromEntries(AREAS.map((a) => [a, {hex: areaMeta[a].hex, soft: areaMeta[a].soft}]));

  const mtRows = (mucTieuRes.data ?? []) as MucTieuV[];
  const tenMucTieuTheoId = new Map(mtRows.map((m) => [m.id ?? '', m.ten ?? '']));
  const wigDaDuyet = mtRows.filter((m) => m.trang_thai === 'duyet').map((m) => ({id: m.id ?? '', title: m.ten ?? ''}));

  const donViList: DonViChon[] = ((donViRes.data ?? []) as {id: string; ma: string; nhan_vi: string; nhan_en: string}[]).map(
    (d) => ({id: d.id, ma: d.ma, nhan: locale === 'vi' ? d.nhan_vi : d.nhan_en}),
  );

  // ── Việc em làm: viec_bang + 12 tuần + 7 ô ngày (luot của chính em) ─────────────────────────
  type ViecRow = {
    thuoc_id: string;
    ten: string | null;
    ten_don_vi: string | null;
    cach_ghi: string | null;
    chieu_dich: string | null;
    chi_tieu: number | null;
    ky_tuan: number | null;
    dat: boolean | null;
    gia: number | null;
    trang_thai: string | null;
    ngay_ap_dung: number[] | null;
    cho_bu: boolean | null;
    chi_xem: boolean | null;
  };
  const viecRows = (viecRes.data ?? []) as ViecRow[];
  const thuocIds = viecRows.map((v) => v.thuoc_id);
  const tenViecTheoThuoc = new Map(viecRows.map((v) => [v.thuoc_id, v.ten ?? '']));

  // ── ĐỢT HAI: cần thuocIds / classId / campusId đã biết sau đợt một ──────────────────────────
  const canGoiCong = canEditMood && mood === null;
  const ipHienTai = canGoiCong ? clientIp(await headers()) : null;
  const {createAdminClient} = canGoiCong || campusId ? await import('@/lib/supabase/admin') : {createAdminClient: null};
  const admin = createAdminClient ? createAdminClient() : null;

  const [
    luotRes,
    tuanHocRes,
    mucTieuLopRes,
    mauRes,
    cuaSoRes,
    ipRes,
    mangRes,
    tenBuddyRes,
    lichBuddyRes,
    buocRes,
    ...tuan12Res
  ] = await Promise.all([
    thuocIds.length > 0
      ? supabase
          .from('luot')
          .select('thuoc_id, ngay, gia_tri')
          .in('thuoc_id', thuocIds)
          .eq('student_id', studentId)
          .gte('ngay', weekDays[0])
          .lte('ngay', weekDays[6])
      : Promise.resolve({data: null}),
    campusId
      ? supabase.from('tuan_hoc').select('loai').eq('campus_id', campusId).eq('week_start', monday).maybeSingle()
      : Promise.resolve({data: null}),
    // Mục tiêu lớp đã duyệt — em NHÌN thấy % chung (cùng view muc_tieu_v với cô) + làm menu hướng vào.
    classId
      ? supabase
          .from('muc_tieu_v')
          .select('id, ten, linh_vuc, loai_moc, pct, so, y_so, don_vi_id, ten_don_vi, ket_thuc')
          .eq('class_id', classId)
          .eq('cap', 'lop')
          .eq('trang_thai', 'duyet')
      : Promise.resolve({data: null}),
    // Mẫu mục tiêu của lớp — em chọn rồi chỉ điền số.
    classId
      ? supabase
          .from('muc_tieu_mau')
          .select('id, ten, linh_vuc, subject_id, don_vi_id, kieu_dich, chieu, x_goi_y, y_goi_y')
          .eq('class_id', classId)
          .eq('is_active', true)
          .order('created_at')
      : Promise.resolve({data: null}),
    admin && campusId ? admin.rpc('checkin_windows', {p_campus: campusId}) : Promise.resolve({data: null}),
    admin && canGoiCong ? admin.rpc('ip_allowed', {p_ip: ipHienTai ?? ''}) : Promise.resolve({data: null}),
    admin && canGoiCong ? admin.rpc('truong_da_khai_mang') : Promise.resolve({data: null}),
    (capRes.data ?? []).length > 0
      ? supabase
          .from('profiles')
          .select('id, full_name, email')
          .in(
            'id',
            (capRes.data ?? []).map((p) => (p.student_id === studentId ? p.buddy_id : p.student_id)),
          )
      : Promise.resolve({data: null}),
    (capRes.data ?? []).length > 0
      ? supabase
          .from('pdr_schedules')
          .select('weekday, time_slot')
          .in(
            'buddy_pair_id',
            (capRes.data ?? []).map((p) => p.id),
          )
          .eq('is_active', true)
          .limit(1)
          .maybeSingle()
      : Promise.resolve({data: null}),
    // Các bước của mục tiêu KẾ HOẠCH — để form sửa hiện lại bước cũ (không bắt em nhập lại).
    (() => {
      const keIds = mtRows.filter((m) => m.loai_moc === 'ke_hoach').map((m) => m.id).filter(Boolean) as string[];
      return keIds.length > 0
        ? supabase
            .from('buoc')
            .select('id, muc_tieu_id, tieu_de, phan_tram, bat_dau, ket_thuc, mo_ta, xong_at')
            .in('muc_tieu_id', keIds)
            .order('thu_tu')
        : Promise.resolve({data: null});
    })(),
    ...thuocIds.map((id) => supabase.rpc('thuoc_12_tuan', {p_thuoc: id, p_chu_the: studentId, p_tuan_cuoi: monday})),
  ]);

  // Gộp bước theo mục tiêu → vừa cho form sửa (khỏi nhập lại), vừa cho checklist trên thẻ (tick).
  const buocTheoMt: Record<string, BuocThe[]> = {};
  for (const b of (buocRes.data ?? []) as {
    id: string;
    muc_tieu_id: string;
    tieu_de: string;
    phan_tram: number;
    bat_dau: string | null;
    ket_thuc: string | null;
    mo_ta: string | null;
    xong_at: string | null;
  }[]) {
    (buocTheoMt[b.muc_tieu_id] ??= []).push({
      id: b.id,
      tieu_de: b.tieu_de,
      phan_tram: Number(b.phan_tram),
      bat_dau: b.bat_dau,
      ket_thuc: b.ket_thuc,
      mo_ta: b.mo_ta,
      xong: b.xong_at != null,
    });
  }

  const mucTieuLopRows = (mucTieuLopRes.data ?? []) as {
    id: string | null;
    ten: string | null;
    linh_vuc: string | null;
    loai_moc: string | null;
    pct: number | null;
    so: number | null;
    y_so: number | null;
    don_vi_id: string | null;
    ten_don_vi: string | null;
    ket_thuc: string | null;
  }[];
  const mucTieuLop: MucTieuLopChon[] = mucTieuLopRows.map((m) => ({
    id: m.id ?? '',
    ten: m.ten ?? '',
    linh_vuc: m.linh_vuc ?? 'knowledge',
  }));
  // Danh sách cho ô "hướng tới mục tiêu" của cam kết em — kèm đơn vị (ràng buộc: có số phải có đơn vị).
  const mucTieuLopCk = mucTieuLopRows.map((m) => ({
    id: m.id ?? '',
    ten: m.ten ?? '',
    don_vi_id: m.don_vi_id,
    ten_don_vi: m.ten_don_vi,
  }));
  // Bản đầy đủ (kèm %) để em NHÌN thấy mục tiêu lớp — chính con số cô thấy.
  const mucTieuLopThe: MucTieuLopThe[] = mucTieuLopRows.map((m) => ({
    id: m.id ?? '',
    ten: m.ten ?? '',
    linh_vuc: m.linh_vuc ?? 'knowledge',
    loai_moc: m.loai_moc,
    pct: m.pct,
    so: m.so,
    y_so: m.y_so,
    ten_don_vi: m.ten_don_vi,
    ket_thuc: m.ket_thuc,
  }));
  const mauList = (mauRes.data ?? []) as MauMucTieu[];

  // Gộp luot theo (thuoc, ngày).
  const luotTheoThuoc: Record<string, Record<string, number>> = {};
  for (const r of (luotRes.data ?? []) as {thuoc_id: string; ngay: string; gia_tri: number}[]) {
    (luotTheoThuoc[r.thuoc_id] ??= {})[r.ngay] = (luotTheoThuoc[r.thuoc_id][r.ngay] ?? 0) + Number(r.gia_tri ?? 0);
  }

  const viec: ViecEm[] = viecRows.map((v, i) => {
    const tuan12 = ((tuan12Res[i]?.data ?? []) as {
      tuan: string;
      gia: number;
      chi_tieu: number;
      dat: boolean;
      trang_thai: string;
      la_tuan_hoc: boolean;
    }[]).map<ViecTuan>((w) => ({
      tuan: w.tuan,
      gia: Number(w.gia ?? 0),
      chi_tieu: Number(w.chi_tieu ?? 0),
      dat: Boolean(w.dat),
      trang_thai: w.trang_thai,
      la_tuan_hoc: Boolean(w.la_tuan_hoc),
    }));
    return {
      thuoc_id: v.thuoc_id,
      ten: v.ten ?? '',
      ten_don_vi: v.ten_don_vi,
      cach_ghi: v.cach_ghi ?? 'cham',
      chieu_dich: v.chieu_dich ?? 'it_nhat',
      chi_tieu: Number(v.chi_tieu ?? 0),
      ky_tuan: Number(v.ky_tuan ?? 1),
      dat: Boolean(v.dat),
      gia: Number(v.gia ?? 0),
      trang_thai: v.trang_thai ?? 'dang_thang',
      ngay_ap_dung: v.ngay_ap_dung ?? [1, 2, 3, 4, 5, 6, 7],
      cho_bu: Boolean(v.cho_bu),
      chi_xem: Boolean(v.chi_xem),
      muoiHaiTuan: tuan12,
      ngayLuot: luotTheoThuoc[v.thuoc_id] ?? {},
    };
  });

  // ── Cam kết tuần đang xem ────────────────────────────────────────────────────────────────────
  type CkRow = {
    id: string;
    noi_dung: string | null;
    trang_thai: string | null;
    ket_qua: string | null;
    so_hua: number | null;
    so_dat: number | null;
    ten_don_vi: string | null;
    so_tuan: number | null;
    tuan_bat_dau: string | null;
    tuan_ket_thuc: string | null;
    xong_at: string | null;
    goi_y_may: string | null;
    so_dat_goi_y: number | null;
    muc_tieu_id: string | null;
    thuoc_id: string | null;
    lac_muc_tieu: boolean | null;
  };
  const themNgay = (s: string, delta: number) => {
    const d = new Date(s + 'T12:00:00Z');
    d.setUTCDate(d.getUTCDate() + delta);
    return d.toISOString().slice(0, 10);
  };
  const camKet: CamKetEm[] = ((camKetRes.data ?? []) as CkRow[])
    .filter((c) => {
      if (!c.tuan_bat_dau) return false;
      const end = c.tuan_ket_thuc ?? themNgay(c.tuan_bat_dau, (Math.max(1, c.so_tuan ?? 1) - 1) * 7);
      return c.tuan_bat_dau <= monday && end >= monday;
    })
    .map((c) => ({
      id: c.id,
      noi_dung: c.noi_dung ?? '',
      trang_thai: c.trang_thai ?? 'hieu_luc',
      ket_qua: c.ket_qua,
      so_hua: c.so_hua,
      so_dat: c.so_dat,
      ten_don_vi: c.ten_don_vi,
      so_tuan: Number(c.so_tuan ?? 1),
      tuan_bat_dau: c.tuan_bat_dau ?? monday,
      tuan_ket_thuc: c.tuan_ket_thuc,
      xong_at: c.xong_at,
      goi_y_may: c.goi_y_may,
      so_dat_goi_y: c.so_dat_goi_y,
      muc_tieu_id: c.muc_tieu_id,
      thuoc_id: c.thuoc_id,
      lac_muc_tieu: c.lac_muc_tieu,
      tenMucTieu: c.muc_tieu_id ? tenMucTieuTheoId.get(c.muc_tieu_id) ?? null : null,
      tenViec: c.thuoc_id ? tenViecTheoThuoc.get(c.thuoc_id) ?? null : null,
    }));

  // ── Băng rôn (② — bày ở máy chủ, không cần client) ──────────────────────────────────────────
  const bangRonRaw = Array.isArray(bangRonRes.data) ? bangRonRes.data[0] : bangRonRes.data;
  const tuanNghi = (tuanHocRes.data as {loai: string} | null)?.loai === 'nghi';
  const bangRon = <BangRon raw={bangRonRaw} tuanNghi={tuanNghi} tBang={tBang} tTuan={tTuan} />;

  const daChotHopTuan = Boolean(pdrBuddyRes.data?.acknowledged_at);

  // ── Check-in cảm xúc (giữ nguyên cổng cũ) ────────────────────────────────────────────────────
  const cuaSoRaw = Array.isArray(cuaSoRes.data) ? cuaSoRes.data[0] : cuaSoRes.data;
  const cuaSo = cuaSoRaw
    ? {
        moLuc: cuaSoRaw.mo_luc,
        hetDungGio: cuaSoRaw.het_dung_gio,
        hetMuon: cuaSoRaw.het_muon,
        chieuMo: cuaSoRaw.chieu_mo,
        chieuDong: cuaSoRaw.chieu_dong,
      }
    : null;
  const mustCheckin = mangRes.data === true && ipRes.data === true;

  const dayShort = t.raw('dayShort') as string[];
  const displayName = tenHienThi(student.full_name, student.email);

  // ── HopPdr props ─────────────────────────────────────────────────────────────────────────────
  const idBuddy = (capRes.data ?? []).map((p) => (p.student_id === studentId ? p.buddy_id : p.student_id));
  const tenCua = new Map(
    ((tenBuddyRes.data ?? []) as {id: string; full_name: string | null; email: string}[]).map((p) => [
      p.id,
      tenHienThi(p.full_name, p.email),
    ]),
  );
  const tenBuddy = idBuddy.map((id) => tenCua.get(id) ?? '—');
  const lichData = lichBuddyRes.data as {weekday: number | null; time_slot: string | null} | null;
  const lichBuddy = lichData?.weekday
    ? `${lichData.weekday === 8 ? 'CN' : `T${lichData.weekday}`}${lichData.time_slot ? ` · ${String(lichData.time_slot).slice(0, 5)}` : ''}`
    : null;

  const nhanBienBan = (r: typeof pdrBuddyRes.data): PdrMeeting | null =>
    r
      ? {
          id: r.id,
          week_label: r.week_label,
          q1_plan: r.q1_plan,
          q2_result: r.q2_result,
          q3_obstacle: r.q3_obstacle,
          q4_overcome: r.q4_overcome,
          q5_better_way: r.q5_better_way,
          q6_commitment: r.q6_commitment,
          acknowledged_at: r.acknowledged_at,
        }
      : null;

  const laTuanNay = monday === thisMonday;
  const moGhiPdr = monday === thisMonday || monday === shiftWeeks(thisMonday, -1);
  const tuanSauPdr = isoWeekLabel(vnNoon(shiftWeeks(monday, 1)));

  const myRequests: MyRequest[] = (
    (myRequestRows ?? []) as {id: string; kind: string; ref_id: string | null; message: string | null}[]
  ).map((r) => ({...r, leadTitle: null}));
  let requests: EditRequest[] = [];
  if (canManage) {
    requests = (
      (reqs ?? []) as unknown as {
        id: string;
        kind: string;
        ref_id: string | null;
        message: string | null;
        created_at: string;
        requester: {full_name: string | null} | null;
      }[]
    ).map((r) => ({
      id: r.id,
      kind: r.kind,
      ref_id: r.ref_id,
      message: r.message,
      requesterName: r.requester?.full_name ?? null,
      createdAt: r.created_at,
    }));
  }

  return (
    <div className="mt-4 flex flex-col gap-[22px]">
      {mustCheckin && <MoodGate />}
      {flash && <FlashToast message={flash} />}

      {/* ① HERO + ĐIỂM DANH CẢM XÚC (giữ nguyên) */}
      <div className="animate-rise grid grid-cols-1 overflow-hidden rounded-[26px] glass md:grid-cols-2">
        <div className="flex items-center gap-[18px] p-7">
          <span className="animate-pop grid h-[72px] w-[72px] shrink-0 place-items-center rounded-[22px] bg-linear-to-b from-gold-soft to-gold font-display text-[28px] font-bold text-navy shadow-[var(--shadow-gold)]">
            ★
          </span>
          <div className="min-w-0">
            <div className="text-[12px] font-extrabold uppercase tracking-[0.04em] text-gold-text">{t('title')}</div>
            <h1 className="font-display text-[30px] font-bold leading-[1.15] text-navy">
              {t('hello', {name: displayName})}
            </h1>
            {cls && (
              <div className="mt-0.5 text-[13.5px] font-bold text-txt">
                {cls.name} · {cls.school_year}
              </div>
            )}
          </div>
        </div>
        <div className="border-t border-navy/[0.08] p-6 md:border-l md:border-t-0">
          <MoodCheckin
            initialMood={mood}
            initialMoodChieu={(moodChieu?.mood ?? null) as MoodKey | null}
            canEdit={canEditMood}
            gated={mustCheckin}
            gioBam={moodSang?.created_at ?? null}
            gioBamChieu={moodChieu?.created_at ?? null}
            cuaSo={cuaSo}
          />
        </div>
      </div>

      {/* Thanh tuần — điều khiển ② → ⑥ */}
      <ChonTuanCuaEm
        pathname={pathname}
        monday={monday}
        thisMonday={thisMonday}
        label={nhanTuan}
        start={weekDays[0]}
        end={weekDays[6]}
      />

      {/* ② BĂNG RÔN */}
      {bangRon}

      {/* ③a MỤC TIÊU CỦA LỚP — em nhìn thấy % chung (đích cả lớp cùng đẩy). Chỉ đọc. */}
      {classId && mucTieuLopThe.length > 0 ? (
        <section>
          <h2 className="mb-1 font-display text-[17px] font-bold text-navy">{tBang('khuMucTieuLop')}</h2>
          <p className="mb-3 text-[12.5px] font-semibold text-grey-mid">{tBang('mucTieuLopNhac')}</p>
          <MucTieuLopChoEm mucTieu={mucTieuLopThe} mauTheoArea={mauTheoArea} nhanTheoArea={nhanTheoArea} />
        </section>
      ) : null}

      {/* ③ MỤC TIÊU CỦA EM */}
      {classId ? (
        <section>
          <h2 className="mb-3 font-display text-[17px] font-bold text-navy">{tBang('khuMucTieu')}</h2>
          <MucTieuCuaCon
            studentId={studentId}
            classId={classId}
            mucTieu={mtRows}
            laChinhEm={canTick}
            canManage={canManage}
            namHoc={cls?.school_year ?? null}
            nhanTheoArea={nhanTheoArea}
            mauTheoArea={mauTheoArea}
            donViList={donViList}
            mucTieuLop={mucTieuLop}
            buocTheoMt={buocTheoMt}
            mauList={mauList}
          />
        </section>
      ) : null}

      {/* ④ VIỆC + ⑤ CAM KẾT */}
      <BangEmPA2
        laChinhEm={canTick}
        studentId={studentId}
        classId={classId ?? ''}
        viec={viec}
        camKet={camKet}
        weekDays={weekDays}
        today={today}
        monday={monday}
        thisMonday={thisMonday}
        tuanNghi={tuanNghi}
        daChotHopTuan={daChotHopTuan}
        dayShort={dayShort}
        mucTieuLop={mucTieuLopCk}
      />

      {/* ⑥ HỌP CỦA EM */}
      <section className="flex flex-col gap-3">
        <h2 className="font-display text-[17px] font-bold text-navy">{t('meetings')}</h2>
        <HopPdr
          laChinhEm={canTick}
          tenBuddy={tenBuddy}
          lich={lichBuddy}
          bienBan={nhanBienBan(pdrBuddyRes.data)}
          wigDaDuyet={wigDaDuyet}
          weekLabel={nhanTuan}
          weekStart={monday}
          laTuanNay={laTuanNay}
          moGhi={moGhiPdr}
          khoangNgay={khoangTuan(nhanTuan)}
          tuanSau={tuanSauPdr}
        />
        {lichCoachRes.data && (
          <HopPdr
            loai="coach"
            laChinhEm={canTick}
            tenBuddy={[tm('gvcnLabel')]}
            lich={tm('coachDay', {d: lichCoachRes.data.monthly_day ?? 0})}
            bienBan={nhanBienBan(pdrCoachRes.data)}
            wigDaDuyet={wigDaDuyet}
            weekLabel={nhanTuan}
            weekStart={monday}
            laTuanNay={laTuanNay}
            moGhi={moGhiPdr}
            khoangNgay={khoangTuan(nhanTuan)}
            tuanSau={tuanSauPdr}
          />
        )}
      </section>

      {/* ⑦ YÊU CẦU SỬA */}
      {canTick && <MyRequests studentId={studentId} requests={myRequests} />}
      {canManage && <RequestInbox studentId={studentId} requests={requests} />}
    </div>
  );
}

// ── ② BĂNG RÔN (server) ───────────────────────────────────────────────────────────────────────
function BangRon({
  raw,
  tuanNghi,
  tBang,
  tTuan,
}: {
  raw: {trang_thai: string; viec_dung_nhip: number; viec_tong: number; ck_giu: number; ck_tong: number} | null;
  tuanNghi: boolean;
  tBang: Awaited<ReturnType<typeof getTranslations<'bangEm'>>>;
  tTuan: Awaited<ReturnType<typeof getTranslations<'tuan'>>>;
}) {
  if (tuanNghi) {
    return (
      <div className="rounded-[16px] border border-navy/10 bg-white/60 px-4 py-3 text-[13px] font-semibold text-txt">
        {tTuan('nghiBanner')}
      </div>
    );
  }
  if (!raw || raw.trang_thai === 'chua_co') {
    return (
      <div className="rounded-[16px] border border-navy/10 bg-white/60 px-4 py-3">
        <div className="text-[14px] font-extrabold text-navy">{tBang('chuaCo')}</div>
        <p className="mt-0.5 text-[12.5px] text-grey-mid">{tBang('chuaCoHint')}</p>
      </div>
    );
  }
  const meta: Record<string, {nhan: string; nen: string; chu: string; vien: string}> = {
    dang_thang: {nhan: tBang('thang'), nen: 'bg-success/[0.12]', chu: 'text-success-dark', vien: 'border-success/40'},
    sat_nut: {nhan: tBang('satNut'), nen: 'bg-gold/[0.15]', chu: 'text-gold-text', vien: 'border-gold/50'},
    can_co: {nhan: tBang('canCo'), nen: 'bg-status-bad/[0.08]', chu: 'text-status-bad', vien: 'border-status-bad/40'},
  };
  const m = meta[raw.trang_thai] ?? meta.can_co;
  return (
    <div className={`rounded-[16px] border ${m.vien} ${m.nen} px-4 py-3`}>
      <div className={`font-display text-[18px] font-extrabold tracking-wide ${m.chu}`}>{m.nhan}</div>
      <p className="mt-0.5 text-[12.5px] font-semibold text-txt">
        {tBang('tomTat', {du: raw.viec_dung_nhip, tong: raw.viec_tong, giu: raw.ck_giu, ck: raw.ck_tong})}
      </p>
    </div>
  );
}

import {getTranslations, setRequestLocale} from 'next-intl/server';
import {ArrowLeft, ArrowRight, Check, X, CalendarDays, Trash2, Lock} from 'lucide-react';
import {requireRole} from '@/lib/auth';
import {createClient} from '@/lib/supabase/server';
import {KhongCoLop} from '@/components/ui/KhongCoLop';
import {getClassContext} from '@/lib/queries';
import {ClassPicker} from '@/components/shell/ClassPicker';
import {ClassOwnerNote} from '@/components/shell/ClassOwnerNote';
import {Link} from '@/i18n/navigation';
import {isValidDayVN, mondayOf, todayInVN, weekFromMonday, shiftWeeks, ngayVN, weekDaysVN} from '@/lib/dates';
import {AREAS, areaLabel, type Area} from '@/lib/areas';
import {getAreaMeta} from '@/lib/area-config';
import {Flash} from '@/components/ui/Flash';
import {BangCacEm} from '@/components/wig/BangCacEm';
import {NutTaoMucTieuLop} from '@/components/wig/NutTaoMucTieuLop';
import {NutTaoMucTieuToi} from '@/components/wig/NutTaoMucTieuToi';
import {NutThemCamKetToi} from '@/components/wig/NutThemCamKetToi';
import {SuaCamKetToi} from '@/components/wig/SuaCamKetToi';
import {TickCuaToi} from '@/components/wig/TickCuaToi';
import {GhiSoToi} from '@/components/wig/GhiSoToi';
import {ThaoTacMucTieuLop} from '@/components/wig/ThaoTacMucTieuLop';
import {NutThemThuoc} from '@/components/wig/NutThemThuoc';
import {SuaChiTieuLop} from '@/components/wig/SuaChiTieuLop';
import {SubmitButton} from '@/components/ui/SubmitButton';
import type {DangSuaMt} from '@/components/student/FormMucTieu';
import {DonutRing} from '@/components/charts/DonutRing';
import {datBuocXong, datHanhDong} from '@/app/[locale]/(dashboard)/student/actions';
import {xoaViecLop} from '@/app/[locale]/(dashboard)/wig/actions';
import {
  ghiSoMucTieuLop,
  chamCamKetToi,
  noiWigTruong,
  goWigTruong,
  duyetHaChiTieu,
  duyetMucTieuEm,
  traLaiMucTieuEm,
} from '@/app/[locale]/(dashboard)/wig/lop-actions';

// ════════════════════════════════════════════════════════════════════════════════════════════
// /wig — MÀN CỦA GVCN, mô hình mục tiêu PA2 (40-MAN-HINH §C)
// ════════════════════════════════════════════════════════════════════════════════════════════
//
// Bản cũ đọc wigs/wig_progress_v/wig_so_do/commitments/metrics_tuan_v — tất cả ĐÃ BỊ DROP. Viết
// lại từ đầu: MỌI con số đi qua hàm lõi / view invoker, màn này KHÔNG tự cộng gì.
//
// Sáu khu, đúng thứ tự 40-C:
//   ① Ba số tách  · thi_dua_lop()  — mục tiêu / việc / cam kết, KHÔNG gộp thành một điểm
//   ② Mục tiêu lớp · muc_tieu_v (cap='lop') + ô "Ghi số hôm nay" cho mục tiêu đo tay
//   ③ Việc của lớp · bang_lop_thuoc()  — "n/m bạn đủ", lẽ ra, trạng thái
//   ④ Cam kết lớp · cam_ket_v (chu_the='lop') — cô chấm Thắng/Thua
//   ⑤ Các em      · <BangCacEm> (bang_lop_em)  — chỉ đọc, dẫn sang bảng của em
//   ⑥ Chờ duyệt   · mục tiêu em 'gui' + việc 'gui' + hạ chỉ tiêu 'cho_duyet'
//
// Tạo mục tiêu/việc của lớp (form 3 bước, gửi BGH duyệt) dùng CHUNG component form với màn em —
// khu ② chỉ có nút mở; component form là phần việc của PR-4 khác, không dựng lại ở đây.

type MucTieuV = {
  id: string;
  ten: string | null;
  linh_vuc: Area | null;
  subject_id: string | null;
  mo_ta: string | null;
  don_vi_id: string | null;
  loai_moc: string | null;
  dat: boolean | null;
  trang_thai: string | null;
  trang_thai_do: string | null;
  nguon_so: string | null;
  kieu_dich: string | null;
  chieu: string | null;
  chua_do_x: boolean | null;
  ket_thuc: string | null;
  ky: string | null;
  x_so: number | null;
  x_chu: string | null;
  y_so: number | null;
  y_chu: string | null;
  ten_don_vi: string | null;
  so: number | null;
  le_ra: number | null;
  pct: number | null;
  dang_tap_trung: boolean | null;
  ly_do_tra_lai: string | null;
  student_id: string | null;
};

// Làm tròn số hiển thị: tối đa 1 chữ số thập phân (số đo tính từ tick hay ra 1.98…).
function dinhSo(n: number): string {
  return (Math.round(n * 10) / 10).toString();
}

// BIỂU ĐỒ THẬT — cột dồn = số THẬT của mục tiêu ở cuối mỗi tuần (0175) + một vạch ĐÍCH. KHÔNG có
// đường dự đoán/pace nên không thể vẽ sai. Đích cắm ở đỉnh; cột cao theo tỉ lệ so/đích.
function BieuDoThat({lichSu, dich, mau}: {lichSu: {tuan_ket: string; so: number}[]; dich: number; mau: string}) {
  if (lichSu.length < 2 || dich <= 0) return null;
  const W = 240;
  const H = 40;
  const n = lichSu.length;
  const bw = W / n;
  const maxSo = Math.max(...lichSu.map((p) => p.so));
  // Trục theo SỐ THẬT cao nhất (có headroom) để thấy rõ xu hướng đi lên. Đích chỉ là vạch tham chiếu:
  // vẽ nếu còn lọt trong khung; không thì bỏ qua (đích đã có ở dòng số phía trên).
  const dinh = Math.max(maxSo * 1.18, 1);
  const dichTrongKhung = dich <= dinh;
  const yDich = 6 + (H - 6) * (1 - dich / dinh);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-[200px] max-w-full" style={{height: 40}} preserveAspectRatio="none" role="img" aria-label="Biểu đồ số thật theo tuần">
      {dichTrongKhung && (
        <line x1="0" y1={yDich} x2={W} y2={yDich} stroke="currentColor" strokeWidth="1.2" strokeDasharray="4 4" className="text-grey-mid" opacity="0.55" />
      )}
      {lichSu.map((p, i) => {
        const h = Math.max(2, (H - 8) * (p.so / dinh));
        return <rect key={i} x={i * bw + bw * 0.16} y={H - h} width={bw * 0.68} height={h} rx="2" fill={mau} opacity={i === n - 1 ? 1 : 0.42} />;
      })}
    </svg>
  );
}

export default async function WigPage({
  params,
  searchParams,
}: {
  params: Promise<{locale: string}>;
  searchParams: Promise<{class?: string; week?: string}>;
}) {
  const {locale} = await params;
  const {class: classParam, week: weekParam} = await searchParams;
  setRequestLocale(locale);
  const profile = await requireRole(['teacher', 'admin']);
  const t = await getTranslations('lopMucTieu');
  const tMt = await getTranslations('mucTieu');
  const tViec = await getTranslations('viec');
  const tCk = await getTranslations('camKet');
  const tDuyet = await getTranslations('duyet');
  const tTuan = await getTranslations('tuan');
  const supabase = await createClient();
  const [{myClass, classes: accessible}, areaMeta] = await Promise.all([
    getClassContext(supabase, profile, classParam),
    getAreaMeta(),
  ]);

  if (!myClass) return <KhongCoLop role={profile.role} />;

  // Nhãn 4 lĩnh vực + danh sách đơn vị — cho form "Đặt mục tiêu cho lớp" (dùng chung form màn em).
  const nhanTheoArea = Object.fromEntries(AREAS.map((a) => [a, areaLabel(areaMeta[a], locale)]));
  const {data: dvRows} = await supabase
    .from('don_vi')
    .select('id, ma, nhan_vi, nhan_en')
    .eq('is_active', true)
    .order('ma');
  const donViList = ((dvRows ?? []) as {id: string; ma: string; nhan_vi: string; nhan_en: string}[]).map((d) => ({
    id: d.id,
    ma: d.ma,
    nhan: locale === 'vi' ? d.nhan_vi : d.nhan_en,
  }));

  // ── TUẦN ĐANG XEM ─────────────────────────────────────────────────────────────────────────
  const todayVN = todayInVN();
  const thisMonday = mondayOf(todayVN);
  const monday = isValidDayVN(weekParam) ? mondayOf(weekParam as string) : thisMonday;
  const wk = weekFromMonday(monday);
  const laTuanNay = monday === thisMonday;
  const weekQ = laTuanNay ? '' : monday;
  const q = (extra: Record<string, string> = {}) => ({
    ...(classParam ? {class: classParam} : {}),
    ...(weekQ ? {week: weekQ} : {}),
    ...extra,
  });
  // Ô ẩn class + week gửi kèm mọi form, để action ở lại đúng lớp/tuần.
  const ctx = (
    <>
      <input type="hidden" name="class_id" value={myClass.id} />
      <input type="hidden" name="week" value={weekQ} />
    </>
  );

  // ── ĐỌC DỮ LIỆU (song song) ───────────────────────────────────────────────────────────────
  const MT_COLS =
    'id, ten, linh_vuc, subject_id, mo_ta, don_vi_id, loai_moc, dat, trang_thai, trang_thai_do, nguon_so, kieu_dich, chieu, chua_do_x, ket_thuc, ky, x_so, x_chu, y_so, y_chu, ten_don_vi, so, le_ra, pct, dang_tap_trung, ly_do_tra_lai, student_id';
  const [
    {data: thiDua},
    {data: mtRows},
    {data: mtToiRows},
    {data: truongRows},
    {data: thuocRows},
    {data: ckRows},
    {data: enrolled},
    {data: mtCho},
    {data: haCho},
  ] = await Promise.all([
    supabase.rpc('thi_dua_lop', {p_class: myClass.id}),
    supabase
      .from('muc_tieu_v')
      .select(MT_COLS)
      .eq('class_id', myClass.id)
      .eq('cap', 'lop')
      .neq('trang_thai', 'dong'),
    // MỤC TIÊU CÁ NHÂN CỦA THẦY CÔ (0181): cap='em' nhưng student_id là chính thầy cô.
    supabase
      .from('muc_tieu_v')
      .select(MT_COLS)
      .eq('class_id', myClass.id)
      .eq('cap', 'em')
      .eq('student_id', profile.id)
      .neq('trang_thai', 'dong'),
    // Mục tiêu TRƯỜNG đã duyệt của cơ sở — để thẻ mục tiêu lớp chọn "hướng tới".
    supabase
      .from('muc_tieu_v')
      .select('id, ten, don_vi_id, ten_don_vi, so, y_so')
      .eq('campus_id', (myClass as unknown as {campus_id: string}).campus_id)
      .eq('cap', 'truong')
      .eq('trang_thai', 'duyet'),
    supabase.rpc('bang_lop_thuoc', {p_class: myClass.id, p_tuan: monday}),
    // CAM KẾT CÁ NHÂN của thầy cô (chốt 03/09: cam kết không treo ở mục tiêu lớp nữa).
    supabase
      .from('cam_ket_v')
      .select(
        'id, noi_dung, so_hua, so_dat, ket_qua, ten_don_vi, muc_tieu_id, thuoc_id, tuan_bat_dau, tuan_ket_thuc, so_tuan, trang_thai',
      )
      .eq('class_id', myClass.id)
      .eq('chu_the', 'em')
      .eq('student_id', profile.id)
      .neq('trang_thai', 'huy'),
    supabase
      .from('enrollments')
      .select('student_id, profiles!enrollments_student_id_fkey(full_name)')
      .eq('class_id', myClass.id)
      .eq('is_active', true),
    // Mục tiêu NĂM của em đang CHỜ DUYỆT (cap='em', trang_thai='gui') — cô duyệt để em bắt đầu
    // đặt cam kết tuần + thước đo dẫn dắt hướng vào nó (mô hình hội tụ: mục tiêu em → mục tiêu lớp).
    supabase
      .from('muc_tieu_v')
      .select('id, ten, linh_vuc, student_id, x_so, y_so, ten_don_vi, ket_thuc')
      .eq('class_id', myClass.id)
      .eq('cap', 'em')
      .eq('trang_thai', 'gui'),
    supabase
      .from('thuoc_lich_su')
      .select('id, thuoc_id, chi_tieu_ky, la_ha, thuoc(ten, class_id, student_id, chi_tieu_ky)')
      .eq('trang_thai', 'cho_duyet'),
  ]);

  // Tên các em (bảng chờ duyệt hiển thị "của {tên}").
  const tenEm = new Map<string, string>();
  for (const e of enrolled ?? []) {
    const p = e.profiles as {full_name: string | null} | {full_name: string | null}[] | null;
    const name = Array.isArray(p) ? p[0]?.full_name : p?.full_name;
    if (e.student_id) tenEm.set(e.student_id, name ?? '');
  }

  const td = (thiDua ?? [])[0] as
    | {diem_muc_tieu: number | null; diem_thuoc: number | null; diem_cam_ket: number | null}
    | undefined;
  const mucTieuLop = (mtRows ?? []) as unknown as MucTieuV[];
  const mucTieuToi = (mtToiRows ?? []) as unknown as MucTieuV[];
  const truongWigs = (truongRows ?? []) as unknown as {
    id: string;
    ten: string | null;
    don_vi_id: string | null;
    ten_don_vi: string | null;
    so: number | null;
    y_so: number | null;
  }[];
  // Bước của mục tiêu lớp loại KẾ HOẠCH — để hiện checklist tick trên thẻ (cô tick, % nhảy).
  const keIds = mucTieuLop.filter((m) => m.loai_moc === 'ke_hoach').map((m) => m.id);
  const {data: buocRows} = keIds.length
    ? await supabase.from('buoc').select('id, muc_tieu_id, tieu_de, phan_tram, xong_at').in('muc_tieu_id', keIds).order('thu_tu')
    : {data: null};
  const buocTheoMt = new Map<string, {id: string; tieu_de: string; phan_tram: number; xong: boolean}[]>();
  for (const b of (buocRows ?? []) as {id: string; muc_tieu_id: string; tieu_de: string; phan_tram: number; xong_at: string | null}[]) {
    const arr = buocTheoMt.get(b.muc_tieu_id) ?? [];
    arr.push({id: b.id, tieu_de: b.tieu_de, phan_tram: Number(b.phan_tram), xong: b.xong_at != null});
    buocTheoMt.set(b.muc_tieu_id, arr);
  }

  // ── HỘI TỤ: việc nào ĐẨY mục tiêu nào (dây góp số) → bày việc DƯỚI mục tiêu nó phục vụ. ────────
  const wigIds = mucTieuLop.map((m) => m.id);
  const mtToiIds = mucTieuToi.map((m) => m.id);
  const truongIds = truongWigs.map((m) => m.id);
  const [{data: noiRows}, {data: noiToiRows}, {data: noiTruongRows}] = await Promise.all([
    wigIds.length
      ? supabase
          .from('noi')
          .select('cha_id, con_thuoc_id')
          .in('cha_id', wigIds)
          .eq('vai', 'gop_so')
          .not('con_thuoc_id', 'is', null)
      : Promise.resolve({data: null}),
    // Dây mục tiêu CÁ NHÂN của thầy cô → mục tiêu lớp (chi_huong = giữ hướng; gop_so = máy cộng).
    mtToiIds.length
      ? supabase.from('noi').select('cha_id, con_muc_tieu_id, vai').in('con_muc_tieu_id', mtToiIds)
      : Promise.resolve({data: null}),
    // Dây mục tiêu LỚP → mục tiêu TRƯỜNG.
    truongIds.length && wigIds.length
      ? supabase.from('noi').select('cha_id, con_muc_tieu_id, vai').in('cha_id', truongIds).in('con_muc_tieu_id', wigIds)
      : Promise.resolve({data: null}),
  ]);
  // con (mục tiêu tôi) → {chaId, gop}: đã nối vào mục tiêu lớp nào, có cộng số không.
  const noiCuaToi = new Map<string, {chaId: string; gop: boolean}>();
  for (const n of (noiToiRows ?? []) as {cha_id: string; con_muc_tieu_id: string; vai: string}[]) {
    const cur = noiCuaToi.get(n.con_muc_tieu_id) ?? {chaId: n.cha_id, gop: false};
    if (n.vai === 'gop_so') cur.gop = true;
    cur.chaId = n.cha_id;
    noiCuaToi.set(n.con_muc_tieu_id, cur);
  }
  // con (mục tiêu lớp) → {chaId, gop}: đã hướng tới mục tiêu trường nào.
  const noiLenTruong = new Map<string, {chaId: string; gop: boolean}>();
  for (const n of (noiTruongRows ?? []) as {cha_id: string; con_muc_tieu_id: string; vai: string}[]) {
    const cur = noiLenTruong.get(n.con_muc_tieu_id) ?? {chaId: n.cha_id, gop: false};
    if (n.vai === 'gop_so') cur.gop = true;
    cur.chaId = n.cha_id;
    noiLenTruong.set(n.con_muc_tieu_id, cur);
  }
  const tenTruong = new Map(truongWigs.map((m) => [m.id, m.ten ?? '']));
  const tenWigLop = new Map(mucTieuLop.map((m) => [m.id, m.ten ?? '']));
  const wigCuaViec = new Map<string, string>(); // thuoc_id → wig_id
  const viecCuaWig = new Map<string, string[]>(); // wig_id → [thuoc_id]
  for (const n of (noiRows ?? []) as {cha_id: string; con_thuoc_id: string}[]) {
    wigCuaViec.set(n.con_thuoc_id, n.cha_id);
    const arr = viecCuaWig.get(n.cha_id) ?? [];
    arr.push(n.con_thuoc_id);
    viecCuaWig.set(n.cha_id, arr);
  }

  // ── BIỂU ĐỒ THẬT: số của mục tiêu ở cuối 8 tuần gần đây (0175) — chỉ vẽ cái đã xảy ra, không dự đoán.
  const lichSuTheoWig = new Map<string, {tuan_ket: string; so: number}[]>();
  await Promise.all(
    [...mucTieuLop, ...mucTieuToi]
      .filter((m) => m.pct != null || m.so != null) // chỉ mục tiêu có đo bằng số
      .map(async (m) => {
        const {data} = await supabase.rpc('muc_tieu_lich_su_tuan', {p_muc_tieu: m.id, p_so_tuan: 8});
        lichSuTheoWig.set(
          m.id,
          ((data ?? []) as {tuan_ket: string; so: number | null}[]).map((r) => ({tuan_ket: r.tuan_ket, so: Number(r.so ?? 0)})),
        );
      }),
  );
  const thuoc = thuocRows ?? [];
  const viecTheoId = new Map(thuoc.map((v) => [v.thuoc_id, v]));
  // Việc CHƯA gắn mục tiêu nào — mới đứng ở khu "Việc của lớp"; việc đã gắn nằm dưới mục tiêu nó đẩy.
  const viecChuaGan = thuoc.filter((v) => !wigCuaViec.has(v.thuoc_id));
  // Cam kết CÁ NHÂN của thầy cô trong tuần đang xem: [tuan_bat_dau, tuan_ket_thuc] GIAO tuần.
  const camKet = (ckRows ?? []).filter((c) => {
    const bd = c.tuan_bat_dau ?? '';
    const kt = c.tuan_ket_thuc ?? bd;
    return bd <= wk.end && kt >= wk.start;
  });
  // Gom cam kết theo mục tiêu CÁ NHÂN nó hướng vào (bày DƯỚI mục tiêu của tôi).
  const camKetCuaToi = new Map<string, typeof camKet>();
  const camKetToiMoCoi: typeof camKet = [];
  for (const c of camKet) {
    if (c.muc_tieu_id && mtToiIds.includes(c.muc_tieu_id)) {
      const arr = camKetCuaToi.get(c.muc_tieu_id) ?? [];
      arr.push(c);
      camKetCuaToi.set(c.muc_tieu_id, arr);
    } else camKetToiMoCoi.push(c);
  }

  // THƯỚC ĐO DẪN DẮT của mỗi cam kết cá nhân — lượt mang student_id CỦA thầy cô (tung_em).
  const weekDays = weekDaysVN(monday);
  const dayShort = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];
  const ckThuocIds = [...new Set(camKet.map((c) => c.thuoc_id).filter(Boolean) as string[])];
  type ThuocToi = {id: string; ten: string; cach_ghi: string; chi_tieu_ky: number | null};
  const boTroTheoId = new Map<string, ThuocToi>();
  const daTickTheoThuoc = new Map<string, string[]>();
  const tongSoTheoThuoc = new Map<string, number>();
  if (ckThuocIds.length > 0) {
    const [{data: tRows}, {data: lRows}] = await Promise.all([
      supabase.from('thuoc').select('id, ten, cach_ghi, chi_tieu_ky').in('id', ckThuocIds),
      supabase
        .from('luot')
        .select('thuoc_id, ngay, gia_tri')
        .in('thuoc_id', ckThuocIds)
        .eq('student_id', profile.id)
        .gte('ngay', wk.start)
        .lte('ngay', wk.end),
    ]);
    for (const tr of (tRows ?? []) as ThuocToi[]) boTroTheoId.set(tr.id, tr);
    for (const l of (lRows ?? []) as {thuoc_id: string; ngay: string; gia_tri: number | null}[]) {
      const arr = daTickTheoThuoc.get(l.thuoc_id) ?? [];
      arr.push(l.ngay);
      daTickTheoThuoc.set(l.thuoc_id, arr);
      tongSoTheoThuoc.set(l.thuoc_id, (tongSoTheoThuoc.get(l.thuoc_id) ?? 0) + Number(l.gia_tri ?? 0));
    }
  }

  const haChoLop = (haCho ?? []).filter((r) => {
    const th = r.thuoc as {class_id: string | null} | {class_id: string | null}[] | null;
    const cid = Array.isArray(th) ? th[0]?.class_id : th?.class_id;
    return cid === myClass.id;
  });
  const soCho = (mtCho ?? []).length + haChoLop.length;

  // ── Câu mô tả một mục tiêu (Từ x lên y đv · trước ngày) ────────────────────────────────────

  // Nhãn trạng thái đã-đo (chỉ mục tiêu đã duyệt mới có nhịp thật để so).
  const nhanTrangThai = (m: MucTieuV): {text: string; cls: string} | null => {
    if (m.trang_thai === 'nhap') return {text: tMt('nhap'), cls: 'bg-navy/[0.06] text-grey-mid'};
    if (m.trang_thai === 'gui') return {text: tMt('choBghDuyet'), cls: 'bg-gold/[0.18] text-gold-text'};
    if (m.trang_thai === 'tra_lai') return {text: tMt('traLai'), cls: 'bg-status-bad/[0.12] text-status-bad'};
    // Bỏ nhãn nhịp đo ("Sát nút"/"Vượt"…): mục tiêu nay cô nhập số tay, nhãn pace vô nghĩa + gây rối.
    return null;
  };

  const baSo = (label: string, val: number | null | undefined) => (
    <div className="flex-1 rounded-[14px] border-[1.5px] border-navy/10 bg-white px-3 py-2.5">
      <div className="text-[10.5px] font-extrabold uppercase tracking-wide text-grey-mid">{label}</div>
      <div className="mt-0.5 font-display text-[22px] font-bold text-navy tabular-nums">
        {val == null ? <span className="text-grey-mid">—</span> : `${Math.round(Number(val))}%`}
      </div>
    </div>
  );

  const thName = 'px-3 py-2 text-left text-[10.5px] font-extrabold uppercase tracking-wide text-grey-mid';
  const numCell = 'px-3 py-2.5 text-right text-[13px] font-extrabold tabular-nums text-navy';

  return (
    <div className="flex flex-col gap-4">
      {/* ── Đầu trang ─────────────────────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="mr-auto font-display text-[22px] font-bold text-navy">
          {t('title')} · {myClass.name}
        </h1>
        {/* Lối tới đặt LỊCH HỌP (buddy hằng tuần + PDR hằng tháng) — khu ấy ở /roster (Danh sách). */}
        <Link
          href={{pathname: '/roster', query: classParam ? {class: classParam} : {}}}
          className="inline-flex items-center gap-1.5 rounded-[10px] border-[1.5px] border-navy/20 bg-white px-2.5 py-1.5 text-[12px] font-extrabold text-navy transition-all hover:border-navy"
        >
          <CalendarDays size={14} strokeWidth={2.5} />
          {t('lichHop')}
        </Link>
        {(accessible.length > 1 || profile.role === 'admin' || profile.role === 'principal') && (
          <ClassPicker classes={accessible} current={myClass.id} />
        )}
        <ClassOwnerNote classId={myClass.id} viewerId={profile.id} viewerRole={profile.role} />
      </div>

      <Flash />

      {/* ── Thanh tuần ────────────────────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-2">
        <Link
          href={{pathname: '/wig', query: q({week: shiftWeeks(monday, -1)})}}
          className="inline-flex items-center gap-1 rounded-[10px] border-[1.5px] border-navy/20 bg-white px-2.5 py-1.5 text-[12px] font-extrabold text-navy transition-all hover:border-navy"
        >
          <ArrowLeft size={13} strokeWidth={2.5} />
          {tTuan('weekPrev')}
        </Link>
        <span className="rounded-[10px] bg-navy/[0.05] px-3 py-1.5 text-[12.5px] font-bold text-navy">
          {wk.label} · {ngayVN(wk.start)} – {ngayVN(wk.end)}
          {laTuanNay ? ` · ${tTuan('weekNow')}` : monday > thisMonday ? ` · ${tTuan('weekFuture')}` : ` · ${tTuan('weekPast')}`}
        </span>
        <Link
          href={{pathname: '/wig', query: q({week: shiftWeeks(monday, 1)})}}
          className="inline-flex items-center gap-1 rounded-[10px] border-[1.5px] border-navy/20 bg-white px-2.5 py-1.5 text-[12px] font-extrabold text-navy transition-all hover:border-navy"
        >
          {tTuan('weekNext')}
          <ArrowRight size={13} strokeWidth={2.5} />
        </Link>
      </div>

      {/* ── ① BA SỐ TÁCH (thi_dua_lop) ──────────────────────────────────────────────────────── */}
      <section className="glass rounded-[20px] p-[18px]">
        <div className="flex items-stretch gap-2.5">
          {baSo(t('cotMucTieu'), td?.diem_muc_tieu)}
          {baSo(t('cotViec'), td?.diem_thuoc)}
          {baSo(t('cotCamKet'), td?.diem_cam_ket)}
        </div>
      </section>

      {/* Chưa có mục tiêu → gộp về MỘT tấm: mục tiêu là đích (bước ①), việc + cam kết khoá
          lại kèm lời "mở khi có mục tiêu" — cho thấy chúng phục vụ mục tiêu, không phải 3 ngã rẽ. */}
      {mucTieuLop.length === 0 ? (
        <section className="glass flex flex-col gap-4 rounded-[20px] p-[18px]">
          <div className="flex flex-col items-center gap-2.5 rounded-[16px] border-[1.5px] border-dashed border-navy/25 px-5 py-7 text-center">
            <h2 className="font-display text-[16px] font-bold text-navy">{t('khuMucTieu')}</h2>
            <p className="max-w-[440px] text-[12.5px] font-semibold leading-relaxed text-grey-mid">
              {t('rongDanDat')}
            </p>
            <div className="mt-1">
              <NutTaoMucTieuLop classId={myClass.id} nhanTheoArea={nhanTheoArea} donViList={donViList} />
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="h-px flex-1 bg-navy/10" />
            <span className="text-[11px] font-extrabold uppercase tracking-wide text-grey-mid">{t('rongTiepTheo')}</span>
            <span className="h-px flex-1 bg-navy/10" />
          </div>
          <div className="flex flex-col gap-2">
            {[
              {n: 2, nhan: t('khuViec')},
              {n: 3, nhan: t('camKetTuanNgan')},
            ].map((b) => (
              <div
                key={b.n}
                className="flex items-center gap-3 rounded-[12px] border-[1.5px] border-navy/[0.08] bg-navy/[0.02] px-3.5 py-2.5 opacity-70"
              >
                <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-navy/10 text-[12px] font-extrabold text-navy">
                  {b.n}
                </span>
                <span className="text-[13px] font-bold text-navy">{b.nhan}</span>
                <span className="ml-auto inline-flex items-center gap-1 text-[11.5px] font-semibold text-grey-mid">
                  <Lock size={12} strokeWidth={2.5} />
                  {t('khoaMoKhi')}
                </span>
              </div>
            ))}
          </div>
        </section>
      ) : (
      <>
      {/* HỘI TỤ: mỗi mục tiêu là MỘT lộ trình (mục tiêu → việc đẩy nó → cam kết hướng nó). Không còn
          khu "Việc"/"Cam kết" đứng riêng. Một cột dọc để đọc theo lộ trình. */}
      <div className="flex flex-col gap-4">
        {/* ── ② MỤC TIÊU CỦA LỚP ────────────────────────────────────────────────────────────── */}
        <section className="glass flex flex-col gap-3 rounded-[20px] p-[18px]">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="font-display text-[15px] font-bold text-navy">{t('khuMucTieu')}</h2>
            <div className="ml-auto">
              <NutTaoMucTieuLop classId={myClass.id} nhanTheoArea={nhanTheoArea} donViList={donViList} />
            </div>
          </div>
          {mucTieuLop.length === 0 ? (
            <div className="flex flex-col items-center gap-3 rounded-[14px] border-[1.5px] border-dashed border-navy/20 p-5 text-center">
              <p className="text-[12.5px] font-semibold text-grey-mid">{t('mucTieuTrong')}</p>
              <NutTaoMucTieuLop classId={myClass.id} nhanTheoArea={nhanTheoArea} donViList={donViList} />
            </div>
          ) : (
            mucTieuLop.map((m) => {
              const meta = areaMeta[(m.linh_vuc ?? 'knowledge') as Area];
              const nhan = nhanTrangThai(m);
              const dv = m.ten_don_vi ?? '';
              return (
                <div
                  key={m.id}
                  style={{
                    borderColor: `color-mix(in srgb, ${meta.hex} 30%, white)`,
                    background: `color-mix(in srgb, ${meta.hex} 6%, white)`,
                  }}
                  className="flex flex-col gap-2 rounded-[14px] border-[1.5px] p-3.5"
                >
                  <div className="flex flex-wrap items-start gap-3.5">
                    {/* Vòng tiến độ như thẻ của em — nhìn là biết mục tiêu tới đâu. */}
                    {m.pct != null ? (
                      <DonutRing pct={Number(m.pct)} color={meta.hex} size={54} />
                    ) : (
                      <span className="grid h-[54px] w-[54px] shrink-0 place-items-center rounded-full bg-navy/[0.05] text-[11px] font-extrabold text-grey-mid">
                        —
                      </span>
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <span
                          className="inline-flex w-fit shrink-0 items-center rounded-full px-2 py-0.5 text-[10.5px] font-extrabold"
                          style={{background: meta.soft, color: meta.hex}}
                        >
                          {areaLabel(meta, locale)}
                        </span>
                        <span className="min-w-0 flex-1 font-display text-[15px] font-bold text-navy">
                          {m.ten ?? areaLabel(meta, locale)}
                        </span>
                        {nhan && (
                          <span className={`inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[10.5px] font-extrabold ${nhan.cls}`}>
                            {nhan.text}
                          </span>
                        )}
                      </div>
                      {/* Một dòng gọn: số hiện / đích · đến hạn. Bỏ "đang ở", "lẽ ra" (tinh gọn). */}
                      <p className="mt-0.5 flex flex-wrap items-baseline gap-x-2 text-[12px] font-semibold text-grey-mid">
                        {m.loai_moc === 'do_luong' && m.y_so != null ? (
                          <span className="text-[13.5px] font-extrabold tabular-nums text-navy">
                            {m.so != null ? dinhSo(m.so) : '–'}
                            <span className="font-bold text-grey-mid">
                              {' / '}
                              {dinhSo(m.y_so)} {dv}
                            </span>
                          </span>
                        ) : null}
                        <span>{tMt('denHan', {ngay: ngayVN(m.ket_thuc)})}</span>
                      </p>
                      {m.trang_thai === 'tra_lai' && m.ly_do_tra_lai && (
                        <p className="mt-1 text-[11.5px] font-semibold text-status-bad">
                          {tMt('lyDoTraLai', {note: m.ly_do_tra_lai})}
                        </p>
                      )}
                    </div>
                    {/* Biểu đồ THẬT — NGANG hàng đầu, bên phải (tận dụng khoảng trống); màn hẹp tự rớt xuống. */}
                    {m.y_so != null && (lichSuTheoWig.get(m.id)?.length ?? 0) >= 2 && (
                      <div className="ml-auto shrink-0 self-center">
                        <BieuDoThat lichSu={lichSuTheoWig.get(m.id)!} dich={Number(m.y_so)} mau={meta.hex} />
                      </div>
                    )}
                  </div>

                  {/* KẾ HOẠCH — checklist các bước (cô tick, % nhảy qua trigger). */}
                  {m.loai_moc === 'ke_hoach' && m.trang_thai === 'duyet' && (buocTheoMt.get(m.id)?.length ?? 0) > 0 && (
                    <div className="mt-1 flex flex-col gap-1.5 rounded-[12px] bg-white/70 p-2.5">
                      {buocTheoMt.get(m.id)!.map((b) => (
                        <form key={b.id} action={datBuocXong}>
                          <input type="hidden" name="buoc_id" value={b.id} />
                          <input type="hidden" name="xong" value={b.xong ? '' : '1'} />
                          <SubmitButton
                            className="flex min-h-[40px] w-full items-center gap-2.5 rounded-[10px] px-1.5 text-left transition-colors hover:bg-navy/[0.04]"
                            wrapClass="contents"
                          >
                            <span className="grid h-[22px] w-[22px] shrink-0 place-items-center">
                              {b.xong ? (
                                <span style={{background: meta.hex}} className="grid h-[22px] w-[22px] place-items-center rounded-full text-white">
                                  <Check size={13} strokeWidth={3.5} />
                                </span>
                              ) : (
                                <span className="h-[20px] w-[20px] rounded-full border-2 border-navy/25" />
                              )}
                            </span>
                            <span className={`min-w-0 flex-1 text-[13px] font-semibold leading-snug ${b.xong ? 'text-grey-mid line-through' : 'text-navy'}`}>
                              {b.tieu_de}
                            </span>
                            <span className="shrink-0 text-[11px] font-extrabold tabular-nums text-grey-mid">{Math.round(b.phan_tram)}%</span>
                          </SubmitButton>
                        </form>
                      ))}
                    </div>
                  )}

                  {/* HÀNH ĐỘNG — một nút "đã đạt" (0↔100%). */}
                  {m.loai_moc === 'hanh_dong' && m.trang_thai === 'duyet' && (
                    <form action={datHanhDong} className="mt-1">
                      <input type="hidden" name="muc_tieu_id" value={m.id} />
                      <input type="hidden" name="dat" value={m.dat ? '' : '1'} />
                      <SubmitButton
                        className={
                          m.dat
                            ? 'inline-flex min-h-[40px] items-center gap-1.5 rounded-[12px] border-[1.5px] border-success/40 bg-success/[0.12] px-3.5 text-[13px] font-extrabold text-success-dark transition-colors hover:bg-success/20'
                            : 'inline-flex min-h-[40px] items-center gap-1.5 rounded-[12px] bg-gold px-3.5 text-[13px] font-extrabold text-navy transition-all hover:brightness-95'
                        }
                        wrapClass="contents"
                      >
                        <Check size={15} strokeWidth={3} />
                        {m.dat ? tMt('daXong') : tMt('danhDauDat')}
                      </SubmitButton>
                    </form>
                  )}

                  {/* ── NGUỒN SỐ + HƯỚNG LÊN TRƯỜNG (03/09): cam kết không treo ở đây nữa — số của lớp
                      CỘNG từ mục tiêu của thầy cô khi cùng đơn vị, khác đơn vị thì thầy cô ghi tay. ── */}
                  <div className="mt-1 flex flex-col gap-2 rounded-[12px] bg-white/60 p-2.5">
                    {m.nguon_so === 'con' ? (
                      <p className="text-[11.5px] font-semibold text-grey-mid">{t('nguonTuThayCo')}</p>
                    ) : m.loai_moc === 'do_luong' && m.trang_thai === 'duyet' && m.nguon_so === 'ghi_tay' ? (
                      <form action={ghiSoMucTieuLop} className="flex flex-wrap items-center gap-1.5">
                        {ctx}
                        <input type="hidden" name="muc_tieu_id" value={m.id} />
                        <span className="text-[11.5px] font-semibold text-grey-mid">{t('ghiSoNhan')}</span>
                        <input
                          type="number"
                          name="gia_tri"
                          step="any"
                          min="0"
                          placeholder={dv}
                          className="w-24 rounded-[7px] border-[1.5px] border-navy/20 px-2 py-1 text-[11.5px] text-navy"
                        />
                        <SubmitButton
                          className="rounded-[7px] border-[1.5px] border-navy/20 bg-white px-2 py-1 text-[11.5px] font-extrabold text-navy transition-all hover:border-navy"
                          wrapClass="contents"
                        >
                          {t('ghiSoLuu')}
                        </SubmitButton>
                      </form>
                    ) : null}
                    {noiLenTruong.has(m.id) ? (
                      <div className="flex flex-wrap items-center gap-1.5 text-[11.5px] font-semibold text-grey-mid">
                        <span>
                          {t('huongTruong', {ten: tenTruong.get(noiLenTruong.get(m.id)!.chaId) ?? ''})}
                        </span>
                        <form action={goWigTruong} className="contents">
                          {ctx}
                          <input type="hidden" name="muc_tieu_id" value={m.id} />
                          <input type="hidden" name="truong_id" value={noiLenTruong.get(m.id)!.chaId} />
                          <SubmitButton className="text-[11px] font-bold text-grey-mid hover:text-status-bad" wrapClass="contents">
                            {t('goTruong')}
                          </SubmitButton>
                        </form>
                      </div>
                    ) : truongWigs.length > 0 && m.trang_thai === 'duyet' ? (
                      <form action={noiWigTruong} className="flex flex-wrap items-center gap-1.5">
                        {ctx}
                        <input type="hidden" name="muc_tieu_id" value={m.id} />
                        <select
                          name="truong_id"
                          defaultValue=""
                          className="rounded-[7px] border-[1.5px] border-navy/20 px-2 py-1 text-[11.5px] text-navy"
                        >
                          <option value="">{t('chonTruong')}</option>
                          {truongWigs.map((tw) => (
                            <option key={tw.id} value={tw.id}>
                              {tw.ten}
                            </option>
                          ))}
                        </select>
                        <SubmitButton
                          className="rounded-[7px] border-[1.5px] border-navy/20 bg-white px-2 py-1 text-[11.5px] font-extrabold text-navy transition-all hover:border-navy"
                          wrapClass="contents"
                        >
                          {t('noiTruongNut')}
                        </SubmitButton>
                      </form>
                    ) : null}
                  </div>

                  {/* Sửa · Đóng · Xoá mục tiêu của lớp. */}
                  <ThaoTacMucTieuLop
                    goal={m as unknown as DangSuaMt}
                    classId={myClass.id}
                    weekQ={weekQ}
                    nhanTheoArea={nhanTheoArea}
                    donViList={donViList}
                    buocDangSua={(buocTheoMt.get(m.id) ?? []).map((b) => ({
                      tieu_de: b.tieu_de,
                      phan_tram: b.phan_tram,
                      bat_dau: null,
                      ket_thuc: null,
                      mo_ta: null,
                    }))}
                  />
                </div>
              );
            })
          )}
        </section>

        {/* VIỆC CHƯA GẮN mục tiêu — hiếm (việc giờ nằm dưới mục tiêu nó đẩy). Gom gọn để cô nối lại. */}
        {viecChuaGan.length > 0 && (
          <section className="glass flex flex-col gap-2 rounded-[20px] p-[18px]">
            <h2 className="font-display text-[14px] font-bold text-navy">{t('viecChuaGan')}</h2>
            <div className="flex flex-col gap-2">
              {viecChuaGan.map((v) => {
                const xanh = v.trang_thai === 'dat' || v.trang_thai === 'dang_thang' || v.trang_thai === 'dang_giu';
                return (
                  <div key={v.thuoc_id} className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-[12px] border-[1.5px] border-navy/10 px-3 py-2">
                    <span className="min-w-0 flex-1 text-[13px] font-bold text-navy">{v.ten}</span>
                    <span className={`inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[10px] font-extrabold ${xanh ? 'bg-success/[0.12] text-success-dark' : 'bg-gold/[0.18] text-gold-text'}`}>
                      {v.mien ? tViec('oNghi') : xanh ? tViec('du') : tViec('chuaDu')}
                    </span>
                    <SuaChiTieuLop thuocId={v.thuoc_id} chiTieuHienTai={null} donVi="" classId={myClass.id} weekQ={weekQ} />
                    <form action={xoaViecLop}>
                      {ctx}
                      <input type="hidden" name="thuoc_id" value={v.thuoc_id} />
                      <SubmitButton label={t('xoaViec')} className="grid h-7 w-7 place-items-center rounded-[8px] text-status-bad transition-colors hover:bg-status-bad/10" wrapClass="contents">
                        <Trash2 size={13} strokeWidth={2.5} />
                      </SubmitButton>
                    </form>
                  </div>
                );
              })}
            </div>
          </section>
        )}
      </div>

      </>
      )}

      {/* ── MỤC TIÊU CỦA TÔI (0181) — thầy cô cũng có mục tiêu cá nhân như em, nối vào mục tiêu
          lớp; cam kết tuần + thước đo dẫn dắt của thầy cô treo Ở ĐÂY, không ở thẻ lớp nữa. ── */}
      <section className="glass flex flex-col gap-3 rounded-[20px] p-[18px]">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="font-display text-[15px] font-bold text-navy">{t('khuMucTieuToi')}</h2>
          <div className="ml-auto">
            <NutTaoMucTieuToi
              teacherId={profile.id}
              classId={myClass.id}
              nhanTheoArea={nhanTheoArea}
              donViList={donViList}
              mucTieuLop={mucTieuLop
                .filter((g) => g.trang_thai === 'duyet')
                .map((g) => ({id: g.id, ten: g.ten ?? '', linh_vuc: (g.linh_vuc ?? 'knowledge') as string}))}
            />
          </div>
        </div>
        {mucTieuToi.length === 0 ? (
          <p className="text-[12.5px] font-semibold text-grey-mid">{t('mucTieuToiTrong')}</p>
        ) : (
          mucTieuToi.map((m) => {
            const meta = areaMeta[(m.linh_vuc ?? 'knowledge') as Area];
            const dv = m.ten_don_vi ?? '';
            const day = noiCuaToi.get(m.id);
            return (
              <div
                key={m.id}
                style={{
                  borderColor: `color-mix(in srgb, ${meta.hex} 30%, white)`,
                  background: `color-mix(in srgb, ${meta.hex} 6%, white)`,
                }}
                className="flex flex-col gap-2 rounded-[14px] border-[1.5px] p-3.5"
              >
                <div className="flex flex-wrap items-start gap-3.5">
                  {m.pct != null ? (
                    <DonutRing pct={Number(m.pct)} color={meta.hex} size={54} />
                  ) : (
                    <span className="grid h-[54px] w-[54px] shrink-0 place-items-center rounded-full bg-navy/[0.05] text-[11px] font-extrabold text-grey-mid">
                      —
                    </span>
                  )}
                  <div className="min-w-0 flex-1">
                    <span className="font-display text-[15px] font-bold text-navy">{m.ten ?? ''}</span>
                    <p className="mt-0.5 flex flex-wrap items-baseline gap-x-2 text-[12px] font-semibold text-grey-mid">
                      {m.loai_moc === 'do_luong' && m.y_so != null ? (
                        <span className="text-[13.5px] font-extrabold tabular-nums text-navy">
                          {m.so != null ? dinhSo(m.so) : '–'}
                          <span className="font-bold text-grey-mid">
                            {' / '}
                            {dinhSo(m.y_so)} {dv}
                          </span>
                        </span>
                      ) : null}
                      <span>{tMt('denHan', {ngay: ngayVN(m.ket_thuc)})}</span>
                    </p>
                    {/* Nối vào mục tiêu lớp nào — và số có chảy lên không. */}
                    {day && (
                      <p className="mt-0.5 text-[11.5px] font-semibold text-grey-mid">
                        {t('huongLop', {ten: tenWigLop.get(day.chaId) ?? ''})}
                        {day.gop ? ` · ${t('congVaoLop')}` : ''}
                      </p>
                    )}
                  </div>
                  {m.y_so != null && (lichSuTheoWig.get(m.id)?.length ?? 0) >= 2 && (
                    <div className="ml-auto shrink-0 self-center">
                      <BieuDoThat lichSu={lichSuTheoWig.get(m.id)!} dich={Number(m.y_so)} mau={meta.hex} />
                    </div>
                  )}
                </div>

                {/* CAM KẾT TUẦN của tôi cho mục tiêu này. */}
                <div className="mt-1 flex flex-col gap-1.5 rounded-[12px] bg-white/60 p-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[11px] font-extrabold uppercase tracking-wide text-grey-mid">{t('camKetToiNhan')}</p>
                    <NutThemCamKetToi
                      classId={myClass.id}
                      weekQ={weekQ}
                      monday={monday}
                      mucTieuId={m.id}
                      tenMucTieu={m.ten ?? ''}
                      tenDonVi={m.ten_don_vi}
                    />
                  </div>
                  {(camKetCuaToi.get(m.id) ?? []).length === 0 ? (
                    <p className="text-[11.5px] font-semibold italic text-grey-mid">{t('camKetToiTrong')}</p>
                  ) : (
                    (camKetCuaToi.get(m.id) ?? []).map((c) => (
                      <div key={c.id} className="flex flex-col gap-1.5 rounded-[10px] border border-navy/10 bg-white p-2.5">
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                          <span className="min-w-0 flex-1 text-[13px] font-bold text-navy">{c.noi_dung}</span>
                          {c.so_hua != null && (
                            <span className="text-[11px] font-bold tabular-nums text-grey-mid">
                              {tCk('chipSo', {dat: c.so_dat ?? 0, hua: c.so_hua, dv: c.ten_don_vi ?? ''})}
                            </span>
                          )}
                          {c.ket_qua === 'thang' && (
                            <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-success/15 px-2 py-0.5 text-[9.5px] font-extrabold text-success-dark">
                              <Check size={10} strokeWidth={3} />
                              {tCk('thang')}
                            </span>
                          )}
                          {c.ket_qua === 'thua' && (
                            <span className="inline-flex shrink-0 items-center rounded-full bg-status-bad/[0.12] px-2 py-0.5 text-[9.5px] font-extrabold text-status-bad">
                              {tCk('thua')}
                            </span>
                          )}
                        </div>
                        <div className="flex flex-wrap items-center gap-1.5">
                          <form action={chamCamKetToi} className="flex items-center gap-1.5">
                            {ctx}
                            <input type="hidden" name="cam_ket_id" value={c.id ?? undefined} />
                            {c.so_hua != null && (
                              <input
                                type="number"
                                name="so_dat"
                                step="any"
                                min="0"
                                defaultValue={c.so_dat ?? undefined}
                                placeholder={tCk('soDatHoi', {dv: c.ten_don_vi ?? ''})}
                                className="w-24 rounded-[7px] border-[1.5px] border-navy/20 px-2 py-1 text-[11.5px] text-navy"
                              />
                            )}
                            <SubmitButton
                              name="ket_qua"
                              value="thang"
                              className="inline-flex items-center gap-1 rounded-[7px] border-[1.5px] border-success/40 bg-success/[0.12] px-2 py-1 text-[11.5px] font-extrabold text-success-dark transition-all hover:bg-success/20"
                              wrapClass="contents"
                            >
                              <Check size={11} strokeWidth={3} />
                              {tCk('thang')}
                            </SubmitButton>
                            <SubmitButton
                              name="ket_qua"
                              value="thua"
                              className="inline-flex items-center gap-1 rounded-[7px] border-[1.5px] border-status-bad/40 bg-status-bad/[0.08] px-2 py-1 text-[11.5px] font-extrabold text-status-bad transition-all hover:bg-status-bad/15"
                              wrapClass="contents"
                            >
                              <X size={11} strokeWidth={3} />
                              {tCk('thua')}
                            </SubmitButton>
                          </form>
                          <SuaCamKetToi
                            camKetId={c.id ?? ''}
                            noiDung={c.noi_dung ?? ''}
                            soHua={c.so_hua}
                            tenDonVi={c.ten_don_vi}
                            classId={myClass.id}
                            weekQ={weekQ}
                          />
                        </div>
                        {/* THƯỚC ĐO DẪN DẮT của cam kết: tick mỗi ngày, hoặc ghi số. */}
                        {c.thuoc_id && boTroTheoId.has(c.thuoc_id) ? (
                          <div className="rounded-[8px] bg-navy/[0.03] p-1.5">
                            <p className="mb-1 text-[10px] font-extrabold uppercase tracking-wide text-grey-mid">
                              {tCk('viecBoTroLabel')}: <span className="text-navy">{boTroTheoId.get(c.thuoc_id)!.ten}</span>
                            </p>
                            {boTroTheoId.get(c.thuoc_id)!.cach_ghi === 'cham' ? (
                              <TickCuaToi
                                leadId={c.thuoc_id}
                                studentId={profile.id}
                                days={weekDays}
                                daTick={daTickTheoThuoc.get(c.thuoc_id) ?? []}
                                today={todayVN}
                                moKhoa={laTuanNay}
                                dayShort={dayShort}
                              />
                            ) : (
                              <GhiSoToi
                                leadId={c.thuoc_id}
                                studentId={profile.id}
                                today={todayVN}
                                tongTuan={tongSoTheoThuoc.get(c.thuoc_id) ?? 0}
                                chiTieu={Number(boTroTheoId.get(c.thuoc_id)!.chi_tieu_ky ?? 0)}
                                donVi={c.ten_don_vi ?? ''}
                              />
                            )}
                          </div>
                        ) : (
                          !c.thuoc_id &&
                          laTuanNay &&
                          !c.ket_qua && (
                            <NutThemThuoc mode="toi" camKetId={c.id ?? ''} classId={myClass.id} weekQ={weekQ} monday={monday} donViList={donViList} />
                          )
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>
            );
          })
        )}
      </section>

      {/* ── ⑤ CÁC EM TUẦN NÀY (component chung, tự đọc bang_lop_em) ─────────────────────────── */}
      <BangCacEm classId={myClass.id} monday={monday} weekQ={weekQ} classParam={classParam} />

      {/* ── ⑥ CHỜ DUYỆT ─────────────────────────────────────────────────────────────────────── */}
      <section className="glass flex flex-col gap-3 rounded-[20px] p-[18px]">
        <h2 className="font-display text-[15px] font-bold text-navy">
          {soCho > 0 ? tDuyet('choDuyetN', {n: soCho}) : tDuyet('choDuyet')}
        </h2>
        <p className="text-[11.5px] font-semibold text-grey-mid">{tDuyet('luuY')}</p>
        {soCho === 0 ? (
          <p className="text-[12.5px] font-semibold text-grey-mid">{tDuyet('khongCo')}</p>
        ) : (
          <div className="flex flex-col gap-2">
            {/* MỤC TIÊU NĂM của em chờ duyệt — cô Duyệt để em bắt đầu đặt cam kết tuần cho nó. */}
            {(mtCho ?? []).map((m) => (
              <div
                key={m.id}
                className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-[12px] border-[1.5px] border-navy/10 px-3 py-2"
              >
                <span className="rounded-full bg-navy/[0.06] px-2 py-0.5 text-[10px] font-extrabold text-grey-mid">
                  {tDuyet('loaiMucTieu')}
                </span>
                <span className="min-w-0 flex-1 text-[13px] font-bold text-navy">
                  {m.ten} <span className="font-semibold text-grey-mid">{tDuyet('cua', {ten: tenEm.get(m.student_id ?? '') ?? ''})}</span>
                </span>
                <form action={duyetMucTieuEm} className="contents">
                  {ctx}
                  <input type="hidden" name="muc_tieu_id" value={m.id ?? undefined} />
                  <SubmitButton
                    className="rounded-full border-[1.5px] border-gold-deep/40 bg-gold/[0.18] px-2.5 py-0.5 text-[10.5px] font-extrabold text-gold-text transition-all hover:bg-gold/30"
                    wrapClass="contents"
                  >
                    {tDuyet('duyet')}
                  </SubmitButton>
                </form>
                <details>
                  <summary className="cursor-pointer list-none rounded-[8px] border-[1.5px] border-navy/20 bg-white px-2.5 py-0.5 text-[11px] font-extrabold text-navy hover:border-navy">
                    {tDuyet('traLai')}
                  </summary>
                  <form action={traLaiMucTieuEm} className="mt-1 flex flex-col gap-1">
                    {ctx}
                    <input type="hidden" name="muc_tieu_id" value={m.id ?? undefined} />
                    <textarea
                      name="note"
                      maxLength={300}
                      placeholder={tDuyet('traLaiNhan')}
                      className="w-full rounded-[8px] border-[1.5px] border-navy/20 px-2 py-1 text-[12px] text-navy"
                    />
                    <SubmitButton className="self-start rounded-[8px] bg-navy px-2.5 py-1 text-[11px] font-extrabold text-white" wrapClass="contents">
                      {tDuyet('traLaiGui')}
                    </SubmitButton>
                  </form>
                </details>
              </div>
            ))}
            {haChoLop.map((r) => {
              const th = r.thuoc as {ten: string | null; student_id: string | null} | {ten: string | null; student_id: string | null}[] | null;
              const one = Array.isArray(th) ? th[0] : th;
              return (
                <div
                  key={r.id}
                  className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-[12px] border-[1.5px] border-navy/10 px-3 py-2"
                >
                  <span className="rounded-full bg-status-bad/[0.10] px-2 py-0.5 text-[10px] font-extrabold text-status-bad">
                    {tDuyet('loaiHaChiTieu', {cu: one?.ten ?? '', moi: r.chi_tieu_ky ?? ''})}
                  </span>
                  <span className="min-w-0 flex-1 text-[13px] font-bold text-navy">
                    {one?.ten} <span className="font-semibold text-grey-mid">{tDuyet('cua', {ten: tenEm.get(one?.student_id ?? '') ?? ''})}</span>
                  </span>
                  <form action={duyetHaChiTieu} className="contents">
                    {ctx}
                    <input type="hidden" name="lich_su_id" value={r.id} />
                    <SubmitButton
                      className="rounded-full border-[1.5px] border-gold-deep/40 bg-gold/[0.18] px-2.5 py-0.5 text-[10.5px] font-extrabold text-gold-text transition-all hover:bg-gold/30"
                      wrapClass="contents"
                    >
                      {tDuyet('duyet')}
                    </SubmitButton>
                  </form>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}

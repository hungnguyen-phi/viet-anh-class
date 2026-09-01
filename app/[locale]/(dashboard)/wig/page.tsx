import {getTranslations, setRequestLocale} from 'next-intl/server';
import {ArrowLeft, ArrowRight, Check, X} from 'lucide-react';
import {requireRole} from '@/lib/auth';
import {createClient} from '@/lib/supabase/server';
import {KhongCoLop} from '@/components/ui/KhongCoLop';
import {getClassContext} from '@/lib/queries';
import {ClassPicker} from '@/components/shell/ClassPicker';
import {ClassOwnerNote} from '@/components/shell/ClassOwnerNote';
import {Link} from '@/i18n/navigation';
import {isValidDayVN, mondayOf, todayInVN, weekFromMonday, shiftWeeks, ngayVN} from '@/lib/dates';
import {AREAS, areaLabel, type Area} from '@/lib/areas';
import {getAreaMeta} from '@/lib/area-config';
import {Flash} from '@/components/ui/Flash';
import {BangCacEm} from '@/components/wig/BangCacEm';
import {
  ghiSoMucTieuLop,
  chamCamKetLop,
  taoCamKetLop,
  xoaCamKetLop,
  duyetMucTieuEm,
  traLaiMucTieuEm,
  duyetThuoc,
  traLaiThuoc,
  duyetHaChiTieu,
  taoMau,
  xoaMau,
} from '@/app/[locale]/(dashboard)/wig/lop-actions';

// ════════════════════════════════════════════════════════════════════════════════════════════
// /wig — MÀN CỦA GVCN, mô hình mục tiêu PA2 (40-MAN-HINH §C)
// ════════════════════════════════════════════════════════════════════════════════════════════
//
// Bản cũ đọc wigs/wig_progress_v/wig_so_do/commitments/metrics_tuan_v — tất cả ĐÃ BỊ DROP. Viết
// lại từ đầu: MỌI con số đi qua hàm lõi / view invoker, màn này KHÔNG tự cộng gì.
//
// Bảy khu, đúng thứ tự 40-C:
//   ① Ba số tách  · thi_dua_lop()  — mục tiêu / việc / cam kết, KHÔNG gộp thành một điểm
//   ② Mục tiêu lớp · muc_tieu_v (cap='lop') + ô "Ghi số hôm nay" cho mục tiêu đo tay
//   ③ Việc của lớp · bang_lop_thuoc()  — "n/m bạn đủ", lẽ ra, trạng thái
//   ④ Cam kết lớp · cam_ket_v (chu_the='lop') — cô chấm Thắng/Thua
//   ⑤ Các em      · <BangCacEm> (bang_lop_em)  — chỉ đọc, dẫn sang bảng của em
//   ⑥ Mẫu         · muc_tieu_mau (≤8)  — cô soạn để em chỉ điền số
//   ⑦ Chờ duyệt   · mục tiêu em 'gui' + việc 'gui' + hạ chỉ tiêu 'cho_duyet'
//
// Tạo mục tiêu/việc của lớp (form 3 bước, gửi BGH duyệt) dùng CHUNG component form với màn em —
// khu ② chỉ có nút mở; component form là phần việc của PR-4 khác, không dựng lại ở đây.

type MucTieuV = {
  id: string;
  ten: string | null;
  linh_vuc: Area | null;
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
  const [
    {data: thiDua},
    {data: mtRows},
    {data: thuocRows},
    {data: ckRows},
    {data: mauRows},
    {data: enrolled},
    {data: mtCho},
    {data: thuocCho},
    {data: haCho},
  ] = await Promise.all([
    supabase.rpc('thi_dua_lop', {p_class: myClass.id}),
    supabase
      .from('muc_tieu_v')
      .select(
        'id, ten, linh_vuc, trang_thai, trang_thai_do, nguon_so, kieu_dich, chieu, chua_do_x, ket_thuc, ky, x_so, x_chu, y_so, y_chu, ten_don_vi, so, le_ra, pct, dang_tap_trung, ly_do_tra_lai, student_id',
      )
      .eq('class_id', myClass.id)
      .eq('cap', 'lop')
      .neq('trang_thai', 'dong'),
    supabase.rpc('bang_lop_thuoc', {p_class: myClass.id, p_tuan: monday}),
    supabase
      .from('cam_ket_v')
      .select(
        'id, noi_dung, so_hua, so_dat, ket_qua, ten_don_vi, muc_tieu_id, tuan_bat_dau, tuan_ket_thuc, so_tuan, trang_thai',
      )
      .eq('class_id', myClass.id)
      .eq('chu_the', 'lop'),
    supabase
      .from('muc_tieu_mau')
      .select('id, ten, linh_vuc, chieu, x_goi_y, y_goi_y')
      .eq('class_id', myClass.id)
      .eq('is_active', true)
      .limit(8),
    supabase
      .from('enrollments')
      .select('student_id, profiles!enrollments_student_id_fkey(full_name)')
      .eq('class_id', myClass.id)
      .eq('is_active', true),
    supabase
      .from('muc_tieu_v')
      .select('id, ten, linh_vuc, student_id, x_so, y_so, ten_don_vi, ket_thuc')
      .eq('class_id', myClass.id)
      .eq('cap', 'em')
      .eq('trang_thai', 'gui'),
    supabase
      .from('thuoc')
      .select('id, ten, student_id, chi_tieu_ky, chieu_dich')
      .eq('class_id', myClass.id)
      .eq('duyet', 'gui'),
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
  const thuoc = thuocRows ?? [];
  // Cam kết của tuần đang xem: khoảng [tuan_bat_dau, tuan_ket_thuc] GIAO tuần đang xem.
  const camKet = (ckRows ?? []).filter((c) => {
    const bd = c.tuan_bat_dau ?? '';
    const kt = c.tuan_ket_thuc ?? bd;
    return bd <= wk.end && kt >= wk.start;
  });
  const mau = mauRows ?? [];
  const haChoLop = (haCho ?? []).filter((r) => {
    const th = r.thuoc as {class_id: string | null} | {class_id: string | null}[] | null;
    const cid = Array.isArray(th) ? th[0]?.class_id : th?.class_id;
    return cid === myClass.id;
  });
  const soCho = (mtCho ?? []).length + (thuocCho ?? []).length + haChoLop.length;

  // ── Câu mô tả một mục tiêu (Từ x lên y đv · trước ngày) ────────────────────────────────────
  const cauMucTieu = (m: MucTieuV): string => {
    const dv = m.ten_don_vi ?? '';
    const x = m.x_chu ?? (m.x_so == null ? '' : String(m.x_so));
    const y = m.y_chu ?? (m.y_so == null ? '' : String(m.y_so));
    const ngay = ngayVN(m.ket_thuc);
    if (m.chua_do_x) return tMt('chuaBietDen', {y, dv, ngay});
    if (m.kieu_dich === 'giu') {
      const dau = m.chieu === 'giam' ? 'không quá' : m.chieu === 'tang' ? 'ít nhất' : '';
      return tMt('giuMuc', {dau, y, dv});
    }
    if (m.kieu_dich === 'tran_tich_luy') return tMt('caNamKhongQua', {y, dv});
    return m.chieu === 'giam'
      ? tMt('tuDenGiam', {x, y, dv, ngay})
      : tMt('tuDen', {x, y, dv, ngay});
  };

  // Nhãn trạng thái đã-đo (chỉ mục tiêu đã duyệt mới có nhịp thật để so).
  const nhanTrangThai = (m: MucTieuV): {text: string; cls: string} | null => {
    if (m.trang_thai === 'nhap') return {text: tMt('nhap'), cls: 'bg-navy/[0.06] text-grey-mid'};
    if (m.trang_thai === 'gui') return {text: tMt('choBghDuyet'), cls: 'bg-gold/[0.18] text-gold-text'};
    if (m.trang_thai === 'tra_lai') return {text: tMt('traLai'), cls: 'bg-status-bad/[0.12] text-status-bad'};
    const d = m.trang_thai_do;
    if (!d) return null;
    const xanh = d === 'dat' || d === 'dang_thang' || d === 'dang_giu';
    const do_ = d === 'can_co' || d === 'vuot' || d === 'truot';
    const cls = xanh
      ? 'bg-success/[0.12] text-success-dark'
      : do_
        ? 'bg-status-bad/[0.12] text-status-bad'
        : 'bg-gold/[0.18] text-gold-text';
    return {text: tMt(`tt_${d}`), cls};
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
        <p className="mt-2 text-[11.5px] font-semibold text-grey-mid">{t('baSoHint')}</p>
      </section>

      <div className="grid items-start gap-4 lg:grid-cols-[1.4fr_1fr]">
        {/* ── ② MỤC TIÊU CỦA LỚP ────────────────────────────────────────────────────────────── */}
        <section className="glass flex flex-col gap-3 rounded-[20px] p-[18px]">
          <h2 className="font-display text-[15px] font-bold text-navy">{t('khuMucTieu')}</h2>
          {mucTieuLop.length === 0 ? (
            <div className="rounded-[14px] border-[1.5px] border-dashed border-navy/20 p-5 text-center text-[12.5px] font-semibold text-grey-mid">
              {t('mucTieuTrong')}
            </div>
          ) : (
            mucTieuLop.map((m) => {
              const meta = areaMeta[(m.linh_vuc ?? 'knowledge') as Area];
              const nhan = nhanTrangThai(m);
              const dv = m.ten_don_vi ?? '';
              return (
                <div
                  key={m.id}
                  className="flex flex-col gap-2 rounded-[14px] border-[1.5px] border-navy/10 p-3.5"
                >
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
                  <p className="text-[12.5px] font-semibold text-grey-mid">{cauMucTieu(m)}</p>
                  {m.trang_thai === 'tra_lai' && m.ly_do_tra_lai && (
                    <p className="text-[11.5px] font-semibold text-status-bad">
                      {tMt('lyDoTraLai', {note: m.ly_do_tra_lai})}
                    </p>
                  )}
                  <div className="flex flex-wrap items-baseline gap-x-3 text-[12.5px] font-bold text-navy">
                    {m.so != null && <span>{tMt('dangO', {so: m.so, dv})}</span>}
                    {m.le_ra != null && (
                      <span className="text-grey-mid">{tMt('leRaHomNay', {so: m.le_ra, dv})}</span>
                    )}
                    {m.pct != null && <span className="tabular-nums text-grey-mid">{Math.round(Number(m.pct) * 100)}%</span>}
                  </div>
                  {/* Ghi số hôm nay — chỉ mục tiêu ĐO TAY đã duyệt (máy không đếm được). */}
                  {m.nguon_so === 'ghi_tay' && m.trang_thai === 'duyet' && (
                    <form action={ghiSoMucTieuLop} className="mt-1 flex flex-wrap items-end gap-2">
                      {ctx}
                      <input type="hidden" name="muc_tieu_id" value={m.id} />
                      <label className="flex flex-col gap-0.5 text-[10.5px] font-bold text-grey-mid">
                        {t('ghiSoNgay')}
                        <input
                          type="date"
                          name="ngay"
                          defaultValue={todayVN}
                          max={todayVN}
                          className="rounded-[8px] border-[1.5px] border-navy/20 px-2 py-1 text-[12.5px] text-navy"
                        />
                      </label>
                      <label className="flex flex-col gap-0.5 text-[10.5px] font-bold text-grey-mid">
                        {t('ghiSoHomNay')}
                        <input
                          type="number"
                          name="gia_tri"
                          step="any"
                          min="0"
                          inputMode="decimal"
                          className="w-24 rounded-[8px] border-[1.5px] border-navy/20 px-2 py-1 text-[12.5px] text-navy"
                        />
                      </label>
                      <button
                        type="submit"
                        className="rounded-[8px] bg-navy px-3 py-1.5 text-[12px] font-extrabold text-white transition-all hover:bg-navy/90"
                      >
                        {t('ghiSoGhi')}
                      </button>
                    </form>
                  )}
                </div>
              );
            })
          )}
        </section>

        {/* ── ③ VIỆC CỦA LỚP ────────────────────────────────────────────────────────────────── */}
        <section className="glass rounded-[20px] p-[18px]">
          <h2 className="mb-3 font-display text-[15px] font-bold text-navy">{t('khuViec')}</h2>
          {thuoc.length === 0 ? (
            <p className="text-[12.5px] font-semibold text-grey-mid">{t('viecTrong')}</p>
          ) : (
            <div className="flex flex-col gap-2">
              {thuoc.map((v) => {
                const xanh = v.trang_thai === 'dat' || v.trang_thai === 'dang_thang' || v.trang_thai === 'dang_giu';
                const do_ = v.trang_thai === 'can_co' || v.trang_thai === 'vuot' || v.trang_thai === 'truot';
                const chip = v.mien
                  ? 'bg-navy/[0.06] text-grey-mid'
                  : xanh
                    ? 'bg-success/[0.12] text-success-dark'
                    : do_
                      ? 'bg-status-bad/[0.12] text-status-bad'
                      : 'bg-gold/[0.18] text-gold-text';
                return (
                  <div
                    key={v.thuoc_id}
                    className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-[12px] border-[1.5px] border-navy/10 px-3 py-2"
                  >
                    <span className="min-w-0 flex-1 text-[13px] font-bold text-navy">{v.ten}</span>
                    <span className="text-[12px] font-extrabold tabular-nums text-navy">
                      {t('cotViec') === '' ? null : null}
                      {tViec('nEmDu', {n: v.so_em_dat, si: v.si_so})}
                    </span>
                    <span className={`inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[10px] font-extrabold ${chip}`}>
                      {v.mien ? tViec('oNghi') : v.trang_thai === 'dat' || v.trang_thai === 'dang_thang' ? tViec('du') : tViec('chuaDu')}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>

      {/* ── ④ CAM KẾT CỦA LỚP ───────────────────────────────────────────────────────────────── */}
      <section className="glass flex flex-col gap-3 rounded-[20px] p-[18px]">
        <h2 className="font-display text-[15px] font-bold text-navy">{t('khuCamKet')}</h2>
        {camKet.length === 0 ? (
          <p className="text-[12.5px] font-semibold text-grey-mid">{t('camKetTrong')}</p>
        ) : (
          camKet.map((c) => (
            <div key={c.id} className="flex flex-col gap-2 rounded-[14px] border-[1.5px] border-navy/10 p-3.5">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <span className="min-w-0 flex-1 font-display text-[14.5px] font-bold text-navy">
                  {c.noi_dung}
                </span>
                {c.so_hua != null && (
                  <span className="text-[11.5px] font-bold text-grey-mid tabular-nums">
                    {tCk('chipSo', {dat: c.so_dat ?? 0, hua: c.so_hua, dv: c.ten_don_vi ?? ''})}
                  </span>
                )}
                {c.ket_qua === 'thang' && (
                  <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-success/15 px-2 py-0.5 text-[10.5px] font-extrabold text-success-dark">
                    <Check size={11} strokeWidth={3} />
                    {tCk('thang')}
                  </span>
                )}
                {c.ket_qua === 'thua' && (
                  <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-status-bad/[0.12] px-2 py-0.5 text-[10.5px] font-extrabold text-status-bad">
                    {tCk('thua')}
                  </span>
                )}
              </div>
              {/* Cô chấm Thắng/Thua (RLS: chỉ GVCN/admin; nút văng lỗi nếu chấm sớm). */}
              <div className="flex flex-wrap items-center gap-2">
                <form action={chamCamKetLop} className="flex items-center gap-2">
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
                      className="w-28 rounded-[8px] border-[1.5px] border-navy/20 px-2 py-1 text-[12px] text-navy"
                    />
                  )}
                  <button
                    type="submit"
                    name="ket_qua"
                    value="thang"
                    className="inline-flex items-center gap-1 rounded-[8px] border-[1.5px] border-success/40 bg-success/[0.12] px-2.5 py-1 text-[12px] font-extrabold text-success-dark transition-all hover:bg-success/20"
                  >
                    <Check size={12} strokeWidth={3} />
                    {tCk('thang')}
                  </button>
                  <button
                    type="submit"
                    name="ket_qua"
                    value="thua"
                    className="inline-flex items-center gap-1 rounded-[8px] border-[1.5px] border-status-bad/40 bg-status-bad/[0.08] px-2.5 py-1 text-[12px] font-extrabold text-status-bad transition-all hover:bg-status-bad/15"
                  >
                    <X size={12} strokeWidth={3} />
                    {tCk('thua')}
                  </button>
                </form>
                <form action={xoaCamKetLop}>
                  {ctx}
                  <input type="hidden" name="cam_ket_id" value={c.id ?? undefined} />
                  <button type="submit" className="text-[11.5px] font-bold text-grey-mid hover:text-status-bad">
                    {tCk('huy')}
                  </button>
                </form>
              </div>
            </div>
          ))
        )}
        {/* Đặt cam kết của lớp cho tuần đang xem. */}
        <details className="rounded-[14px] border-[1.5px] border-dashed border-navy/20 p-3">
          <summary className="cursor-pointer text-[12.5px] font-extrabold text-navy">
            {t('themCamKet')}
          </summary>
          <form action={taoCamKetLop} className="mt-2 flex flex-col gap-2">
            {ctx}
            <input type="hidden" name="tuan_bat_dau" value={monday} />
            <input
              name="noi_dung"
              maxLength={300}
              placeholder={tCk('noiDungLop')}
              className="rounded-[8px] border-[1.5px] border-navy/20 px-2.5 py-1.5 text-[13px] text-navy"
            />
            <div className="flex flex-wrap items-center gap-2">
              <input
                type="number"
                name="so_hua"
                step="any"
                min="0"
                placeholder={tCk('soHua')}
                className="w-28 rounded-[8px] border-[1.5px] border-navy/20 px-2 py-1 text-[12.5px] text-navy"
              />
              {mucTieuLop.length > 0 && (
                <select
                  name="muc_tieu_id"
                  className="rounded-[8px] border-[1.5px] border-navy/20 px-2 py-1 text-[12.5px] text-navy"
                >
                  <option value="">{tCk('giupKhongCo')}</option>
                  {mucTieuLop.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.ten ?? ''}
                    </option>
                  ))}
                </select>
              )}
              <button
                type="submit"
                className="rounded-[8px] bg-navy px-3 py-1.5 text-[12px] font-extrabold text-white transition-all hover:bg-navy/90"
              >
                {tCk('luu')}
              </button>
            </div>
          </form>
        </details>
      </section>

      {/* ── ⑤ CÁC EM TUẦN NÀY (component chung, tự đọc bang_lop_em) ─────────────────────────── */}
      <BangCacEm classId={myClass.id} monday={monday} weekQ={weekQ} classParam={classParam} />

      {/* ── ⑥ MẪU MỤC TIÊU cho các em ──────────────────────────────────────────────────────── */}
      <section className="glass flex flex-col gap-3 rounded-[20px] p-[18px]">
        <h2 className="font-display text-[15px] font-bold text-navy">{t('khuMau')}</h2>
        {mau.length === 0 ? (
          <p className="text-[12.5px] font-semibold text-grey-mid">{t('mauTrong')}</p>
        ) : (
          <div className="flex flex-col gap-2">
            {mau.map((mm) => {
              const meta = areaMeta[(mm.linh_vuc ?? 'knowledge') as Area];
              return (
                <div
                  key={mm.id}
                  className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-[12px] border-[1.5px] border-navy/10 px-3 py-2"
                >
                  <span
                    className="inline-flex w-fit shrink-0 items-center rounded-full px-2 py-0.5 text-[10px] font-extrabold"
                    style={{background: meta.soft, color: meta.hex}}
                  >
                    {areaLabel(meta, locale)}
                  </span>
                  <span className="min-w-0 flex-1 text-[13px] font-bold text-navy">{mm.ten}</span>
                  {(mm.x_goi_y != null || mm.y_goi_y != null) && (
                    <span className="text-[11.5px] font-semibold text-grey-mid tabular-nums">
                      {mm.x_goi_y ?? '?'} → {mm.y_goi_y ?? '?'}
                    </span>
                  )}
                  <form action={xoaMau}>
                    {ctx}
                    <input type="hidden" name="mau_id" value={mm.id} />
                    <button type="submit" className="text-[11.5px] font-bold text-grey-mid hover:text-status-bad">
                      {t('mauXoa')}
                    </button>
                  </form>
                </div>
              );
            })}
          </div>
        )}
        {mau.length < 8 && (
          <details className="rounded-[14px] border-[1.5px] border-dashed border-navy/20 p-3">
            <summary className="cursor-pointer text-[12.5px] font-extrabold text-navy">{t('mauThem')}</summary>
            <form action={taoMau} className="mt-2 flex flex-col gap-2">
              {ctx}
              <input
                name="ten"
                maxLength={120}
                placeholder={t('mauTen')}
                className="rounded-[8px] border-[1.5px] border-navy/20 px-2.5 py-1.5 text-[13px] text-navy"
              />
              <div className="flex flex-wrap items-center gap-2">
                <select
                  name="linh_vuc"
                  defaultValue="knowledge"
                  className="rounded-[8px] border-[1.5px] border-navy/20 px-2 py-1 text-[12.5px] text-navy"
                >
                  {AREAS.map((a) => (
                    <option key={a} value={a}>
                      {areaLabel(areaMeta[a], locale)}
                    </option>
                  ))}
                </select>
                <select
                  name="chieu"
                  defaultValue="tang"
                  className="rounded-[8px] border-[1.5px] border-navy/20 px-2 py-1 text-[12.5px] text-navy"
                >
                  <option value="tang">{tViec('chieuItNhat')}</option>
                  <option value="giam">{tViec('chieuKhongQua')}</option>
                </select>
                <input
                  type="number"
                  name="x_goi_y"
                  step="any"
                  placeholder="x"
                  className="w-16 rounded-[8px] border-[1.5px] border-navy/20 px-2 py-1 text-[12.5px] text-navy"
                />
                <input
                  type="number"
                  name="y_goi_y"
                  step="any"
                  placeholder="y"
                  className="w-16 rounded-[8px] border-[1.5px] border-navy/20 px-2 py-1 text-[12.5px] text-navy"
                />
                <button
                  type="submit"
                  className="rounded-[8px] bg-navy px-3 py-1.5 text-[12px] font-extrabold text-white transition-all hover:bg-navy/90"
                >
                  {t('ghiSoGhi')}
                </button>
              </div>
            </form>
          </details>
        )}
      </section>

      {/* ── ⑦ CHỜ DUYỆT ─────────────────────────────────────────────────────────────────────── */}
      <section className="glass flex flex-col gap-3 rounded-[20px] p-[18px]">
        <h2 className="font-display text-[15px] font-bold text-navy">
          {soCho > 0 ? tDuyet('choDuyetN', {n: soCho}) : tDuyet('choDuyet')}
        </h2>
        <p className="text-[11.5px] font-semibold text-grey-mid">{tDuyet('luuY')}</p>
        {soCho === 0 ? (
          <p className="text-[12.5px] font-semibold text-grey-mid">{tDuyet('khongCo')}</p>
        ) : (
          <div className="flex flex-col gap-2">
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
                  <button
                    type="submit"
                    className="rounded-full border-[1.5px] border-gold-deep/40 bg-gold/[0.18] px-2.5 py-0.5 text-[10.5px] font-extrabold text-gold-text transition-all hover:bg-gold/30"
                  >
                    {tDuyet('duyet')}
                  </button>
                </form>
                <details className="relative">
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
                    <button type="submit" className="self-start rounded-[8px] bg-navy px-2.5 py-1 text-[11px] font-extrabold text-white">
                      {tDuyet('traLaiGui')}
                    </button>
                  </form>
                </details>
              </div>
            ))}
            {(thuocCho ?? []).map((v) => (
              <div
                key={v.id}
                className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-[12px] border-[1.5px] border-navy/10 px-3 py-2"
              >
                <span className="rounded-full bg-navy/[0.06] px-2 py-0.5 text-[10px] font-extrabold text-grey-mid">
                  {tDuyet('loaiViec')}
                </span>
                <span className="min-w-0 flex-1 text-[13px] font-bold text-navy">
                  {v.ten} <span className="font-semibold text-grey-mid">{tDuyet('cua', {ten: tenEm.get(v.student_id ?? '') ?? ''})}</span>
                </span>
                <form action={duyetThuoc} className="contents">
                  {ctx}
                  <input type="hidden" name="thuoc_id" value={v.id} />
                  <button
                    type="submit"
                    className="rounded-full border-[1.5px] border-gold-deep/40 bg-gold/[0.18] px-2.5 py-0.5 text-[10.5px] font-extrabold text-gold-text transition-all hover:bg-gold/30"
                  >
                    {tDuyet('duyet')}
                  </button>
                </form>
                <details>
                  <summary className="cursor-pointer list-none rounded-[8px] border-[1.5px] border-navy/20 bg-white px-2.5 py-0.5 text-[11px] font-extrabold text-navy hover:border-navy">
                    {tDuyet('traLai')}
                  </summary>
                  <form action={traLaiThuoc} className="mt-1 flex flex-col gap-1">
                    {ctx}
                    <input type="hidden" name="thuoc_id" value={v.id} />
                    <textarea
                      name="note"
                      maxLength={300}
                      placeholder={tDuyet('traLaiNhan')}
                      className="w-full rounded-[8px] border-[1.5px] border-navy/20 px-2 py-1 text-[12px] text-navy"
                    />
                    <button type="submit" className="self-start rounded-[8px] bg-navy px-2.5 py-1 text-[11px] font-extrabold text-white">
                      {tDuyet('traLaiGui')}
                    </button>
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
                    <button
                      type="submit"
                      className="rounded-full border-[1.5px] border-gold-deep/40 bg-gold/[0.18] px-2.5 py-0.5 text-[10.5px] font-extrabold text-gold-text transition-all hover:bg-gold/30"
                    >
                      {tDuyet('duyet')}
                    </button>
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

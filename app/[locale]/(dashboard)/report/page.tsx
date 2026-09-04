import {after} from 'next/server';
import {getTranslations, setRequestLocale} from 'next-intl/server';
import {requireRole} from '@/lib/auth';
import {createClient} from '@/lib/supabase/server';
import {Check, X, Images, ChevronRight, Target, ListChecks, Flag, Star, Users} from 'lucide-react';
import {TodayMenuCard} from '@/components/menu/TodayMenuCard';
import {Link} from '@/i18n/navigation';
import {ChonTuanCuaEm} from '@/components/student/ChonTuanCuaEm';
import {getAreaMeta} from '@/lib/area-config';
import {AREAS, type Area} from '@/lib/areas';
import {thuoc12TuanNhieu} from '@/lib/rpc-nhieu';
import {todayInVN, mondayOf, isValidDayVN, weekDaysVN, isoWeekLabel, vnNoon, isoDowVN} from '@/lib/dates';

// ── BÁO CÁO PHỤ HUYNH (PA2) — CHỈ ĐỌC ────────────────────────────────────────────────────────
//
// Phụ huynh nhìn thấy đúng bảng của con theo mô hình mục tiêu mới, nhưng KHÔNG nút nào bấm được
// (RLS phụ huynh là select-only). Đọc thẳng khung nhìn/hàm CSDL — không tự cộng số (L12):
//   · Mục tiêu của con năm nay   → muc_tieu_v (con, cap='em')
//   · Việc con làm tuần này       → viec_bang(con) + thuoc_12_tuan + luot(con) của tuần
//   · Cam kết tuần này            → cam_ket_v (con), lọc theo tuần đang xem
//   · Con đã họp với bạn?         → pdr_da_ky(con, tuần)
// Chữ để bố mẹ đọc lướt: namespace report.* (bản VI không "WIG/lead/PDR"); nhãn thẻ tái dùng
// mucTieu.* / viec.* / camKet.* — cùng chữ với màn của con nên hai bên không nói hai giọng.
// Nút xác nhận cam kết của phụ huynh/bạn: ĐỂ SAU (H-28).

// Màu lĩnh vực 'khac' (ngoài 4 AREAS) — bảng màu riêng, khớp StudentScoreboard.
const MAU_KHAC = {hex: '#6b7093', soft: 'rgba(107,112,147,0.14)'};

// Trạng thái đích có nhãn đọc được (mucTieu.tt_*).
const TT_DO = new Set([
  'dat', 'dang_thang', 'dang_giu', 'sat_nut', 'dang_lam', 'chua_biet', 'can_co', 'vuot', 'truot', 'mien', 'dong',
]);

const so = (n: number | null | undefined) =>
  n == null ? '0' : Number.isInteger(n) ? String(n) : String(Math.round(n * 100) / 100);
const ddmm = (s: string | null) => (s ? `${s.slice(8, 10)}/${s.slice(5, 7)}` : '');
function themNgay(s: string, delta: number): string {
  const d = new Date(s + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() + delta);
  return d.toISOString().slice(0, 10);
}

type MtRow = {
  id: string;
  ten: string | null;
  linh_vuc: string | null;
  trang_thai: string | null;
  trang_thai_do: string | null;
  pct: number | null;
  so: number | null;
  ten_don_vi: string | null;
  le_ra: number | null;
  nguon_so: string | null;
  nguon: string | null;
  ngay_nguon: string | null;
  so_nguon: number | null;
  dang_tap_trung: boolean | null;
  ly_do_tra_lai: string | null;
  y_so: number | null;
};
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
  chi_xem: boolean | null;
};
type TuanRow = {tuan: string; gia: number; chi_tieu: number; dat: boolean; trang_thai: string; la_tuan_hoc: boolean};
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
  muc_tieu_id: string | null;
  thuoc_id: string | null;
  lac_muc_tieu: boolean | null;
};

export default async function ReportPage({
  params,
  searchParams,
}: {
  params: Promise<{locale: string}>;
  searchParams: Promise<{week?: string; child?: string}>;
}) {
  const {locale} = await params;
  const {week: weekParam, child: childParam} = await searchParams;
  setRequestLocale(locale);
  void locale;
  // Chỉ phụ huynh — admin đã có /admin và /student/[id], không xem báo cáo con ngẫu nhiên.
  await requireRole(['parent']);
  const t = await getTranslations('report');
  const tm = await getTranslations('mucTieu');
  const tv = await getTranslations('viec');
  const tc = await getTranslations('camKet');
  const ts = await getTranslations('student');
  const supabase = await createClient();

  // Tuần đang xem: bất kỳ ngày nào trong ?week= → thứ Hai của tuần đó; thiếu = tuần chứa hôm nay.
  const today = todayInVN();
  const thisMonday = mondayOf(today);
  const monday = isValidDayVN(weekParam) ? mondayOf(weekParam!) : thisMonday;
  const weekDays = weekDaysVN(monday);
  const nhanTuan = isoWeekLabel(vnNoon(monday));

  // Cấu hình lĩnh vực + danh sách con — hai thứ độc lập, chạy song song.
  const [areaMeta, {data: links}] = await Promise.all([
    getAreaMeta(),
    // TẤT CẢ con của phụ huynh (RLS pl_parent_self chỉ trả link của chính họ).
    supabase.from('parent_links').select('student_id, profiles!parent_links_student_id_fkey(full_name)'),
  ]);
  const mauCua = (lv: string) => {
    if ((AREAS as readonly string[]).includes(lv)) {
      const m = areaMeta[lv as Area];
      return {hex: m.hex, soft: m.soft};
    }
    return MAU_KHAC;
  };
  const children = ((links ?? []) as unknown as {student_id: string; profiles: {full_name: string | null} | null}[])
    .map((l) => ({id: l.student_id, name: l.profiles?.full_name ?? l.student_id}))
    .sort((a, b) => a.name.localeCompare(b.name, 'vi'));
  // Con đang xem: theo ?child= nếu hợp lệ (thuộc phụ huynh), ngược lại con đầu.
  const childId = childParam && children.some((c) => c.id === childParam) ? childParam : children[0]?.id;

  if (!childId) {
    return (
      <div className="glass rounded-[20px] p-10 text-center">
        <h1 className="font-display text-xl font-bold text-navy">{t('title')}</h1>
        <p className="mt-2 text-sm text-grey-mid">{t('noChild')}</p>
      </div>
    );
  }

  // ── ĐỢT MỘT: chỉ cần childId/monday ─────────────────────────────────────────────────────────
  const [{data: child}, {data: enr}, {data: att}, mucTieuRes, viecRes, camKetRes, {data: daHop}] =
    await Promise.all([
      supabase.from('profiles').select('full_name, email').eq('id', childId).maybeSingle(),
      supabase
        .from('enrollments')
        .select('class_id, classes(name, school_year, campus_id)')
        .eq('student_id', childId)
        .eq('is_active', true)
        .order('class_id')
        .limit(1)
        .maybeSingle(),
      supabase.from('attendance_records').select('status').eq('student_id', childId),
      supabase
        .from('muc_tieu_v')
        .select(
          'id, ten, linh_vuc, trang_thai, trang_thai_do, pct, so, ten_don_vi, le_ra, nguon_so, nguon, ngay_nguon, so_nguon, dang_tap_trung, ly_do_tra_lai, y_so, created_at',
        )
        .eq('student_id', childId)
        .eq('cap', 'em')
        .order('created_at'),
      supabase.rpc('viec_bang', {p_student: childId}),
      supabase
        .from('cam_ket_v')
        .select(
          'id, noi_dung, trang_thai, ket_qua, so_hua, so_dat, ten_don_vi, so_tuan, tuan_bat_dau, tuan_ket_thuc, xong_at, muc_tieu_id, thuoc_id, lac_muc_tieu',
        )
        .eq('student_id', childId),
      // Con đã ký biên bản họp với bạn cho tuần đang xem chưa? (definer, phụ huynh gọi được.)
      supabase.rpc('pdr_da_ky', {p_student: childId, d: monday}),
    ]);

  const enrRow = enr as unknown as {class_id: string; classes: {name: string; school_year: string; campus_id: string | null} | null} | null;
  const cls = enrRow?.classes;
  const campusId = cls?.campus_id ?? null;

  const counts: Record<string, number> = {present: 0, absent: 0, late: 0, excused: 0};
  (att ?? []).forEach((a) => {
    counts[a.status] = (counts[a.status] ?? 0) + 1;
  });

  const mtRows = (mucTieuRes.data ?? []) as MtRow[];
  const tenMucTieuTheoId = new Map(mtRows.map((m) => [m.id, m.ten ?? '']));
  const viecRows = (viecRes.data ?? []) as ViecRow[];
  const tenViecTheoThuoc = new Map(viecRows.map((v) => [v.thuoc_id, v.ten ?? '']));
  const thuocIds = viecRows.map((v) => v.thuoc_id);

  // ── ĐỢT HAI: cần thuocIds / campusId ────────────────────────────────────────────────────────
  // 12 tuần của MỌI thước trong MỘT lượt RPC (0187 thuoc_12_tuan_nhieu; tự lùi về từng cái nếu
  // CSDL chưa có hàm) — thay vì N request song song dính đuôi trễ trên đường mạng rớt gói.
  const [luotRes, tuanHocRes, tuan12Map] = await Promise.all([
    thuocIds.length > 0
      ? supabase
          .from('luot')
          .select('thuoc_id, ngay, gia_tri')
          .in('thuoc_id', thuocIds)
          .eq('student_id', childId)
          .gte('ngay', weekDays[0])
          .lte('ngay', weekDays[6])
      : Promise.resolve({data: null}),
    campusId
      ? supabase.from('tuan_hoc').select('loai').eq('campus_id', campusId).eq('week_start', monday).maybeSingle()
      : Promise.resolve({data: null}),
    thuoc12TuanNhieu(supabase, thuocIds, childId, monday),
  ]);
  const tuan12Res = thuocIds.map((id) => ({data: tuan12Map.get(id) ?? []}));

  const luotTheoThuoc: Record<string, Record<string, number>> = {};
  for (const r of (luotRes.data ?? []) as {thuoc_id: string; ngay: string; gia_tri: number}[]) {
    (luotTheoThuoc[r.thuoc_id] ??= {})[r.ngay] = (luotTheoThuoc[r.thuoc_id][r.ngay] ?? 0) + Number(r.gia_tri ?? 0);
  }
  const tuanNghi = (tuanHocRes.data as {loai: string} | null)?.loai === 'nghi';

  const viec = viecRows.map((v, i) => ({
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
    chi_xem: Boolean(v.chi_xem),
    muoiHaiTuan: ((tuan12Res[i]?.data ?? []) as TuanRow[]).map((w) => ({
      tuan: w.tuan,
      gia: Number(w.gia ?? 0),
      chi_tieu: Number(w.chi_tieu ?? 0),
      dat: Boolean(w.dat),
      trang_thai: w.trang_thai,
      la_tuan_hoc: Boolean(w.la_tuan_hoc),
    })),
    ngayLuot: luotTheoThuoc[v.thuoc_id] ?? {},
  }));

  // Cam kết phủ tuần đang xem (tuan_bat_dau ≤ monday ≤ tuần cuối).
  const camKet = ((camKetRes.data ?? []) as CkRow[])
    .filter((c) => {
      if (!c.tuan_bat_dau) return false;
      const end = c.tuan_ket_thuc ?? themNgay(c.tuan_bat_dau, (Math.max(1, c.so_tuan ?? 1) - 1) * 7);
      return c.tuan_bat_dau <= monday && end >= monday;
    })
    .map((c) => ({
      id: c.id,
      noi_dung: c.noi_dung ?? '',
      ket_qua: c.ket_qua,
      so_hua: c.so_hua,
      so_dat: c.so_dat,
      ten_don_vi: c.ten_don_vi,
      so_tuan: Number(c.so_tuan ?? 1),
      lac_muc_tieu: c.lac_muc_tieu,
      tenMucTieu: c.muc_tieu_id ? tenMucTieuTheoId.get(c.muc_tieu_id) ?? null : null,
      tenViec: c.thuoc_id ? tenViecTheoThuoc.get(c.thuoc_id) ?? null : null,
    }));

  const daKyHop = daHop === true;
  const dayShort = ts.raw('dayShort') as string[];

  const statuses = ['present', 'absent', 'late', 'excused'] as const;
  const statusColor: Record<string, string> = {
    present: 'text-success-dark',
    absent: 'text-status-bad',
    late: 'text-warn-text',
    excused: 'text-grey-mid',
  };

  // Ghi audit truy cập báo cáo nhạy cảm (§12.4) — KHÔNG await (việc của hệ thống, sau phản hồi).
  after(() => {
    void supabase.rpc('log_audit', {
      p_action: 'view_parent_report',
      p_detail: {student_id: childId, week: nhanTuan},
    });
  });

  return (
    <div className="space-y-6">
      {/* Hero + chọn con + thanh tuần */}
      <div className="glass animate-rise rounded-[20px] p-6 sm:p-7">
        <div className="flex flex-wrap items-start gap-4">
          <div className="min-w-0">
            <h1 className="font-display text-hien-thi font-bold leading-tight text-navy">
              {child?.full_name ?? t('child')}
            </h1>
            {cls && (
              <p className="mt-1 text-than font-bold text-txt">
                {t('class')}: <b className="text-navy">{cls.name}</b>{' '}
                <span className="text-grey-mid">· {cls.school_year}</span>
              </p>
            )}
          </div>
          {children.length > 1 && (
            <div className="ml-auto flex flex-wrap justify-end gap-1.5">
              {children.map((c) => (
                <Link
                  key={c.id}
                  href={{pathname: '/report', query: c.id === childId ? {} : {child: c.id}}}
                  className={`rounded-full border px-2.5 py-1 text-chu-thich font-bold transition-colors ${
                    c.id === childId
                      ? 'border-navy bg-navy text-white'
                      : 'border-navy/15 bg-navy/[0.02] text-navy hover:border-navy'
                  }`}
                >
                  {c.name}
                </Link>
              ))}
            </div>
          )}
        </div>
        <div className="mt-4 border-t border-navy/[0.08] pt-4">
          <ChonTuanCuaEm
            pathname="/report"
            monday={monday}
            thisMonday={thisMonday}
            label={nhanTuan}
            start={weekDays[0]}
            end={weekDays[6]}
          />
        </div>
      </div>

      {/* Điểm danh — cộng dồn cả năm (không đổi theo tuần) */}
      <section>
        <h2 className="mb-3 font-display text-tieu-de font-bold text-navy">{t('attendance')}</h2>
        <div className="grid grid-cols-2 gap-3.5 sm:grid-cols-4">
          {statuses.map((s) => (
            <div key={s} className="glass glass-hover rounded-[20px] p-4 text-center">
              <div className={`font-display text-hien-thi font-bold ${statusColor[s]}`}>{counts[s] ?? 0}</div>
              <div className="mt-1 text-xs font-extrabold text-txt">{t(s)}</div>
            </div>
          ))}
        </div>
        <p className="mt-2 text-chu-thich font-semibold italic leading-relaxed text-grey-mid">{t('attendanceNote')}</p>
      </section>

      {/* ① Mục tiêu của con năm nay — ≤4 thẻ chỉ đọc */}
      <section>
        <h2 className="mb-3 flex items-center gap-2 font-display text-tieu-de font-bold text-navy">
          <Target size={16} strokeWidth={2.5} className="text-gold-deep" />
          {t('wigProgress')}
        </h2>
        {mtRows.length === 0 ? (
          <p className="glass rounded-[16px] p-5 text-than italic text-grey-mid">{tm('trong')}</p>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {mtRows.map((mt) => {
              const mau = mauCua(mt.linh_vuc ?? 'khac');
              const dong = mt.trang_thai === 'dong';
              const ttDo = mt.trang_thai_do && TT_DO.has(mt.trang_thai_do) ? tm(`tt_${mt.trang_thai_do}`) : null;
              const pct = mt.pct == null ? null : Math.round(mt.pct * 100);
              let nguonDong: string | null = null;
              if (mt.nguon_so === 'ghi_tay' && mt.ngay_nguon) nguonDong = tm('nguonEm', {ngay: ddmm(mt.ngay_nguon)});
              else if (mt.nguon === 'may_tu_thuoc') nguonDong = tm('nguonMay', {n: mt.so_nguon ?? 0});
              else if (mt.nguon === 'may_tu_con') nguonDong = tm('nguonCon', {n: mt.so_nguon ?? 0});
              else if (mt.nguon === 'may_tu_thanh_phan') nguonDong = tm('nguonThanhPhan', {n: mt.so_nguon ?? 0});
              return (
                <div
                  key={mt.id}
                  className={`relative flex flex-col rounded-[16px] border-l-[4px] p-3.5 ${dong ? 'opacity-70' : ''}`}
                  style={{borderLeftColor: mau.hex, background: mau.soft}}
                >
                  <div className="flex items-start gap-2">
                    <span className="min-w-0 flex-1 text-noi-dung font-extrabold leading-snug text-navy">{mt.ten}</span>
                    {mt.dang_tap_trung && !dong && (
                      <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-gold/25 px-2 py-0.5 text-chu-thich font-extrabold text-gold-text">
                        <Star size={12} strokeWidth={2.5} /> {tm('dangTapTrung')}
                      </span>
                    )}
                  </div>

                  {mt.nguon_so !== 'khong_so' && (
                    <div className="mt-1.5">
                      <div className="text-than font-bold text-txt">
                        {mt.so == null ? tm('chuaCoSo') : tm('dangO', {so: so(mt.so), dv: mt.ten_don_vi ?? ''})}
                      </div>
                      {nguonDong && <div className="text-chu-thich font-semibold text-grey-mid">{nguonDong}</div>}
                    </div>
                  )}

                  {pct != null && (
                    <div className="mt-2">
                      <div className="relative h-2.5 w-full overflow-hidden rounded-full bg-navy/10">
                        <div
                          className="absolute inset-y-0 left-0 rounded-full"
                          style={{width: `${Math.max(2, Math.min(100, pct))}%`, background: mau.hex}}
                        />
                      </div>
                      {mt.le_ra != null && mt.y_so != null && mt.y_so !== 0 && (
                        <div className="mt-1 text-chu-thich font-semibold text-grey-mid">
                          {tm('leRaHomNay', {so: so(mt.le_ra), dv: mt.ten_don_vi ?? ''})}
                        </div>
                      )}
                    </div>
                  )}

                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    {ttDo && !dong && (
                      <span className="rounded-full bg-navy/[0.06] px-2 py-0.5 text-chu-thich font-extrabold text-navy">{ttDo}</span>
                    )}
                    {dong && (
                      <span className="rounded-full bg-navy/[0.06] px-2 py-0.5 text-chu-thich font-extrabold text-grey-mid">
                        {tm('daDong')}
                      </span>
                    )}
                    {mt.trang_thai === 'gui' && (
                      <span className="rounded-full bg-gold/20 px-2 py-0.5 text-chu-thich font-extrabold text-gold-text">
                        {tm('choDuyet')}
                      </span>
                    )}
                    {mt.trang_thai === 'nhap' && (
                      <span className="rounded-full bg-navy/[0.06] px-2 py-0.5 text-chu-thich font-extrabold text-grey-mid">
                        {tm('nhap')}
                      </span>
                    )}
                    {mt.trang_thai === 'tra_lai' && (
                      <span className="rounded-full bg-status-bad/[0.1] px-2 py-0.5 text-chu-thich font-extrabold text-status-bad">
                        {tm('traLai')}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* ② Việc con làm tuần này — hàng chỉ đọc (12 ô tuần + 7 ô ngày, không nút) */}
      <section>
        <h2 className="mb-3 flex items-center gap-2 font-display text-tieu-de font-bold text-navy">
          <ListChecks size={16} strokeWidth={2.5} className="text-gold-deep" />
          {t('viecTuan')}
        </h2>
        {viec.length === 0 ? (
          <p className="glass rounded-[16px] p-5 text-than italic text-grey-mid">{t('noWeekData')}</p>
        ) : (
          <div className="glass flex flex-col overflow-hidden rounded-[16px]">
            {viec.map((v, i) => {
              const kieng = v.chieu_dich === 'nhieu_nhat';
              let ttNhan = tv('dangChay');
              let ttMau = 'text-grey-mid';
              if (v.trang_thai === 'mien') ttNhan = tv('oNghi');
              else if (v.dat) {
                ttNhan = tv('du');
                ttMau = 'text-success-dark';
              } else if (v.trang_thai === 'chua_bat_dau') ttNhan = tv('oChuaBatDau');
              else {
                ttNhan = tv('chuaDu');
                ttMau = 'text-gold-text';
              }
              const kyNhan =
                v.ky_tuan === 2 ? tv('ky2Tuan') : v.ky_tuan === 4 ? tv('ky4Tuan') : tv('kyTuan');
              return (
                <div key={v.thuoc_id} className={`px-3.5 py-3 ${i > 0 ? 'border-t border-navy/10' : ''}`}>
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span className="min-w-0 flex-1 text-noi-dung font-extrabold text-navy">{v.ten}</span>
                    <span className={`text-chu-thich font-extrabold ${ttMau}`}>{ttNhan}</span>
                  </div>
                  <div className="mt-0.5 text-chu-thich font-semibold text-grey-mid">
                    {kieng
                      ? tv('chiTieuKhongQua', {n: so(v.chi_tieu), dv: v.ten_don_vi ?? '', ky: kyNhan})
                      : tv('chiTieu', {n: so(v.chi_tieu), dv: v.ten_don_vi ?? '', ky: kyNhan})}
                    {' · '}
                    {tv('tuanNayDuoc', {so: so(v.gia), n: so(v.chi_tieu), dv: v.ten_don_vi ?? ''})}
                  </div>

                  {/* 12 ô tuần */}
                  <div className="mt-2">
                    <div className="text-nhan font-bold uppercase tracking-wide text-grey-mid">{tv('muoiHaiTuan')}</div>
                    <div className="mt-1 flex gap-[3px]">
                      {v.muoiHaiTuan.map((w) => {
                        let bg = 'bg-navy/[0.06]';
                        if (!w.la_tuan_hoc) bg = 'bg-navy/[0.03]';
                        else if (w.dat) bg = 'bg-success/70';
                        else if (w.trang_thai === 'sat_nut') bg = 'bg-gold/70';
                        else if (w.gia > 0) bg = 'bg-status-bad/50';
                        return (
                          <span
                            key={w.tuan}
                            className={`h-3.5 flex-1 rounded-[8px] ${bg}`}
                            title={`${w.tuan}: ${so(w.gia)}/${so(w.chi_tieu)}`}
                          />
                        );
                      })}
                    </div>
                  </div>

                  {/* 7 ô ngày — chỉ đọc */}
                  <div className="mt-2 grid grid-cols-7 gap-[3px]">
                    {weekDays.map((d, di) => {
                      const ap = v.ngay_ap_dung.includes(isoDowVN(d));
                      const giaNgay = v.ngayLuot[d] ?? 0;
                      const coSo = giaNgay > 0;
                      if (!ap) {
                        return (
                          <div key={d} className="flex flex-col items-center">
                            <span className="text-chu-thich font-bold text-grey-mid/70">{dayShort[di]}</span>
                            <span className="mt-0.5 grid h-8 w-full place-items-center rounded-[8px] bg-navy/[0.02] text-chu-thich text-grey-mid/40">
                              ·
                            </span>
                          </div>
                        );
                      }
                      return (
                        <div key={d} className="flex flex-col items-center">
                          <span className="text-chu-thich font-bold text-grey-mid">{dayShort[di]}</span>
                          <span
                            className={`mt-0.5 grid h-8 w-full place-items-center rounded-[8px] text-chu-thich font-extrabold ${
                              coSo
                                ? kieng
                                  ? 'bg-status-bad/70 text-white'
                                  : 'bg-success/80 text-white'
                                : 'bg-navy/[0.03] text-grey-mid/40'
                            }`}
                          >
                            {coSo ? (v.cach_ghi === 'cham' ? giaNgay : so(giaNgay)) : ''}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* ③ Cam kết tuần này — thẻ chỉ đọc (nút xác nhận để sau, H-28) */}
      <section>
        <h2 className="mb-3 flex items-center gap-2 font-display text-tieu-de font-bold text-navy">
          <Flag size={16} strokeWidth={2.5} className="text-gold-deep" />
          {t('camKetTuan')}
        </h2>
        {camKet.length === 0 ? (
          <p className="glass rounded-[16px] p-5 text-than italic text-grey-mid">{t('noWeekData')}</p>
        ) : (
          <div className="flex flex-col gap-3">
            {camKet.map((c) => {
              const daCham = c.ket_qua != null;
              return (
                <div key={c.id} className="glass rounded-[16px] border-l-[3px] border-gold-mid p-3.5">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span className="min-w-0 flex-1 text-noi-dung font-extrabold text-navy">{c.noi_dung}</span>
                    {c.so_hua != null && (
                      <span className="rounded-full bg-navy/[0.06] px-2 py-0.5 text-chu-thich font-bold text-navy">
                        {tc('chipSo', {dat: so(c.so_dat ?? 0), hua: so(c.so_hua), dv: c.ten_don_vi ?? ''})}
                      </span>
                    )}
                    {daCham ? (
                      <span
                        className={`rounded-full px-2 py-0.5 text-chu-thich font-extrabold ${
                          c.ket_qua === 'thang' ? 'bg-success/15 text-success-dark' : 'bg-status-bad/[0.1] text-status-bad'
                        }`}
                      >
                        {c.ket_qua === 'thang' ? tc('thang') : tc('thua')}
                      </span>
                    ) : (
                      <span className="rounded-full bg-navy/[0.06] px-2 py-0.5 text-chu-thich font-bold text-grey-mid">
                        {c.so_tuan > 1 ? tc('tuanN', {n: 1, tong: c.so_tuan}) : tc('chuaCham')}
                      </span>
                    )}
                  </div>
                  {c.tenViec ? (
                    <p className="mt-1 text-chu-thich font-semibold text-grey-mid">{tc('giupViec', {ten: c.tenViec})}</p>
                  ) : c.tenMucTieu ? (
                    <p className="mt-1 text-chu-thich font-semibold text-grey-mid">{tc('giupMucTieu', {ten: c.tenMucTieu})}</p>
                  ) : c.lac_muc_tieu ? (
                    <p className="mt-1 text-chu-thich font-semibold italic text-grey-mid">{tc('lac')}</p>
                  ) : null}
                  {tuanNghi && <p className="mt-1 text-chu-thich font-semibold italic text-grey-mid">{tc('nghi')}</p>}
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* ④ Con đã họp với bạn tuần này? */}
      <section>
        <div
          className={`glass flex items-center gap-3 rounded-[20px] p-[18px] ${
            daKyHop ? '' : 'opacity-90'
          }`}
        >
          <span
            className="grid h-10 w-10 shrink-0 place-items-center rounded-full"
            style={{
              background: daKyHop ? 'rgba(30,138,90,0.14)' : 'rgba(38,39,93,0.06)',
              color: daKyHop ? 'var(--color-success-dark)' : 'var(--color-grey-mid)',
            }}
          >
            {daKyHop ? <Check size={16} strokeWidth={2.5} /> : <Users size={16} strokeWidth={2} />}
          </span>
          <span className="min-w-0 flex-1 text-noi-dung font-bold text-navy">
            {daKyHop ? t('hopBan') : t('hopChua')}
          </span>
          {!daKyHop && <X size={16} strokeWidth={2} className="shrink-0 text-grey-mid" />}
        </div>
      </section>

      {/* Thực đơn hôm nay + ảnh lớp — thứ bố mẹ liếc một cái, không chiếm một tab (docs/NAV_IA.md). */}
      <TodayMenuCard />

      <Link
        href="/gallery"
        className="glass glass-hover flex items-center gap-3 rounded-[20px] p-[18px] transition-all"
      >
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-gold/20 text-gold-deep">
          <Images size={16} strokeWidth={2} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-display text-noi-dung font-bold text-navy">Hình ảnh lớp</span>
          <span className="block text-than font-semibold text-grey-mid">
            Ảnh học tập và sự kiện do giáo viên chủ nhiệm đăng
          </span>
        </span>
        <ChevronRight size={16} strokeWidth={2} className="shrink-0 text-grey-mid" />
      </Link>
    </div>
  );
}

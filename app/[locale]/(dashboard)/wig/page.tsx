import {getTranslations, setRequestLocale} from 'next-intl/server';
import {Trash2} from 'lucide-react';
import {requireRole} from '@/lib/auth';
import {createClient} from '@/lib/supabase/server';
import {KhongCoLop} from '@/components/ui/KhongCoLop';
import {getClassContext} from '@/lib/queries';
import {ClassPicker} from '@/components/shell/ClassPicker';
import {ClassOwnerNote} from '@/components/shell/ClassOwnerNote';
import {Link} from '@/i18n/navigation';
import {isValidDayVN, mondayOf, todayInVN, weekFromMonday, weekDaysVN} from '@/lib/dates';
import {AREAS, areaLabel, type Area} from '@/lib/areas';
import {getAreaMeta} from '@/lib/area-config';
import {lichSuTuanNhieu} from '@/lib/rpc-nhieu';
import {layTrangWig, type TrangWig} from '@/lib/trang-gop';
import {Flash} from '@/components/ui/Flash';
import {FormTaiCho, LoiO, NutGui, ONhap} from '@/components/ui/FormTaiCho';
import {PopupLopTruong} from '@/components/wig/PopupLopTruong';
import {KhuBuddyPdr} from '@/components/roster/KhuBuddyPdr';
import {KhuMucTieuTruong} from '@/components/wig/KhuMucTieuTruong';
import {BangCacEm} from '@/components/wig/BangCacEm';
import {LamMoiKhiDoi} from '@/components/shell/LamMoiKhiDoi';
import {NutTaoMucTieuLop} from '@/components/wig/NutTaoMucTieuLop';
import {SuaChiTieuLop} from '@/components/wig/SuaChiTieuLop';
import {ThanhTuanWig} from '@/components/wig/ThanhTuanWig';
import {TheMucTieuLop} from '@/components/wig/TheMucTieuLop';
import {KhuMucTieuToi} from '@/components/wig/KhuMucTieuToi';
import {MT_COLS, type CamKetToi, type DayNoi, type LichSuTuan, type MucTieuV, type ThuocToi, type TruongWig} from '@/components/wig/kieu-wig';
import {xoaViecLop} from '@/app/[locale]/(dashboard)/wig/actions';
import {duyetHaChiTieu, duyetMucTieuEm, traLaiMucTieuEm} from '@/app/[locale]/(dashboard)/wig/lop-actions';

// ════════════════════════════════════════════════════════════════════════════════════════════
// /wig — MÀN CỦA THẦY CÔ (mô hình mục tiêu PA2, chốt 03–04/09)
//
// Bố cục: đầu trang (popup Lớp + Trường · Lịch họp · chọn lớp) → thanh tuần → ba số của các em
// (4 tuần qua) → Mục tiêu của tôi (chỉ GVCN) → Các em tuần này → Chờ duyệt (mục tiêu em + hạ chỉ tiêu).
//
// Audit 04/09 — trang này từng 8 tầng gọi nối tiếp (~1,5–2 s CSDL). Nay đúng BA tầng:
//   T1: lớp + nhãn lĩnh vực + đơn vị (song song)
//   T2: mọi thứ chỉ cần class_id / profile.id (song song)
//   T3: mọi thứ cần id của T2 — bước, dây, lịch sử (một RPC mảng) — song song
// Lượt tick của thầy cô đọc theo (student_id, tuần) chứ không theo thước → khỏi tầng thứ tư.
// Mọi nút nhỏ (ghi số, nối, duyệt, trả lại) đi đường state — trang đứng yên, lỗi hiện tại chỗ.
// ════════════════════════════════════════════════════════════════════════════════════════════

export default async function WigPage({
  params,
  searchParams,
}: {
  params: Promise<{locale: string}>;
  searchParams: Promise<{class?: string; week?: string; bang?: string}>;
}) {
  const {locale} = await params;
  const {class: classParam, week: weekParam, bang: bangParam} = await searchParams;
  setRequestLocale(locale);
  // Ban giám hiệu vào được (chỉ đọc) — audit 04/09: BGH từng bị đẩy khỏi popup mục tiêu trường.
  const profile = await requireRole(['teacher', 'admin', 'principal']);
  const t = await getTranslations('lopMucTieu');
  const tViec = await getTranslations('viec');
  const tDuyet = await getTranslations('duyet');
  const tf = await getTranslations('formChung');
  const supabase = await createClient();

  // ── T1 ──────────────────────────────────────────────────────────────────────────────────
  const [{myClass, classes: accessible}, areaMeta, {data: dvRows}] = await Promise.all([
    getClassContext(supabase, profile, classParam),
    getAreaMeta(),
    supabase.from('don_vi').select('id, ma, nhan_vi, nhan_en').eq('is_active', true).order('ma'),
  ]);
  if (!myClass) return <KhongCoLop role={profile.role} />;
  const nhanTheoArea = Object.fromEntries(AREAS.map((a) => [a, areaLabel(areaMeta[a], locale)]));
  const donViList = ((dvRows ?? []) as {id: string; ma: string; nhan_vi: string; nhan_en: string}[]).map((d) => ({
    id: d.id,
    ma: d.ma,
    nhan: locale === 'vi' ? d.nhan_vi : d.nhan_en,
  }));
  const campusId = (myClass as unknown as {campus_id: string}).campus_id;
  // Ai đang xem: GVCN của lớp (đủ quyền) · admin (đủ quyền, không có khu "của tôi") · BGH (chỉ đọc).
  const laGvcn = (myClass as unknown as {homeroom_teacher_id: string | null}).homeroom_teacher_id === profile.id;
  const chiDoc = profile.role === 'principal';
  const laQuanTri = profile.role === 'admin' || profile.role === 'principal';

  // ── TUẦN ĐANG XEM ──────────────────────────────────────────────────────────────────────
  const todayVN = todayInVN();
  const thisMonday = mondayOf(todayVN);
  const monday = isValidDayVN(weekParam) ? mondayOf(weekParam as string) : thisMonday;
  const wk = weekFromMonday(monday);
  const laTuanNay = monday === thisMonday;
  const weekQ = laTuanNay ? '' : monday;
  const weekDays = weekDaysVN(monday);
  const dayShort = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];
  const ctx = (
    <>
      <input type="hidden" name="class_id" value={myClass.id} />
      <input type="hidden" name="week" value={weekQ} />
    </>
  );

  // ── T2 + T3: MỘT lượt RPC trang_wig (0189) — 14 câu → 1; fallback đường cũ khi CSDL chưa có hàm ──
  const gop: TrangWig | null = await layTrangWig(supabase, {classId: myClass.id, monday, toiId: laGvcn ? profile.id : null, campusId, soTuan: 8});
  // Kiểu theo đúng cách phần dưới dùng (nhánh gộp cast từ jsonb, nhánh cũ là kiểu Supabase → cast chung).
  type ThiDuaRow = {diem_muc_tieu: number | null; diem_thuoc: number | null; diem_cam_ket: number | null};
  type ThuocLopRow = {thuoc_id: string; ten: string | null; chu_the: string | null; gia_lop: number | null; so_em_ghi: number | null; so_em_dat: number | null; si_so: number | null; le_ra: number | null; trang_thai: string | null; mien: boolean | null};
  type MtChoRow = {id: string; ten: string | null; linh_vuc: string | null; student_id: string | null; x_so: number | null; y_so: number | null; ten_don_vi: string | null; ket_thuc: string | null};
  type HaChoRow = {id: string; thuoc_id: string; chi_tieu_ky: number | null; la_ha: boolean | null; thuoc: unknown};
  type EnrolledRow = {student_id: string | null; profiles: unknown};
  type LuotRow = {thuoc_id: string; ngay: string; gia_tri: number | null};
  let thiDua: ThiDuaRow[] | null, mtRows: unknown, mtToiRows: unknown, truongRows: unknown, thuocRows: ThuocLopRow[] | null, ckRows: unknown,
    enrolled: EnrolledRow[] | null, mtCho: MtChoRow[] | null, haCho: HaChoRow[] | null, thuocToiRows: unknown, luotRows: LuotRow[] | null;
  if (gop) {
    thiDua = gop.thiDua as ThiDuaRow[];
    mtRows = gop.mtRows;
    mtToiRows = gop.mtToiRows;
    truongRows = gop.truongRows;
    thuocRows = gop.thuocRows as ThuocLopRow[];
    ckRows = gop.ckRows;
    enrolled = gop.enrolled as EnrolledRow[];
    mtCho = gop.mtCho as MtChoRow[];
    haCho = gop.haCho as HaChoRow[];
    thuocToiRows = gop.thuocToiRows;
    luotRows = gop.luotRows as LuotRow[] | null;
  } else {
    const cu = await Promise.all([
    supabase.rpc('thi_dua_lop', {p_class: myClass.id}),
    supabase.from('muc_tieu_v').select(MT_COLS).eq('class_id', myClass.id).eq('cap', 'lop').neq('trang_thai', 'dong'),
    laGvcn
      ? supabase.from('muc_tieu_v').select(MT_COLS).eq('class_id', myClass.id).eq('cap', 'em').eq('student_id', profile.id).neq('trang_thai', 'dong')
      : Promise.resolve({data: null}),
    supabase.from('muc_tieu_v').select('id, ten, don_vi_id, ten_don_vi, so, y_so').eq('campus_id', campusId).eq('cap', 'truong').eq('trang_thai', 'duyet'),
    supabase.rpc('bang_lop_thuoc', {p_class: myClass.id, p_tuan: monday}),
    laGvcn
      ? supabase
          .from('cam_ket_v')
          .select('id, noi_dung, so_hua, so_dat, ket_qua, ten_don_vi, muc_tieu_id, thuoc_id, tuan_bat_dau, tuan_ket_thuc, so_tuan, trang_thai')
          .eq('class_id', myClass.id)
          .eq('chu_the', 'em')
          .eq('student_id', profile.id)
          .neq('trang_thai', 'huy')
      : Promise.resolve({data: null}),
    supabase.from('enrollments').select('student_id, profiles!enrollments_student_id_fkey(full_name)').eq('class_id', myClass.id).eq('is_active', true),
    supabase.from('muc_tieu_v').select('id, ten, linh_vuc, student_id, x_so, y_so, ten_don_vi, ket_thuc').eq('class_id', myClass.id).eq('cap', 'em').eq('trang_thai', 'gui'),
    // Hạ chỉ tiêu chờ duyệt — LỌC THEO LỚP ngay ở câu hỏi (trước đây quét cả bảng rồi RLS lọc từng dòng).
    supabase
      .from('thuoc_lich_su')
      .select('id, thuoc_id, chi_tieu_ky, la_ha, thuoc!inner(ten, class_id, student_id, chi_tieu_ky)')
      .eq('trang_thai', 'cho_duyet')
      .eq('thuoc.class_id', myClass.id),
    // Thước cá nhân của thầy cô trong lớp (0185: trỏ về cam kết qua cam_ket_id).
    laGvcn
      ? supabase
          .from('thuoc')
          .select('id, ten, cach_ghi, chi_tieu_ky, ngay_ap_dung, don_vi_id, cam_ket_id')
          .eq('class_id', myClass.id)
          .eq('student_id', profile.id)
          .not('cam_ket_id', 'is', null)
          .neq('trang_thai', 'dong')
          .order('created_at')
      : Promise.resolve({data: null}),
    // Lượt của thầy cô trong tuần — theo NGƯỜI + TUẦN, không cần biết thước trước.
    laGvcn
      ? supabase.from('luot').select('thuoc_id, ngay, gia_tri').eq('student_id', profile.id).gte('ngay', wk.start).lte('ngay', wk.end)
      : Promise.resolve({data: null}),
    ]);
    thiDua = cu[0].data as ThiDuaRow[] | null;
    mtRows = cu[1].data;
    mtToiRows = cu[2].data;
    truongRows = cu[3].data;
    thuocRows = cu[4].data as ThuocLopRow[] | null;
    ckRows = cu[5].data;
    enrolled = cu[6].data as EnrolledRow[] | null;
    mtCho = cu[7].data as MtChoRow[] | null;
    haCho = cu[8].data as HaChoRow[] | null;
    thuocToiRows = cu[9].data;
    luotRows = cu[10].data as LuotRow[] | null;
  }

  const tenEm = new Map<string, string>();
  for (const e of enrolled ?? []) {
    const p = e.profiles as {full_name: string | null} | {full_name: string | null}[] | null;
    const name = Array.isArray(p) ? p[0]?.full_name : p?.full_name;
    if (e.student_id) tenEm.set(e.student_id, name ?? '');
  }
  const td = (thiDua ?? [])[0] as {diem_muc_tieu: number | null; diem_thuoc: number | null; diem_cam_ket: number | null} | undefined;
  const mucTieuLop = (mtRows ?? []) as unknown as MucTieuV[];
  const mucTieuToi = (mtToiRows ?? []) as unknown as MucTieuV[];
  const truongWigs = (truongRows ?? []) as unknown as TruongWig[];
  const tenTruong = new Map(truongWigs.map((m) => [m.id, m.ten ?? '']));
  const tenWigLop = new Map(mucTieuLop.map((m) => [m.id, m.ten ?? '']));
  const wigIds = mucTieuLop.map((m) => m.id);
  const mtToiIds = mucTieuToi.map((m) => m.id);
  const truongIds = truongWigs.map((m) => m.id);
  const keIds = mucTieuLop.filter((m) => m.loai_moc === 'ke_hoach').map((m) => m.id);

  // ── T3: bước, dây, lịch sử — đã nằm trong trang_wig; fallback gọi riêng ──
  let buocRows: unknown, noiRows: unknown, noiToiRows: unknown, noiTruongRows: unknown;
  let lichSuTheoWig: Map<string, {tuan_ket: string; so: number | null}[]>;
  if (gop) {
    buocRows = gop.buocRows; noiRows = gop.noiRows; noiToiRows = gop.noiToiRows; noiTruongRows = gop.noiTruongRows;
    lichSuTheoWig = new Map();
    for (const r of gop.lichSu) {
      const arr = lichSuTheoWig.get(r.muc_tieu_id) ?? [];
      arr.push({tuan_ket: r.tuan_ket, so: r.so});
      lichSuTheoWig.set(r.muc_tieu_id, arr);
    }
  } else {
    const cu3 = await Promise.all([
    keIds.length ? supabase.from('buoc').select('id, muc_tieu_id, tieu_de, phan_tram, xong_at').in('muc_tieu_id', keIds).order('thu_tu') : Promise.resolve({data: null}),
    wigIds.length ? supabase.from('noi').select('cha_id, con_thuoc_id').in('cha_id', wigIds).eq('vai', 'gop_so').not('con_thuoc_id', 'is', null) : Promise.resolve({data: null}),
    mtToiIds.length ? supabase.from('noi').select('cha_id, con_muc_tieu_id, vai').in('con_muc_tieu_id', mtToiIds) : Promise.resolve({data: null}),
    truongIds.length && wigIds.length ? supabase.from('noi').select('cha_id, con_muc_tieu_id, vai').in('cha_id', truongIds).in('con_muc_tieu_id', wigIds) : Promise.resolve({data: null}),
    lichSuTuanNhieu(
      supabase,
      [...mucTieuLop, ...mucTieuToi].filter((m) => m.pct != null || m.so != null).map((m) => m.id),
      8,
    ),
    ]);
    buocRows = cu3[0].data; noiRows = cu3[1].data; noiToiRows = cu3[2].data; noiTruongRows = cu3[3].data; lichSuTheoWig = cu3[4];
  }

  const buocTheoMt = new Map<string, {id: string; tieu_de: string; phan_tram: number; xong: boolean}[]>();
  for (const b of (buocRows ?? []) as {id: string; muc_tieu_id: string; tieu_de: string; phan_tram: number; xong_at: string | null}[]) {
    const arr = buocTheoMt.get(b.muc_tieu_id) ?? [];
    arr.push({id: b.id, tieu_de: b.tieu_de, phan_tram: Number(b.phan_tram), xong: b.xong_at != null});
    buocTheoMt.set(b.muc_tieu_id, arr);
  }
  const gomDay = (rows: {cha_id: string; con_muc_tieu_id: string; vai: string}[] | null) => {
    const m = new Map<string, DayNoi>();
    for (const n of rows ?? []) {
      const cur = m.get(n.con_muc_tieu_id) ?? {chaId: n.cha_id, gop: false};
      if (n.vai === 'gop_so') cur.gop = true;
      cur.chaId = n.cha_id;
      m.set(n.con_muc_tieu_id, cur);
    }
    return m;
  };
  const noiCuaToi = gomDay(noiToiRows as {cha_id: string; con_muc_tieu_id: string; vai: string}[] | null);
  const noiLenTruong = gomDay(noiTruongRows as {cha_id: string; con_muc_tieu_id: string; vai: string}[] | null);
  const lichSu = new Map<string, LichSuTuan>();
  for (const [id, rows] of lichSuTheoWig) lichSu.set(id, rows.map((r) => ({tuan_ket: r.tuan_ket, so: Number(r.so ?? 0)})));

  // Việc lớp cũ chưa gắn mục tiêu (hiếm — di sản mô hình cũ): gom gọn để dọn.
  const wigCuaViec = new Set(((noiRows ?? []) as {con_thuoc_id: string}[]).map((n) => n.con_thuoc_id));
  const viecChuaGan = (thuocRows ?? []).filter((v) => !wigCuaViec.has(v.thuoc_id));

  // Cam kết cá nhân trong tuần đang xem, gom theo mục tiêu cá nhân.
  const camKet = ((ckRows ?? []) as CamKetToi[]).filter((c) => {
    const bd = c.tuan_bat_dau ?? '';
    const kt = c.tuan_ket_thuc ?? bd;
    return bd <= wk.end && kt >= wk.start;
  });
  const camKetCuaToi = new Map<string, CamKetToi[]>();
  for (const c of camKet) {
    if (c.muc_tieu_id && mtToiIds.includes(c.muc_tieu_id)) {
      const arr = camKetCuaToi.get(c.muc_tieu_id) ?? [];
      arr.push(c);
      camKetCuaToi.set(c.muc_tieu_id, arr);
    }
  }
  const ckIds = new Set(camKet.map((c) => c.id).filter(Boolean) as string[]);
  const thuocTheoCamKet = new Map<string, ThuocToi[]>();
  const thuocIds = new Set<string>();
  for (const tr of (thuocToiRows ?? []) as ThuocToi[]) {
    if (!tr.cam_ket_id || !ckIds.has(tr.cam_ket_id)) continue;
    const arr = thuocTheoCamKet.get(tr.cam_ket_id) ?? [];
    arr.push(tr);
    thuocTheoCamKet.set(tr.cam_ket_id, arr);
    thuocIds.add(tr.id);
  }
  const daTickTheoThuoc = new Map<string, string[]>();
  const tongSoTheoThuoc = new Map<string, number>();
  for (const l of (luotRows ?? []) as {thuoc_id: string; ngay: string; gia_tri: number | null}[]) {
    if (!thuocIds.has(l.thuoc_id)) continue;
    const arr = daTickTheoThuoc.get(l.thuoc_id) ?? [];
    arr.push(l.ngay);
    daTickTheoThuoc.set(l.thuoc_id, arr);
    tongSoTheoThuoc.set(l.thuoc_id, (tongSoTheoThuoc.get(l.thuoc_id) ?? 0) + Number(l.gia_tri ?? 0));
  }

  const haChoLop = haCho ?? [];
  const soCho = (mtCho ?? []).length + haChoLop.length;

  // Ô "Mục tiêu %" — trung bình % của MỌI mục tiêu lớp đã duyệt có đích số; mục tiêu mới chưa có số
  // tính là 0 (trước đây bị loại → con số đứng im khi thêm mục tiêu mới, không ai hiểu vì sao).
  const mtDuyetCoDich = mucTieuLop.filter((m) => m.trang_thai === 'duyet' && (m.y_so != null || m.loai_moc !== 'do_luong'));
  const diemMucTieu = mtDuyetCoDich.length ? mtDuyetCoDich.reduce((s, m) => s + Number(m.pct ?? 0), 0) / mtDuyetCoDich.length : td?.diem_muc_tieu;

  const baSo = (label: string, val: number | null | undefined) => (
    <div className="flex-1 rounded-[16px] border-[1.5px] border-navy/10 bg-white px-3 py-2.5">
      <div className="text-nhan font-extrabold uppercase tracking-wide text-grey-mid">{label}</div>
      <div className="mt-0.5 font-display text-dau font-bold text-navy tabular-nums">
        {val == null ? <span className="text-grey-mid">—</span> : `${Math.round(Number(val))}%`}
      </div>
    </div>
  );
  const nutDuyet = 'rounded-full border-[1.5px] border-gold-deep/40 bg-gold/[0.18] px-3 text-chu-thich font-extrabold text-gold-text transition-all hover:bg-gold/30 focus-visible:ring-2 focus-visible:ring-navy';
  const truongChon = truongWigs.map((tw) => ({id: tw.id, ten: tw.ten ?? '', linh_vuc: ''}));

  return (
    <div className="flex flex-col gap-4">
      {/* REALTIME (0192): em gửi/đổi mục tiêu, cam kết, thước → trang tự dựng lại, không F5. */}
      <LamMoiKhiDoi
        kenh={`wig-${myClass.id}`}
        nguon={[
          {table: 'muc_tieu', filter: `class_id=eq.${myClass.id}`},
          {table: 'cam_ket', filter: `class_id=eq.${myClass.id}`},
          {table: 'thuoc', filter: `class_id=eq.${myClass.id}`},
        ]}
      />
      {/* ── Đầu trang ─────────────────────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="mr-auto font-display text-dau font-bold text-navy">
          {t('title')} · {myClass.name}
        </h1>
        {/* Mục tiêu LỚP + TRƯỜNG thu vào một popup (04/09) — ít đụng tới hằng ngày, đỡ chật trang. */}
        <PopupLopTruong nhan={t('nutLopTruong')} tieuDe={t('popupLopTruong')} moBanDau={bangParam === 'lop'} hd="gv-lop-truong">
          {/* TRƯỜNG ở TRÊN (khung như cũ) — LỚP ở DƯỚI trong thẻ riêng (chủ dự án 04/09). */}
          <KhuMucTieuTruong campusId={campusId} locale={locale} laQuanTri={laQuanTri} nhanTheoArea={nhanTheoArea} donViList={donViList} />
          {mucTieuLop.length === 0 ? (
            <section className="glass flex flex-col gap-4 rounded-[20px] p-[18px]">
              <div className="flex flex-col items-center gap-2.5 rounded-[16px] border-[1.5px] border-dashed border-navy/25 px-5 py-7 text-center">
                <h2 className="font-display text-doc font-bold text-navy">{t('khuMucTieu')}</h2>
                <p className="max-w-[440px] text-than font-semibold leading-relaxed text-grey-mid">{t('rongDanDat')}</p>
                {!chiDoc && (
                  <div className="mt-1">
                    <NutTaoMucTieuLop classId={myClass.id} nhanTheoArea={nhanTheoArea} donViList={donViList} truongWigs={truongChon} />
                  </div>
                )}
              </div>
            </section>
          ) : (
            <div className="flex flex-col gap-4">
              <section className="glass flex flex-col gap-3 rounded-[20px] p-[18px]">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="font-display text-doc font-bold text-navy">{t('khuMucTieu')}</h2>
                  {!chiDoc && (
                    <div className="ml-auto">
                      <NutTaoMucTieuLop classId={myClass.id} nhanTheoArea={nhanTheoArea} donViList={donViList} truongWigs={truongChon} />
                    </div>
                  )}
                </div>
                <div className={mucTieuLop.length >= 2 ? 'grid grid-cols-1 gap-3 min-[760px]:grid-cols-2' : 'flex flex-col gap-3'}>
                {mucTieuLop.map((m) => (
                  <TheMucTieuLop
                    key={m.id}
                    m={m}
                    meta={areaMeta[(m.linh_vuc ?? 'knowledge') as Area]}
                    locale={locale}
                    buoc={buocTheoMt.get(m.id) ?? []}
                    lichSu={lichSu.get(m.id) ?? []}
                    noiTruong={noiLenTruong.get(m.id) ?? null}
                    truongWigs={truongWigs}
                    tenTruong={tenTruong}
                    classId={myClass.id}
                    weekQ={weekQ}
                    nhanTheoArea={nhanTheoArea}
                    donViList={donViList}
                    chiDoc={chiDoc}
                  />
                ))}
                </div>
              </section>

              {/* Việc lớp cũ CHƯA gắn mục tiêu — di sản, gom gọn để dọn. */}
              {viecChuaGan.length > 0 && !chiDoc && (
                <section className="glass flex flex-col gap-2 rounded-[20px] p-[18px]">
                  <h2 className="font-display text-noi-dung font-bold text-navy">{t('viecChuaGan')}</h2>
                  <div className="flex flex-col gap-2">
                    {viecChuaGan.map((v) => {
                      const xanh = v.trang_thai === 'dat' || v.trang_thai === 'dang_thang' || v.trang_thai === 'dang_giu';
                      return (
                        <div key={v.thuoc_id} className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-[12px] border-[1.5px] border-navy/10 px-3 py-2">
                          <span className="min-w-0 flex-1 text-than font-bold text-navy">{v.ten}</span>
                          <span className={`inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-chu-thich font-extrabold ${xanh ? 'bg-success/[0.12] text-success-dark' : 'bg-gold/[0.18] text-gold-text'}`}>
                            {v.mien ? tViec('oNghi') : xanh ? tViec('du') : tViec('chuaDu')}
                          </span>
                          <SuaChiTieuLop thuocId={v.thuoc_id} chiTieuHienTai={null} donVi="" classId={myClass.id} weekQ={weekQ} />
                          <FormTaiCho action={xoaViecLop} xacNhan={tf('xoaViecHoi')} nhanXacNhan={t('xoaViec')} nguyHiem anThanhCong>
                            {ctx}
                            <input type="hidden" name="thuoc_id" value={v.thuoc_id} />
                            <NutGui label={t('xoaViec')} className="relative grid h-9 w-9 place-items-center rounded-[12px] text-status-bad transition-colors after:absolute after:left-1/2 after:top-1/2 after:h-11 after:w-11 after:-translate-x-1/2 after:-translate-y-1/2 after:content-[''] hover:bg-status-bad/10 focus-visible:ring-2 focus-visible:ring-gold">
                              <Trash2 size={14} strokeWidth={2.5} />
                            </NutGui>
                          </FormTaiCho>
                        </div>
                      );
                    })}
                  </div>
                </section>
              )}
            </div>
          )}
        </PopupLopTruong>
        {/* Lịch họp: popup ngay tại đây (04/09: thôi nhảy sang /roster), nút VÀNG để khác nút lớp·trường. */}
        {!chiDoc && (
          <PopupLopTruong nhan={t('lichHop')} tieuDe={t('lichHop')} icon="hop" giong="vang" tenBang="hop" moBanDau={bangParam === 'hop'} hd="gv-lich-hop">
            <KhuBuddyPdr classId={myClass.id} hocSinh={[...tenEm].map(([id, name]) => ({id, name}))} ve="wig" />
          </PopupLopTruong>
        )}
        {(accessible.length > 1 || laQuanTri) && <ClassPicker classes={accessible} current={myClass.id} />}
        <ClassOwnerNote classId={myClass.id} viewerId={profile.id} viewerRole={profile.role} />
      </div>

      <Flash />

      {/* ── Thanh tuần — một hàng, giữ ?class= ─────────────────────────────────────────── */}
      {/* Dính đầu khi cuộn (điện thoại): tuần đang xem luôn trong tầm mắt; z dưới header (z-20). */}
      <div data-hd="tuan" className="sticky top-[var(--h-nav,76px)] z-10 -mx-4 bg-[rgba(247,247,251,0.92)] px-4 py-1.5 backdrop-blur-md sm:static sm:mx-0 sm:bg-transparent sm:px-0 sm:py-0 sm:backdrop-blur-none">
        <ThanhTuanWig monday={monday} thisMonday={thisMonday} label={wk.label} start={wk.start} end={wk.end} classParam={classParam} />
      </div>

      {/* ── BA SỐ CỦA CÁC EM — 4 tuần đã khép (thi_dua_lop). Nói rõ nguồn, đừng để ai tưởng là "tuần này". */}
      <section data-hd="gv-ba-so" className="glass flex flex-col gap-2 rounded-[20px] p-[18px]">
        <p className="text-nhan font-extrabold uppercase tracking-wide text-grey-mid">{tf('baSoChuThich')}</p>
        <div className="flex items-stretch gap-2.5">
          {baSo(t('cotMucTieu'), diemMucTieu)}
          {baSo(t('cotViec'), td?.diem_thuoc)}
          {baSo(t('cotCamKet'), td?.diem_cam_ket)}
        </div>
      </section>

      {/* ── MỤC TIÊU CỦA TÔI — CHỈ GVCN của lớp (admin/BGH/GVBM xem không có khu này). */}
      {laGvcn ? (
        <KhuMucTieuToi
          mucTieuToi={mucTieuToi}
          areaMeta={areaMeta}
          noiCuaToi={noiCuaToi}
          tenWigLop={tenWigLop}
          lichSu={lichSu}
          camKetCuaToi={camKetCuaToi}
          thuocTheoCamKet={thuocTheoCamKet}
          daTickTheoThuoc={daTickTheoThuoc}
          tongSoTheoThuoc={tongSoTheoThuoc}
          weekDays={weekDays}
          dayShort={dayShort}
          todayVN={todayVN}
          laTuanNay={laTuanNay}
          tuongLai={monday > thisMonday}
          monday={monday}
          weekQ={weekQ}
          classId={myClass.id}
          profileId={profile.id}
          donViList={donViList}
          nhanTheoArea={nhanTheoArea}
          mucTieuLopChon={mucTieuLop.filter((g) => g.trang_thai === 'duyet').map((g) => ({id: g.id, ten: g.ten ?? '', linh_vuc: (g.linh_vuc ?? 'knowledge') as string}))}
        />
      ) : (
        <p className="text-chu-thich font-semibold text-grey-mid">{tf('khuToiCuaGvcn')}</p>
      )}

      {/* ── CÁC EM TUẦN NÀY ─────────────────────────────────────────────────────────────── */}
      <div data-hd="gv-cac-em">
        <BangCacEm classId={myClass.id} monday={monday} weekQ={weekQ} classParam={classParam} />
      </div>

      {/* ── CHỜ DUYỆT — mục tiêu năm của em + hạ chỉ tiêu nhiều. Nút đi đường state. ────── */}
      <section data-hd="gv-cho-duyet" className="glass flex flex-col gap-3 rounded-[20px] p-[18px]">
        <h2 className="flex items-center gap-2 font-display text-doc font-bold text-navy">
          {tDuyet('choDuyet')}
          {soCho > 0 && (
            <span
              aria-label={tDuyet('choDuyetN', {n: soCho})}
              className="grid h-6 min-w-[24px] place-items-center rounded-full bg-status-bad px-1.5 font-display text-chu-thich font-bold text-white"
            >
              {soCho}
            </span>
          )}
        </h2>
        <p className="text-chu-thich font-semibold text-grey-mid">{tDuyet('luuY')}</p>
        {soCho === 0 ? (
          <p className="text-than font-semibold text-grey-mid">{tDuyet('khongCo')}</p>
        ) : (
          <div className="flex flex-col gap-2">
            {(mtCho ?? []).map((m) => (
              <div key={m.id} className="flex flex-col gap-2 rounded-[12px] border-[1.5px] border-navy/10 px-3 py-2.5">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span className="rounded-full bg-navy/[0.06] px-2 py-0.5 text-chu-thich font-extrabold text-grey-mid">{tDuyet('loaiMucTieu')}</span>
                  <span className="min-w-0 flex-1 text-than font-bold text-navy">
                    {m.ten} <span className="font-semibold text-grey-mid">{tDuyet('cua', {ten: tenEm.get(m.student_id ?? '') ?? ''})}</span>
                  </span>
                </div>
                {!chiDoc && (
                  <div className="flex flex-wrap items-center gap-2">
                    <FormTaiCho action={duyetMucTieuEm} anThanhCong className="contents">
                      {ctx}
                      <input type="hidden" name="muc_tieu_id" value={m.id ?? undefined} />
                      <NutGui className={nutDuyet}>{tDuyet('duyet')}</NutGui>
                    </FormTaiCho>
                    <details className="min-w-0 flex-1">
                      <summary className="inline-flex min-h-[44px] cursor-pointer list-none items-center rounded-[12px] border-[1.5px] border-navy/20 bg-white px-3 text-chu-thich font-extrabold text-navy hover:border-navy">
                        {tDuyet('traLai')}
                      </summary>
                      <FormTaiCho action={traLaiMucTieuEm} anThanhCong className="mt-2 flex flex-col gap-1.5">
                        {ctx}
                        <input type="hidden" name="muc_tieu_id" value={m.id ?? undefined} />
                        <ONhap as="textarea" name="note" maxLength={300} placeholder={tDuyet('traLaiNhan')} className="w-full rounded-[12px] border-[1.5px] px-3 py-2 text-base text-navy focus-visible:border-navy focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold sm:text-sm" />
                        <LoiO ten="note" className="text-chu-thich font-bold text-status-bad" />
                        <NutGui className="self-start rounded-[12px] bg-navy px-3 text-chu-thich font-extrabold text-white focus-visible:ring-2 focus-visible:ring-gold">{tDuyet('traLaiGui')}</NutGui>
                      </FormTaiCho>
                    </details>
                  </div>
                )}
              </div>
            ))}
            {haChoLop.map((r) => {
              const th = r.thuoc as unknown as {ten: string | null; student_id: string | null} | {ten: string | null; student_id: string | null}[] | null;
              const one = Array.isArray(th) ? th[0] : th;
              return (
                <div key={r.id} className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-[12px] border-[1.5px] border-navy/10 px-3 py-2.5">
                  <span className="rounded-full bg-status-bad/[0.10] px-2 py-0.5 text-chu-thich font-extrabold text-status-bad">
                    {tDuyet('loaiHaChiTieu', {cu: one?.ten ?? '', moi: r.chi_tieu_ky ?? ''})}
                  </span>
                  <span className="min-w-0 flex-1 text-than font-bold text-navy">
                    {one?.ten} <span className="font-semibold text-grey-mid">{tDuyet('cua', {ten: tenEm.get(one?.student_id ?? '') ?? ''})}</span>
                  </span>
                  {!chiDoc && (
                    <FormTaiCho action={duyetHaChiTieu} anThanhCong className="contents">
                      {ctx}
                      <input type="hidden" name="lich_su_id" value={r.id} />
                      <NutGui className={nutDuyet}>{tDuyet('duyet')}</NutGui>
                    </FormTaiCho>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}

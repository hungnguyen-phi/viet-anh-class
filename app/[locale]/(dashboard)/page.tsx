import {getTranslations, setRequestLocale} from 'next-intl/server';
import {redirect} from 'next/navigation';
import {requireProfile} from '@/lib/auth';
import {createClient} from '@/lib/supabase/server';
import {getClassContext} from '@/lib/queries';
import {Check, Minus, Users, GraduationCap, Layers, Building2} from 'lucide-react';
import {ClassPicker} from '@/components/shell/ClassPicker';
import {DonutRing} from '@/components/charts/DonutRing';
import {AREAS, areaLabel, areaIcon} from '@/lib/areas';
import {getAreaMeta} from '@/lib/area-config';

// Mục tiêu LỚP (muc_tieu_v, cap='lop', đã duyệt) — chỉ lấy cột màn cần.
// `trang_thai_do` là trạng thái NHỊP (dat/dang_thang/sat_nut/truot…), khác `trang_thai` (duyệt).
type GoalRow = {
  linh_vuc: string | null;
  pct: number | null;
  trang_thai_do: string | null;
};
// Một dòng thước của lớp (bang_lop_thuoc) — "n/m bạn đủ" tuần này.
type ThuocRow = {
  thuoc_id: string;
  ten: string;
  si_so: number;
  so_em_dat: number;
};

// AREAS + màu/icon/nhãn lĩnh vực ("Môn") lấy từ lib/areas (đọc area_config, fallback = giá trị cũ).

// Gom trạng thái NHỊP của một mục tiêu về ba nhóm mà DonutRing và chip trạng thái hiểu.
// Nguồn: private.so_hien_tai → muc_tieu_v.trang_thai_do (0166). 'dang_lam'/'chua_biet'/'mien'
// là "chưa đủ số để nói thắng thua" → không tô màu, không đếm vào banner.
function nhipVe(tt: string | null): 'on_track' | 'mid' | 'off_track' | null {
  switch (tt) {
    case 'dat':
    case 'dang_thang':
    case 'dang_giu':
    case 'vuot':
      return 'on_track';
    case 'sat_nut':
      return 'mid';
    case 'truot':
      return 'off_track';
    default:
      return null;
  }
}

// Meta trạng thái nhịp (label lấy từ i18n, màu/nền theo design system v3).
// Ba màu này TRÙNG KHÍT token success/warn/status-bad, chỉ là trước đây gõ lại bằng hex — nên
// đổi token trong globals.css thì trang lớp vẫn giữ màu cũ. Nay trỏ thẳng vào token.
// `color` là màu CHỮ trên chip (11px in đậm → cần 4.5:1), `bg` pha từ nấc SÁNG của cùng màu.
const STATUS_META: Record<string, {color: string; bg: string}> = {
  on_track: {color: 'var(--color-success-dark)', bg: softOf('var(--color-success)')},
  mid: {color: 'var(--color-warn-text)', bg: softOf('var(--color-warn)')},
  off_track: {color: 'var(--color-status-bad-dark)', bg: softOf('var(--color-status-bad)')},
};
function softOf(c: string): string {
  return `color-mix(in srgb, ${c} 12%, transparent)`;
}

export default async function ClassPage({
  params,
  searchParams,
}: {
  params: Promise<{locale: string}>;
  searchParams: Promise<{class?: string}>;
}) {
  const {locale} = await params;
  const {class: classParam} = await searchParams;
  setRequestLocale(locale);
  const profile = await requireProfile();
  // Học sinh chỉ xem bảng CÁ NHÂN — tổng hợp lớp dành cho GV/quản trị (spec 20/07).
  if (profile.role === 'student') redirect('/student');
  const t = await getTranslations();
  const supabase = await createClient();
  // Hai truy vấn độc lập — chạy song song, tránh waterfall.
  const [{myClass, classes: accessible}, areaMetaFromCache] = await Promise.all([
    getClassContext(supabase, profile, classParam),
    getAreaMeta(),
  ]);
  const areaMeta = areaMetaFromCache;

  if (!myClass) {
    return (
      <div className="glass rounded-[26px] p-10 text-center">
        <h1 className="font-display text-xl font-bold text-navy">
          {t('class.noClass')}
        </h1>
        <p className="mt-2 text-sm text-grey-mid">{t('class.noClassDesc')}</p>
      </div>
    );
  }

  const gvcnName = profile.role === 'teacher' ? profile.full_name : null;

  // Các truy vấn chỉ phụ thuộc myClass.id — chạy song song, một đợt:
  //   · sĩ số (GVCN)                       enrollments đếm
  //   · mục tiêu LỚP 4 lĩnh vực (nhịp năm)  muc_tieu_v cap='lop' đã duyệt
  //   · ba số thi đua tách nhau            thi_dua_lop (KHÔNG cộng thành một điểm — 30 §4.2)
  //   · điểm xếp hạng cho huy hiệu          class_ranks
  //   · việc của lớp tuần này               bang_lop_thuoc ("n/m bạn đủ")
  //
  // Đây là mô hình mục tiêu PA2 (0166): view wig_progress_v và RPC class_lead_board CŨ đã gỡ.
  // Mục tiêu lớp nay là mục tiêu NĂM theo lĩnh vực; "việc tuần" cũ thay bằng thước lớp — một luật
  // đếm (bang_lop_thuoc) chung cho cả màn em, bảng tick của cô và trang chủ, không thể trôi lệch.
  const [rosterRes, {data: goalRows}, {data: thiDua}, {data: ranksData}, {data: thuocRows}] =
    await Promise.all([
      profile.role === 'teacher'
        ? supabase
            .from('enrollments')
            .select('id', {count: 'exact', head: true})
            .eq('class_id', myClass.id)
            .eq('is_active', true)
        : Promise.resolve(null),
      supabase
        .from('muc_tieu_v')
        .select('linh_vuc, pct, trang_thai_do')
        .eq('class_id', myClass.id)
        .eq('cap', 'lop')
        .eq('trang_thai', 'duyet'),
      supabase.rpc('thi_dua_lop', {p_class: myClass.id}),
      supabase.rpc('class_ranks', {c: myClass.id}),
      supabase.rpc('bang_lop_thuoc', {p_class: myClass.id}),
    ]);
  const rosterCount: number | null = rosterRes ? (rosterRes.count ?? 0) : null;
  // grades(name) là khối đã khai chuẩn; cột `grade` (text) là bản gõ tay thời chưa có bảng khối.
  const lopDayDu = myClass as typeof myClass & {
    grades?: {name?: string} | null;
    campuses?: {name?: string} | null;
  };
  const gradeName = lopDayDu.grades?.name ?? myClass.grade ?? null;
  const campusName = lopDayDu.campuses?.name ?? null;

  // Một mục tiêu MỖI lĩnh vực (mục tiêu lớp là mục tiêu năm — mỗi lĩnh vực nhiều nhất một).
  const goals = (goalRows ?? []) as GoalRow[];
  const goalByArea = new Map<string, GoalRow>();
  for (const g of goals) {
    if (g.linh_vuc && !goalByArea.has(g.linh_vuc)) goalByArea.set(g.linh_vuc, g);
  }

  // Ba số thi đua — TÁCH nhau, mỗi số một kỳ/luật khác nhau (30 §4.2). null = chưa có số → "—".
  const td = (thiDua?.[0] ?? null) as
    | {diem_muc_tieu: number | null; diem_thuoc: number | null; diem_cam_ket: number | null}
    | null;
  const fmtDiem = (n: number | null | undefined) =>
    n === null || n === undefined ? '—' : `${Math.round(Number(n))}%`;

  // Việc của lớp tuần này — "n/m bạn đủ" (so_em_dat / si_so). done khi mọi em đã đủ.
  const thuocs = ((thuocRows ?? []) as ThuocRow[]).map((r) => {
    const dat = Number(r.so_em_dat ?? 0);
    const si = Number(r.si_so ?? 0);
    return {id: r.thuoc_id, ten: r.ten, dat, si, done: si > 0 && dat >= si};
  });
  const thuocDone = thuocs.filter((r) => r.done).length;

  // Banner "3 giây": thắng khi số lĩnh vực đúng nhịp ≥ số chậm nhịp (theo mục tiêu năm của lớp).
  const onCount = goals.filter((g) => nhipVe(g.trang_thai_do) === 'on_track').length;
  const offCount = goals.filter((g) => nhipVe(g.trang_thai_do) === 'off_track').length;
  const isWinning = goals.length > 0 ? onCount >= offCount : null;

  const statusLabel: Record<string, string> = {
    on_track: t('class.onTrack'),
    mid: t('class.midTrack'),
    off_track: t('class.offTrack'),
  };


  return (
    <div className="flex flex-col gap-[22px]">
      {accessible.length > 1 && (
        <div className="flex justify-end">
          <ClassPicker classes={accessible} current={myClass.id} />
        </div>
      )}

      {/* Một dòng trạng thái trung tính (audit 04/09) — thay băng-rôn "ĐANG THẮNG / CẦN BỨT PHÁ" cao
          230px ở 360px: người đọc chỉ cần biết lớp đang đúng nhịp hay chậm và bao nhiêu mục tiêu. */}
      {isWinning !== null && (
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] font-bold text-navy">
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 ${
              isWinning ? 'bg-success/[0.12] text-success-dark' : 'bg-status-bad/[0.10] text-status-bad'
            }`}
          >
            {isWinning ? <Check size={13} strokeWidth={3} /> : <Minus size={13} strokeWidth={3} />}
            {isWinning ? t('class.nhipDung') : t('class.nhipCham')}
          </span>
          <span className="text-grey-mid">{t('class.yearOnTrack', {n: onCount, total: goals.length})}</span>
        </p>
      )}

      {/* Hero lớp — thẻ kính (glass on gradient v3) */}
      <div className="animate-rise glass rounded-[26px] p-6 sm:px-7 sm:py-6">
        <div className="flex flex-wrap items-center gap-2.5">
          <h1 className="font-display text-[28px] font-bold leading-none text-navy">
            {myClass.name}
          </h1>
          <span className="rounded-full border-[1.5px] border-gold-deep/40 bg-gold/10 px-3 py-1 text-[11.5px] font-extrabold text-gold-text">
            {myClass.school_year}
          </span>
        </div>

        {(gradeName || campusName || gvcnName || rosterCount !== null) && (
          <div className="mt-2 flex flex-wrap items-center gap-x-5 gap-y-1 text-[13px] font-bold text-txt">
            {gradeName && (
              <span className="inline-flex items-center gap-1.5">
                <Layers size={15} strokeWidth={2} className="text-gold-deep" />
                {t('class.grade')}: <b className="text-navy">{gradeName}</b>
              </span>
            )}
            {campusName && (
              <span className="inline-flex items-center gap-1.5">
                <Building2 size={15} strokeWidth={2} className="text-gold-deep" />
                {t('class.campus')}: <b className="text-navy">{campusName}</b>
              </span>
            )}
            {gvcnName && (
              <span className="inline-flex items-center gap-1.5">
                <GraduationCap size={16} strokeWidth={2} className="text-gold-deep" />
                {t('class.gvcn')}: <b className="text-navy">{gvcnName}</b>
              </span>
            )}
            {rosterCount !== null && (
              <span className="inline-flex items-center gap-1.5">
                <Users size={15} strokeWidth={2} className="text-gold-deep" />
                {t('class.students')}: <b className="text-navy">{rosterCount}</b>
              </span>
            )}
          </div>
        )}
      </div>

      {/* Ba số thi đua TÁCH nhau — không cộng thành một điểm (thi_dua_lop, 30 §4.2) */}
      {td && (
        <div className="glass rounded-[22px] p-5 sm:px-6">
          <div className="grid gap-3 sm:grid-cols-3">
            {[
              {label: t('class.diemMucTieu'), value: td.diem_muc_tieu},
              {label: t('class.diemViec'), value: td.diem_thuoc},
              {label: t('class.diemCamKet'), value: td.diem_cam_ket},
            ].map((s) => (
              <div
                key={s.label}
                className="rounded-[16px] bg-navy/[0.04] px-4 py-3.5 text-center"
              >
                <div className="font-display text-[26px] font-bold leading-none text-navy">
                  {fmtDiem(s.value)}
                </div>
                <div className="mt-1.5 text-[12px] font-extrabold text-grey-mid">
                  {s.label}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Mục tiêu năm của lớp — 4 lĩnh vực */}
      <section>
        <h2 className="mb-3 font-display text-[17px] font-bold text-navy">
          {t('lopMucTieu.khuMucTieu')}
        </h2>
        <div
          className="grid gap-3.5"
          style={{gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))'}}
        >
          {AREAS.map((a) => {
            const g = goalByArea.get(a);
            const am = areaMeta[a];
            const nhip = nhipVe(g?.trang_thai_do ?? null);
            const meta = nhip ? STATUS_META[nhip] : undefined;
            const Icon = areaIcon(am);
            return (
              <div key={a} className="glass glass-hover rounded-[20px] p-4 text-center">
                <div className="flex items-center justify-center gap-2 text-[13.5px] font-extrabold text-navy">
                  <span
                    className="grid h-[26px] w-[26px] shrink-0 place-items-center rounded-lg"
                    style={{background: am.soft, color: am.hex}}
                  >
                    <Icon size={15} strokeWidth={2.5} />
                  </span>
                  {areaLabel(am, locale)}
                </div>
                {g ? (
                  <>
                    <div className="mt-3.5 flex justify-center">
                      <DonutRing pct={Number(g.pct ?? 0)} status={nhip ?? ''} />
                    </div>
                    {meta && nhip && (
                      <span
                        className="mt-3 inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-extrabold"
                        style={{background: meta.bg, color: meta.color}}
                      >
                        {statusLabel[nhip] ?? ''}
                      </span>
                    )}
                  </>
                ) : (
                  <div className="mt-4 text-xs font-semibold text-grey-mid">
                    {t('class.noWig')}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

    </div>
  );
}

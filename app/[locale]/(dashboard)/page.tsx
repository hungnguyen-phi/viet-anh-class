import {getTranslations, setRequestLocale} from 'next-intl/server';
import {redirect} from 'next/navigation';
import {requireProfile} from '@/lib/auth';
import {createClient} from '@/lib/supabase/server';
import {getAccessibleClasses, getMyClass} from '@/lib/queries';
import {
  Check,
  X,
  Minus,
  Users,
  GraduationCap,
  Trophy,
  TrendingUp,
  Flame,
  Layers,
  Building2,
} from 'lucide-react';
import {ClassPicker} from '@/components/shell/ClassPicker';
import {DonutRing} from '@/components/charts/DonutRing';
import {AREAS, buildAreaMeta, areaLabel, areaIcon} from '@/lib/areas';

type WigRow = {
  wig_id: string;
  area: string;
  period: string;
  period_label: string | null;
  end_date: string;
  pct: number | null;
  status: string | null;
};
type LeadRow = {
  id: string;
  title: string;
  target_value: number;
  lead_progress: {value: number}[] | null;
};

// AREAS + màu/icon/nhãn lĩnh vực ("Môn") lấy từ lib/areas (đọc area_config, fallback = giá trị cũ).

// Meta trạng thái WIG (label lấy từ i18n, màu/nền theo design system v3).
const STATUS_META: Record<string, {color: string; bg: string}> = {
  on_track: {color: '#1e8a5a', bg: 'rgba(30,138,90,0.12)'},
  mid: {color: '#b98900', bg: 'rgba(185,137,0,0.12)'},
  off_track: {color: '#c0392b', bg: 'rgba(192,57,43,0.12)'},
};

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
  // Học sinh chỉ xem scoreboard CÁ NHÂN — tổng hợp lớp dành cho GV/quản trị (spec 20/07).
  if (profile.role === 'student') redirect('/student');
  const t = await getTranslations();
  const supabase = await createClient();
  // Hai truy vấn độc lập — chạy song song, tránh waterfall.
  const [myClass, accessible, {data: areaCfg}] = await Promise.all([
    getMyClass(supabase, profile, classParam),
    getAccessibleClasses(supabase, profile),
    supabase.from('area_config').select('*').order('sort_order'),
  ]);
  const areaMeta = buildAreaMeta(areaCfg);

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

  // 4 truy vấn chỉ phụ thuộc myClass.id — chạy song song:
  // sĩ số (GVCN) + tiến độ WIG năm & tuần + thứ hạng thi đua + tên khối/cơ sở.
  //
  // Tên khối/cơ sở: người thử báo "chỗ khối, cấp, campus hiện #1/1 không hiểu là gì". Thực ra
  // #1/1 là huy hiệu XẾP HẠNG (hạng 1 trong 1 lớp), còn TÊN khối và cơ sở thì trước nay không
  // được hiện ở đâu cả — nên nhãn "Khối" đứng cạnh "#1/1" bị đọc thành "khối = #1/1".
  const [rosterRes, {data: wigRows}, {data: ranksData}, {data: classMeta}] = await Promise.all([
    profile.role === 'teacher'
      ? supabase
          .from('enrollments')
          .select('id', {count: 'exact', head: true})
          .eq('class_id', myClass.id)
          .eq('is_active', true)
      : Promise.resolve(null),
    supabase
      .from('wig_progress_v')
      .select('wig_id, area, period, period_label, end_date, pct, status')
      .eq('class_id', myClass.id)
      .eq('scope', 'class')
      .in('period', ['year', 'week']),
    supabase.rpc('class_ranks', {c: myClass.id}),
    supabase
      .from('classes')
      .select('grade, grades(name), campuses(name)')
      .eq('id', myClass.id)
      .maybeSingle(),
  ]);
  const rosterCount: number | null = rosterRes ? (rosterRes.count ?? 0) : null;
  // grades(name) là khối đã khai chuẩn; cột `grade` (text) là bản gõ tay thời chưa có bảng khối.
  const gradeName =
    (classMeta as {grades?: {name?: string} | null} | null)?.grades?.name ?? myClass.grade ?? null;
  const campusName = (classMeta as {campuses?: {name?: string} | null} | null)?.campuses?.name ?? null;

  const rows = (wigRows ?? []) as WigRow[];
  const yearRows = rows.filter((r) => r.period === 'year');
  const weekRows = rows
    .filter((r) => r.period === 'week')
    .sort((a, b) => a.end_date.localeCompare(b.end_date));
  const wigByArea = new Map(yearRows.map((r) => [r.area, r]));
  const weeksByArea = new Map<string, WigRow[]>();
  for (const w of weekRows) {
    const arr = weeksByArea.get(w.area) ?? [];
    arr.push(w);
    weeksByArea.set(w.area, arr);
  }

  // Lead measure tuần: hoàn thành khi tổng tiến độ ≥ mục tiêu.
  const weekIds = weekRows.map((w) => w.wig_id);
  let leads: {id: string; title: string; target: number; actual: number; done: boolean}[] = [];
  if (weekIds.length > 0) {
    const {data: leadData} = await supabase
      .from('lead_measures')
      .select('id, title, target_value, lead_progress(value)')
      .in('wig_id', weekIds);
    leads = ((leadData ?? []) as LeadRow[]).map((l) => {
      const actual = (l.lead_progress ?? []).reduce((s, p) => s + Number(p.value ?? 0), 0);
      const target = Number(l.target_value);
      return {id: l.id, title: l.title, target, actual, done: target > 0 && actual >= target};
    });
  }
  const leadsDone = leads.filter((l) => l.done).length;

  // Banner "3 giây": thắng khi số lĩnh vực on-track ≥ số off-track (theo WIG năm).
  const onCount = yearRows.filter((r) => r.status === 'on_track').length;
  const offCount = yearRows.filter((r) => r.status === 'off_track').length;
  const isWinning = yearRows.length > 0 ? onCount >= offCount : null;

  const statusLabel: Record<string, string> = {
    on_track: t('class.onTrack'),
    mid: t('class.midTrack'),
    off_track: t('class.offTrack'),
  };

  // Chỉ còn lấy ĐIỂM thi đua từ class_ranks.
  //
  // Đã BỎ bốn huy hiệu thứ hạng "Khối #1/3 · Cấp #1/6 · Campus #1/2 · Group #1/6".
  // Lý do: với một trường mới, gần như mọi lớp đều là #1/1 hoặc #1/2 nên con số không nói lên
  // điều gì, mà lại đứng cạnh nhãn "Khối"/"Campus" khiến giáo viên đọc thành mã của khối/cơ sở —
  // đúng như người thử đã hiểu nhầm ("để #1/1 không hiểu là gì"). Tên khối và cơ sở THẬT giờ đã
  // hiện ngay dòng trên, nên bốn huy hiệu này chỉ còn gây rối.
  const rank = ranksData?.[0];

  return (
    <div className="flex flex-col gap-[22px]">
      {accessible.length > 1 && (
        <div className="flex justify-end">
          <ClassPicker classes={accessible} current={myClass.id} />
        </div>
      )}

      {/* Banner trạng thái "nhìn 3 giây biết thắng/thua" (PRD §6.1.1) */}
      {isWinning !== null && (
        <div
          className="animate-rise flex flex-wrap items-center gap-x-4 gap-y-2.5 rounded-[20px] p-5 text-white"
          style={{
            background: isWinning
              ? 'linear-gradient(120deg,#1e8a5a 0%,#16724a 100%)'
              : 'linear-gradient(120deg,#c0392b 0%,#9e2f23 100%)',
            boxShadow: isWinning
              ? '0 10px 26px rgba(30,138,90,0.3)'
              : '0 10px 26px rgba(192,57,43,0.3)',
          }}
        >
          <span className="grid h-[52px] w-[52px] shrink-0 place-items-center rounded-full bg-white/15 ring-2 ring-white/30">
            {isWinning ? (
              <Check size={26} strokeWidth={3} />
            ) : (
              <X size={26} strokeWidth={3} />
            )}
          </span>
          <div className="min-w-0">
            <div className="font-display text-2xl font-bold tracking-tight">
              {isWinning ? t('class.winning') : t('class.losing')}
            </div>
            <p className="mt-0.5 text-[13px] font-bold text-white/85">
              {isWinning ? t('class.winningDesc') : t('class.losingDesc')}
            </p>
          </div>
          <span className="ml-auto inline-flex shrink-0 items-center gap-1.5 rounded-full bg-white/15 px-3.5 py-1.5 text-xs font-extrabold">
            {isWinning ? (
              <TrendingUp size={14} strokeWidth={2.5} />
            ) : (
              <Flame size={14} strokeWidth={2.5} />
            )}
            {onCount}/{yearRows.length} on-track
          </span>
        </div>
      )}

      {/* Hero lớp — thẻ kính (glass on gradient v3) */}
      <div className="animate-rise glass rounded-[26px] p-6 sm:px-7 sm:py-6">
        <div className="flex flex-wrap items-center gap-2.5">
          <h1 className="font-display text-[28px] font-bold leading-none text-navy">
            {myClass.name}
          </h1>
          <span className="rounded-full border-[1.5px] border-gold-deep/40 bg-gold/10 px-3 py-1 text-[11.5px] font-extrabold text-gold-deep">
            {myClass.school_year}
          </span>
          {rank && (
            <span className="ml-auto inline-flex items-center gap-1.5 rounded-full bg-linear-to-b from-gold-soft to-gold px-3.5 py-1.5 text-[12px] font-extrabold text-navy shadow-[var(--shadow-gold)]">
              <Trophy size={13} strokeWidth={2.5} />
              {t('class.score')}: {Number(rank.score)}
            </span>
          )}
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

      {/* WIG năm — 4 lĩnh vực */}
      <section>
        <h2 className="font-display text-[17px] font-bold text-navy">
          {t('class.wigYear')}
        </h2>
        <p className="mb-3 mt-0.5 max-w-[640px] text-[12px] font-semibold leading-relaxed text-grey-mid">
          {t('class.wigGloss')}
        </p>
        <div
          className="grid gap-3.5"
          style={{gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))'}}
        >
          {AREAS.map((a) => {
            const w = wigByArea.get(a);
            const am = areaMeta[a];
            const meta = STATUS_META[w?.status ?? ''];
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
                {w ? (
                  <>
                    <div className="mt-3.5 flex justify-center">
                      <DonutRing pct={Number(w.pct ?? 0)} status={w.status ?? ''} />
                    </div>
                    {meta && (
                      <span
                        className="mt-3 inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-extrabold"
                        style={{background: meta.bg, color: meta.color}}
                      >
                        {statusLabel[w.status ?? ''] ?? ''}
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

      {/* WIG tuần + Lead measure — 2 cột */}
      <div
        className="grid items-start gap-5"
        style={{gridTemplateColumns: 'repeat(auto-fit,minmax(360px,1fr))'}}
      >
        {/* WIG tuần theo 4 lĩnh vực — dãy pip thắng/thua vuông (PRD §6.1.1) */}
        <div>
          <h2 className="mb-3 font-display text-[17px] font-bold text-navy">
            {t('class.wigWeek')}
          </h2>
          <div className="glass rounded-[20px]">
            {AREAS.map((a, i) => {
              const weeks = weeksByArea.get(a) ?? [];
              const wins = weeks.filter((w) => Number(w.pct ?? 0) >= 1).length;
              const am = areaMeta[a];
              return (
                <div
                  key={a}
                  className={`flex flex-wrap items-center gap-x-[9px] gap-y-2 px-3.5 py-3 ${
                    i < AREAS.length - 1 ? 'border-b border-navy/[0.08]' : ''
                  }`}
                >
                  <span
                    className="h-[9px] w-[9px] shrink-0 rounded-full"
                    style={{background: am.hex}}
                  />
                  <span className="text-[13px] font-extrabold text-navy">
                    {areaLabel(am, locale)}
                  </span>
                  <span className="flex-1" />
                  {weeks.length > 0 ? (
                    <>
                      <span className="flex gap-1">
                        {weeks.slice(-10).map((w) => {
                          const won = Number(w.pct ?? 0) >= 1;
                          return (
                            <span
                              key={w.wig_id}
                              title={w.period_label ?? ''}
                              className="grid h-[22px] w-[22px] place-items-center rounded-[7px]"
                              style={{
                                background: won ? 'var(--color-success)' : 'rgba(38,39,93,0.08)',
                                color: won ? '#ffffff' : 'var(--color-grey-mid)',
                              }}
                            >
                              {won ? (
                                <Check size={12} strokeWidth={3} />
                              ) : (
                                <X size={12} strokeWidth={3} />
                              )}
                            </span>
                          );
                        })}
                      </span>
                      <span className="w-9 shrink-0 text-right font-display text-[15px] font-bold text-navy">
                        {wins}
                        <span className="text-[11.5px] font-bold text-grey-mid">
                          /{weeks.length}
                        </span>
                      </span>
                    </>
                  ) : (
                    <span className="text-[11.5px] font-semibold text-grey-mid">
                      {t('class.noWeekWig')}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Lead measure tuần này — hoàn thành/tổng + thanh tiến độ 3 màu */}
        <div>
          <div className="mb-3 flex flex-wrap items-baseline gap-x-2.5 gap-y-1.5">
            <h2 className="font-display text-[17px] font-bold text-navy">
              {t('class.leadWeek')}
            </h2>
            {leads.length > 0 && (
              <span className="rounded-full bg-navy px-2.5 py-1 text-[11px] font-extrabold text-white">
                {leadsDone}/{leads.length} {t('class.leadDone')}
              </span>
            )}
          </div>
          {leads.length === 0 ? (
            <p className="text-xs italic text-grey-mid">{t('class.noLeads')}</p>
          ) : (
            <div className="glass overflow-x-auto rounded-[20px]">
              {leads.map((l, i) => {
                const pct = l.target > 0 ? Math.min(1, l.actual / l.target) : 0;
                const barBg = pct >= 1 ? '#1e8a5a' : pct >= 0.5 ? '#e3b400' : '#c0392b';
                return (
                  <div
                    key={l.id}
                    className={`flex items-center gap-3 px-4 py-3 ${
                      i < leads.length - 1 ? 'border-b border-navy/[0.08]' : ''
                    }`}
                  >
                    <span
                      className="grid h-7 w-7 shrink-0 place-items-center rounded-full"
                      style={{
                        background: l.done ? 'var(--color-success)' : 'rgba(38,39,93,0.08)',
                        color: l.done ? '#ffffff' : 'var(--color-grey-mid)',
                      }}
                    >
                      {l.done ? (
                        <Check size={14} strokeWidth={3} />
                      ) : (
                        <Minus size={14} strokeWidth={3} />
                      )}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-extrabold text-navy">
                        {l.title}
                      </div>
                      <div className="mt-[7px] h-[9px] overflow-hidden rounded-[5px] bg-navy/[0.08]">
                        <div
                          className="h-full rounded-[5px]"
                          style={{width: `${Math.round(pct * 100)}%`, background: barBg}}
                        />
                      </div>
                    </div>
                    <span className="shrink-0 font-display text-base font-bold text-navy">
                      {l.actual}
                      <span className="text-xs font-bold text-grey-mid">/{l.target}</span>
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <p className="text-xs italic text-grey-mid">{t('class.noWigDesc')}</p>
    </div>
  );
}

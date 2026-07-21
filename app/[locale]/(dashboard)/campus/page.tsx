import {getTranslations, setRequestLocale} from 'next-intl/server';
import {requireRole} from '@/lib/auth';
import {createClient} from '@/lib/supabase/server';

export default async function CampusPage({
  params,
}: {
  params: Promise<{locale: string}>;
}) {
  const {locale} = await params;
  setRequestLocale(locale);
  await requireRole(['principal', 'admin']);
  const t = await getTranslations('campusReport');
  const supabase = await createClient();

  // Lớp trong phạm vi (RLS: BGH thấy campus mình; admin thấy tất cả).
  const {data: classes} = await supabase
    .from('classes')
    .select('id, name, school_year')
    .order('name');

  const {data: todayVal} = await supabase.rpc('app_today');
  const today = String(todayVal);

  const rows = await Promise.all(
    (classes ?? []).map(async (c) => {
      const [{data: ranks}, {count}] = await Promise.all([
        supabase.rpc('class_ranks', {c: c.id}),
        supabase
          .from('attendance_records')
          .select('id', {count: 'exact', head: true})
          .eq('class_id', c.id)
          .eq('date', today),
      ]);
      return {
        id: c.id,
        name: c.name,
        school_year: c.school_year,
        score: ranks?.[0]?.score ?? 0,
        att: count ?? 0,
      };
    }),
  );

  await supabase.rpc('log_audit', {p_action: 'view_campus_report'});

  return (
    <div className="flex flex-col gap-3.5">
      <h1 className="font-display text-[22px] font-bold text-navy">
        {t('title')}
      </h1>

      {rows.length === 0 ? (
        <p className="text-sm italic text-grey-mid">{t('noClasses')}</p>
      ) : (
        <div className="glass overflow-x-auto rounded-[20px]">
          {/* Header */}
          <div className="flex min-w-[560px] items-center gap-2 bg-white/40 px-[18px] py-2.5">
            <span
              className="text-[11px] font-extrabold uppercase text-grey-mid"
              style={{flex: 1.3}}
            >
              {t('class')}
            </span>
            <span
              className="text-[11px] font-extrabold uppercase text-grey-mid"
              style={{flex: 1}}
            >
              {t('year')}
            </span>
            <span
              className="text-right text-[11px] font-extrabold uppercase text-grey-mid"
              style={{flex: 1}}
            >
              {t('score')}
            </span>
            <span
              className="text-right text-[11px] font-extrabold uppercase text-grey-mid"
              style={{flex: 1}}
            >
              {t('attToday')}
            </span>
          </div>

          {/* Rows */}
          {rows.map((r) => (
            <div
              key={r.id}
              className="flex min-w-[560px] items-center gap-2 border-t border-navy/[0.08] px-[18px] py-2.5 transition-colors hover:bg-white/35"
            >
              <span
                className="text-[13.5px] font-bold text-navy"
                style={{flex: 1.3}}
              >
                {r.name}
              </span>
              <span
                className="text-[12.5px] font-semibold text-grey-mid"
                style={{flex: 1}}
              >
                {r.school_year}
              </span>
              <span
                className="text-right font-display text-[15px] text-navy"
                style={{flex: 1}}
              >
                {Number(r.score)}
              </span>
              <span
                className="text-right text-[12.5px] font-semibold text-grey-mid"
                style={{flex: 1}}
              >
                {r.att} {t('marked')}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

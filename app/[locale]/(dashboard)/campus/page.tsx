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

  // 1 RPC gộp: điểm thi đua (tính 1 lần) + điểm danh hôm nay cho MỌI lớp trong phạm vi
  // (BGH: campus mình; admin: tất cả). Thay cho N+1 class_ranks() trước đây.
  const {data: ranksData} = await supabase.rpc('campus_ranks');
  const rows = (ranksData ?? []).map((r) => ({
    id: r.class_id,
    name: r.name,
    school_year: r.school_year,
    score: Number(r.score),
    att: Number(r.att_today),
  }));

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
          <div className="flex min-w-[560px] items-center gap-2 bg-navy/[0.03] px-[18px] py-2.5">
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
              className="flex min-w-[560px] items-center gap-2 border-t border-navy/[0.08] px-[18px] py-2.5 transition-colors hover:bg-navy/[0.03]"
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

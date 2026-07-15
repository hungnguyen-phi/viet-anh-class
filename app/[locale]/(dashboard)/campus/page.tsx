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
    <div className="space-y-4">
      <h1 className="font-heading text-xl font-black text-navy">{t('title')}</h1>

      {rows.length === 0 ? (
        <p className="text-sm italic text-grey-mid">{t('noClasses')}</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-grey-line bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-grey-light text-navy">
                <th className="px-3 py-2 text-left">{t('class')}</th>
                <th className="px-3 py-2 text-left">{t('year')}</th>
                <th className="px-3 py-2 text-right">{t('score')}</th>
                <th className="px-3 py-2 text-right">{t('attToday')}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-t border-grey-line">
                  <td className="px-3 py-2 font-medium text-ink">{r.name}</td>
                  <td className="px-3 py-2 text-grey-mid">{r.school_year}</td>
                  <td className="px-3 py-2 text-right font-heading font-extrabold text-navy">
                    {Number(r.score)}
                  </td>
                  <td className="px-3 py-2 text-right text-grey-mid">
                    {r.att} {t('marked')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

import {getTranslations} from 'next-intl/server';
import {createClient} from '@/lib/supabase/server';

// Tổng hợp cảm xúc lớp 7 ngày cho GVCN — tín hiệu cảnh báo sớm về tâm lý học sinh.
// RLS mc_staff_read cho GVCN của lớp đọc mood của HS lớp mình.

const MOODS: Record<string, {emoji: string; color: string}> = {
  great: {emoji: '😄', color: '#1e8a5a'},
  good: {emoji: '🙂', color: '#7cb342'},
  ok: {emoji: '😐', color: '#9aa0b8'},
  low: {emoji: '😟', color: '#e3b400'},
  bad: {emoji: '😢', color: '#c0392b'},
};
const CONCERN = new Set(['low', 'bad']);

function lastDays(today: string, n: number): string[] {
  const base = new Date(today + 'T00:00:00Z');
  const out: string[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(base);
    d.setUTCDate(base.getUTCDate() - i);
    out.push(d.toISOString().slice(0, 10));
  }
  return out;
}

export async function ClassMoodBoard({
  classId,
  today,
  students,
}: {
  classId: string;
  today: string;
  students: {id: string; name: string}[];
}) {
  const t = await getTranslations('roster');
  const supabase = await createClient();
  const days = lastDays(today, 7);

  const {data: moods} = await supabase
    .from('mood_checkins')
    .select('student_id, date, mood')
    .eq('class_id', classId)
    .gte('date', days[0]);

  const byStudent = new Map<string, Map<string, string>>();
  for (const m of (moods ?? []) as {student_id: string; date: string; mood: string}[]) {
    const mm = byStudent.get(m.student_id) ?? new Map<string, string>();
    mm.set(m.date, m.mood);
    byStudent.set(m.student_id, mm);
  }

  // Đếm ngày buồn (low/bad) mỗi em → nổi bật + đưa lên đầu.
  const rows = students
    .map((s) => {
      const mm = byStudent.get(s.id) ?? new Map<string, string>();
      const concern = days.filter((d) => CONCERN.has(mm.get(d) ?? '')).length;
      return {...s, mm, concern};
    })
    .sort((a, b) => b.concern - a.concern || a.name.localeCompare(b.name, 'vi'));

  if (moods === null) {
    return (
      <section className="glass rounded-[20px] p-[18px]">
        <h2 className="mb-1 font-display text-[15px] font-bold text-navy">{t('moodTitle')}</h2>
        <p className="text-xs italic text-grey-mid">{t('moodError')}</p>
      </section>
    );
  }

  if (moods !== null && (moods?.length ?? 0) === 0) {
    return (
      <section className="glass rounded-[20px] p-[18px]">
        <h2 className="mb-1 font-display text-[15px] font-bold text-navy">{t('moodTitle')}</h2>
        <p className="text-xs italic text-grey-mid">{t('moodNone')}</p>
      </section>
    );
  }

  const dow = (d: string) => ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'][new Date(d + 'T00:00:00Z').getUTCDay()];

  return (
    <section className="glass rounded-[20px] p-[18px]">
      <h2 className="mb-1 font-display text-[15px] font-bold text-navy">{t('moodTitle')}</h2>
      <div className="mb-3 flex flex-wrap items-center gap-3 text-[11px] font-bold text-grey-mid">
        {Object.entries(MOODS).map(([k, v]) => (
          <span key={k} className="inline-flex items-center gap-1">
            {v.emoji} <span>{t(`mood.${k}`)}</span>
          </span>
        ))}
      </div>
      <div className="overflow-x-auto rounded-[14px] border-[1.5px] border-navy/10">
        <div className="flex min-w-[560px] items-center gap-2 bg-navy/[0.02] px-[14px] py-2">
          <span className="flex-1 text-[11px] font-extrabold uppercase text-grey-mid">{t('name')}</span>
          {days.map((d) => (
            <span key={d} className="w-9 flex-none text-center text-[10px] font-extrabold text-grey-mid">
              {dow(d)}
            </span>
          ))}
          <span className="w-[70px] flex-none text-center text-[10px] font-extrabold text-grey-mid" />
        </div>
        {rows.map((r) => (
          <div
            key={r.id}
            className={`flex min-w-[560px] items-center gap-2 border-t border-navy/[0.08] px-[14px] py-1.5 ${
              r.concern >= 2 ? 'bg-status-bad/[0.06]' : ''
            }`}
          >
            <span className="min-w-0 flex-1 truncate text-[13px] font-bold text-navy">{r.name}</span>
            {days.map((d) => {
              const mood = r.mm.get(d);
              const info = mood ? MOODS[mood] : null;
              return (
                <span
                  key={d}
                  className="grid w-9 flex-none place-items-center text-[15px]"
                  title={info ? `${d} · ${t(`mood.${mood}`)}` : d}
                >
                  {info ? info.emoji : <span className="text-navy/15">·</span>}
                </span>
              );
            })}
            <span className="w-[70px] flex-none text-center">
              {r.concern >= 2 && (
                <span className="rounded-full bg-status-bad/15 px-2 py-0.5 text-[10px] font-extrabold text-status-bad">
                  {t('moodFlag')}
                </span>
              )}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}

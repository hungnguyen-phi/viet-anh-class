import {getTranslations} from 'next-intl/server';
import {createClient} from '@/lib/supabase/server';
import type {Profile} from '@/lib/auth';
import {todayInVN, isoWeekLabel} from '@/lib/dates';
import {BookOpen, Sparkles, Languages, Bike, type LucideIcon} from 'lucide-react';
import {DonutRing} from '@/components/charts/DonutRing';
import {MoodCheckin, type MoodKey} from '@/components/student/MoodCheckin';
import {LeadTicker, type TickerLead} from '@/components/student/LeadTicker';
import {
  StudentMeetings,
  type StudentMeeting,
  type Classmate,
} from '@/components/student/StudentMeetings';

const AREAS = ['knowledge', 'skills', 'english', 'physical'] as const;

// Màu môn (ring theo màu môn cho học sinh) + nền chip alpha + icon.
const SUBJECTS: Record<string, {color: string; chip: string; Icon: LucideIcon}> = {
  knowledge: {color: 'var(--color-subj-knowledge)', chip: 'rgba(58,98,201,0.14)', Icon: BookOpen},
  skills: {color: 'var(--color-subj-skills)', chip: 'rgba(85,127,60,0.14)', Icon: Sparkles},
  english: {color: 'var(--color-subj-english)', chip: 'rgba(14,124,134,0.14)', Icon: Languages},
  physical: {color: 'var(--color-subj-physical)', chip: 'rgba(207,90,66,0.14)', Icon: Bike},
};

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
  unit: string | null;
  lead_progress:
    | {id: string; value: number; logged_date: string; created_at: string; logged_by: string | null}[]
    | null;
};

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export async function StudentScoreboard({
  studentId,
  viewer,
  flash,
}: {
  studentId: string;
  viewer: Profile;
  flash?: string;
}) {
  const t = await getTranslations('student');
  const tc = await getTranslations('class');
  const supabase = await createClient();
  const canManage = viewer.role === 'teacher' || viewer.role === 'admin';
  const canEditMood = viewer.id === studentId && viewer.role === 'student';

  // Ngày hôm nay (theo DB) để tra cứu cảm xúc đúng ngày.
  const {data: todayData} = await supabase.rpc('app_today');
  const today = (todayData as unknown as string) ?? todayInVN();

  // Truy vấn song song — RLS tự giới hạn quyền xem.
  const [{data: student}, {data: enr}, {data: wigRows}, {data: meetingRows}, {data: moodRow}] =
    await Promise.all([
      supabase.from('profiles').select('id, full_name, email').eq('id', studentId).maybeSingle(),
      supabase
        .from('enrollments')
        .select('class_id, classes(name, school_year)')
        .eq('student_id', studentId)
        .eq('is_active', true)
        .limit(1)
        .maybeSingle(),
      supabase
        .from('wig_progress_v')
        .select('wig_id, area, period, period_label, end_date, pct, status')
        .eq('student_id', studentId)
        .eq('scope', 'student')
        .in('period', ['year', 'week']),
      supabase
        .from('wig_meetings')
        .select(
          'id, week_label, results, commitments, next_actions, created_at, buddy:profiles!wig_meetings_buddy_id_fkey(full_name)',
        )
        .eq('student_id', studentId)
        .order('created_at', {ascending: false}),
      supabase
        .from('mood_checkins')
        .select('mood')
        .eq('student_id', studentId)
        .eq('date', today)
        .maybeSingle(),
    ]);

  if (!student) {
    return (
      <div className="animate-rise glass mt-4 rounded-[26px] p-10 text-center">
        <p className="text-sm font-semibold text-grey-mid">{t('notFound')}</p>
      </div>
    );
  }

  const enrRow = enr as unknown as {
    class_id: string;
    classes: {name: string; school_year: string} | null;
  } | null;
  const cls = enrRow?.classes;
  const classId = enrRow?.class_id ?? null;
  const mood = (moodRow?.mood ?? null) as MoodKey | null;

  const meetings: StudentMeeting[] = (
    (meetingRows ?? []) as unknown as {
      id: string;
      week_label: string;
      results: string | null;
      commitments: string | null;
      next_actions: string | null;
      created_at: string;
      buddy: {full_name: string | null} | null;
    }[]
  ).map((m) => ({
    id: m.id,
    week_label: m.week_label,
    results: m.results,
    commitments: m.commitments,
    next_actions: m.next_actions,
    created_at: m.created_at,
    buddy_name: m.buddy?.full_name ?? null,
  }));

  let classmates: Classmate[] = [];
  if (canManage && classId) {
    const {data: mates} = await supabase
      .from('enrollments')
      .select('student_id, profiles!enrollments_student_id_fkey(full_name)')
      .eq('class_id', classId)
      .eq('is_active', true)
      .neq('student_id', studentId);
    classmates = (
      (mates ?? []) as unknown as {student_id: string; profiles: {full_name: string | null} | null}[]
    )
      .map((r) => ({id: r.student_id, name: r.profiles?.full_name ?? r.student_id}))
      .sort((a, b) => a.name.localeCompare(b.name, 'vi'));
  }

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

  const weekIds = weekRows.map((w) => w.wig_id);
  let tickerLeads: TickerLead[] = [];
  if (weekIds.length > 0) {
    const {data: leadData} = await supabase
      .from('lead_measures')
      .select('id, title, target_value, unit, lead_progress(id, value, logged_date, created_at, logged_by)')
      .in('wig_id', weekIds);
    tickerLeads = ((leadData ?? []) as LeadRow[]).map((l) => ({
      id: l.id,
      title: l.title,
      target: Number(l.target_value),
      unit: l.unit,
      entries: (l.lead_progress ?? []).map((p) => ({
        id: p.id,
        value: Number(p.value ?? 0),
        loggedDate: p.logged_date,
        createdAt: p.created_at,
        mine: p.logged_by === viewer.id,
      })),
    }));
  }

  const canTick = viewer.id === studentId && viewer.role === 'student';
  const displayName = student.full_name ?? student.email;
  const hasWeek = weekRows.length > 0;

  return (
    <div className="mt-4 flex flex-col gap-[22px]">
      {flash && (
        <div className="rounded-2xl border border-success/30 bg-success/10 px-4 py-2.5 text-sm font-bold text-success">
          {flash}
        </div>
      )}

      {/* Hero: chào mừng + mood check-in (2 cột glass) */}
      <div className="animate-rise grid grid-cols-1 overflow-hidden rounded-[26px] glass md:grid-cols-2">
        <div className="flex items-center gap-[18px] p-7">
          <span className="animate-wiggle grid h-[72px] w-[72px] shrink-0 place-items-center rounded-[22px] bg-linear-to-b from-gold-soft to-gold font-display text-[28px] font-bold text-navy shadow-[0_4px_12px_rgba(233,180,0,0.35)]">
            ★
          </span>
          <div className="min-w-0">
            <div className="text-[12px] font-extrabold uppercase tracking-[0.04em] text-gold-deep">
              {t('title')}
            </div>
            <h1 className="font-display text-[30px] font-bold leading-[1.15] text-navy">
              {t('hello', {name: displayName})}
            </h1>
            {cls && (
              <div className="mt-0.5 text-[13.5px] font-bold text-txt">
                {cls.name} · {cls.school_year}
              </div>
            )}
          </div>
        </div>
        <div className="border-t border-navy/[0.08] p-6 md:border-l md:border-t-0">
          <MoodCheckin initialMood={mood} canEdit={canEditMood} />
        </div>
      </div>

      {/* WIG năm — bento ring theo màu môn */}
      <section>
        <h2 className="mb-3 font-display text-[17px] font-bold text-navy">{t('wigYear')}</h2>
        <div className="grid grid-cols-2 gap-3.5 lg:grid-cols-4">
          {AREAS.map((a) => {
            const w = wigByArea.get(a);
            const s = SUBJECTS[a];
            return (
              <div key={a} className="glass glass-hover rounded-[20px] p-4">
                <div className="flex items-center gap-[7px] text-[13.5px] font-extrabold text-navy">
                  <span
                    className="grid h-[26px] w-[26px] shrink-0 place-items-center rounded-lg"
                    style={{background: s.chip, color: s.color}}
                  >
                    <s.Icon size={15} strokeWidth={2.5} />
                  </span>
                  {tc(`areas.${a}`)}
                </div>
                <div className="mt-3.5 flex justify-center">
                  {w ? (
                    <DonutRing pct={Number(w.pct ?? 0)} color={s.color} />
                  ) : (
                    <div className="grid h-[78px] place-items-center text-xs font-semibold text-grey-mid">
                      {tc('noWig')}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Lead measure tuần + WIG tuần + Họp WIG (2 cột) */}
      <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-2">
        <section>
          <div className="mb-3 flex items-baseline gap-2">
            <h2 className="font-display text-[17px] font-bold text-navy">{t('leads')}</h2>
            <span className="text-xs font-bold text-grey-mid">{t('leadsHint')}</span>
          </div>
          {tickerLeads.length === 0 ? (
            <p className="text-sm italic text-grey-mid">{t('noLeads')}</p>
          ) : (
            <LeadTicker leads={tickerLeads} studentId={studentId} canTick={canTick} />
          )}
        </section>

        <div className="flex flex-col gap-[22px]">
          <section>
            <h2 className="mb-3 font-display text-[17px] font-bold text-navy">{t('wigWeek')}</h2>
            {hasWeek ? (
              <div className="glass rounded-[20px]">
                {AREAS.map((a, i) => {
                  const weeks = weeksByArea.get(a) ?? [];
                  const wins = weeks.filter((w) => Number(w.pct ?? 0) >= 1).length;
                  const s = SUBJECTS[a];
                  return (
                    <div
                      key={a}
                      className={`flex flex-wrap items-center gap-x-[9px] gap-y-1.5 px-3.5 py-3 ${
                        i < AREAS.length - 1 ? 'border-b border-navy/[0.08]' : ''
                      }`}
                    >
                      <span className="h-[9px] w-[9px] shrink-0 rounded-full" style={{background: s.color}} />
                      <span className="whitespace-nowrap text-[13px] font-extrabold text-navy">
                        {tc(`areas.${a}`)}
                      </span>
                      <span className="flex-1" />
                      <span className="flex gap-[3px]">
                        {weeks.length === 0 ? (
                          <span className="text-xs italic text-grey-mid">{tc('noWeekWig')}</span>
                        ) : (
                          weeks.slice(-5).map((w) => {
                            const won = Number(w.pct ?? 0) >= 1;
                            return (
                              <svg
                                key={w.wig_id}
                                width="18"
                                height="18"
                                viewBox="0 0 24 24"
                                fill={won ? '#f9dd0e' : 'transparent'}
                                stroke={won ? '#e3b400' : 'rgba(38,39,93,0.2)'}
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              >
                                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                              </svg>
                            );
                          })
                        )}
                      </span>
                      {weeks.length > 0 && (
                        <span className="w-9 text-right font-display text-[15px] font-bold" style={{color: s.color}}>
                          {wins}
                          <span className="text-[11.5px] text-grey-mid">/{weeks.length}</span>
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm italic text-grey-mid">{tc('noWig')}</p>
            )}
          </section>

          <section>
            <h2 className="mb-3 font-display text-[17px] font-bold text-navy">{t('meetings')}</h2>
            <StudentMeetings
              studentId={studentId}
              classId={classId}
              meetings={meetings}
              classmates={classmates}
              canManage={canManage}
              defaultWeek={isoWeekLabel(new Date())}
            />
          </section>
        </div>
      </div>
    </div>
  );
}

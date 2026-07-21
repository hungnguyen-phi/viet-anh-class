import {getTranslations} from 'next-intl/server';
import {createClient} from '@/lib/supabase/server';
import type {Profile} from '@/lib/auth';
import {isoWeekLabel} from '@/lib/dates';
import {
  Star,
  BookOpen,
  Sparkles,
  Languages,
  Bike,
  Laugh,
  Smile,
  Meh,
  Frown,
  Angry,
  type LucideIcon,
} from 'lucide-react';
import {LeadTicker, type TickerLead} from '@/components/student/LeadTicker';
import {
  StudentMeetings,
  type StudentMeeting,
  type Classmate,
} from '@/components/student/StudentMeetings';

const AREAS = ['knowledge', 'skills', 'english', 'physical'] as const;

// Mỗi môn 1 màu pastel vui + icon riêng → trẻ nhận diện nhanh.
const SUBJECTS: Record<string, {color: string; soft: string; Icon: LucideIcon}> = {
  knowledge: {color: 'var(--color-subj-knowledge)', soft: 'var(--color-subj-knowledge-soft)', Icon: BookOpen},
  skills: {color: 'var(--color-subj-skills)', soft: 'var(--color-subj-skills-soft)', Icon: Sparkles},
  english: {color: 'var(--color-subj-english)', soft: 'var(--color-subj-english-soft)', Icon: Languages},
  physical: {color: 'var(--color-subj-physical)', soft: 'var(--color-subj-physical-soft)', Icon: Bike},
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

// Thang cảm xúc 5 mức — màu = tín hiệu trạng thái (PRD §6.1), tính từ nhịp WIG cá nhân.
const MOOD_LEVELS = [
  {key: 'great', color: '#1e8a5a', text: '#ffffff', Icon: Laugh},
  {key: 'good', color: '#7bb662', text: '#12351f', Icon: Smile},
  {key: 'ok', color: '#f9dd0e', text: '#26275d', Icon: Meh},
  {key: 'low', color: '#e08a00', text: '#ffffff', Icon: Frown},
  {key: 'bad', color: '#e0483a', text: '#ffffff', Icon: Angry},
] as const;

function moodIndex(yearRows: WigRow[], weekRows: WigRow[]): number | null {
  const base = yearRows.length > 0 ? yearRows : weekRows;
  if (base.length === 0) return null;
  const score =
    base.reduce((s, r) => s + (r.status === 'on_track' ? 1 : r.status === 'mid' ? 0.5 : 0), 0) /
    base.length;
  if (score >= 0.85) return 0;
  if (score >= 0.65) return 1;
  if (score >= 0.45) return 2;
  if (score >= 0.25) return 3;
  return 4;
}

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

// Vòng tiến độ tròn theo màu môn (to, rõ, thân thiện).
function PlayRing({pct, color, soft}: {pct: number; color: string; soft: string}) {
  const percent = Math.round((pct ?? 0) * 100);
  return (
    <div
      className="relative mx-auto grid h-20 w-20 place-items-center rounded-full"
      style={{background: `conic-gradient(${color} ${percent}%, ${soft} 0)`}}
    >
      <div className="absolute inset-[9px] rounded-full bg-white" />
      <span className="relative font-fun text-lg font-bold" style={{color}}>
        {percent}%
      </span>
    </div>
  );
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

  // Các truy vấn chỉ phụ thuộc studentId — chạy song song (RLS tự giới hạn quyền xem).
  const [{data: student}, {data: enr}, {data: wigRows}, {data: meetingRows}] = await Promise.all([
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
  ]);

  if (!student) {
    return (
      <div className="kid">
        <div className="card-fun p-10 text-center">
          <p className="text-sm text-grey-mid">{t('notFound')}</p>
        </div>
      </div>
    );
  }

  const enrRow = enr as unknown as {
    class_id: string;
    classes: {name: string; school_year: string} | null;
  } | null;
  const cls = enrRow?.classes;
  const classId = enrRow?.class_id ?? null;

  // Biên bản họp cá nhân (kèm tên Buddy).
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

  // Danh sách bạn cùng lớp (làm Buddy) — chỉ cần khi GVCN/Admin soạn biên bản.
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

  // Lead measure cá nhân (thuộc WIG tuần của em) + toàn bộ tick để hiển thị 7 ngày.
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

  const mood = moodIndex(yearRows, weekRows);
  const currentMood = mood !== null ? MOOD_LEVELS[mood] : null;
  const canTick = viewer.id === studentId && viewer.role === 'student';
  const displayName = student.full_name ?? student.email;
  const firstName = (student.full_name ?? '').trim().split(/\s+/).pop() || displayName;

  return (
    <div className="kid space-y-8">
      {/* Hero vui — chào tên, chỗ dành cho mascot sư tử (sắp có) */}
      <div className="animate-pop relative overflow-hidden rounded-[2rem] p-6 text-white shadow-raise sm:p-8 [background:radial-gradient(30rem_18rem_at_90%_-10%,rgba(249,221,14,0.28),transparent_60%),linear-gradient(135deg,#333586_0%,#26275d_60%,#1b1c45_100%)]">
        <div className="relative flex items-center gap-4 sm:gap-5">
          <span className="animate-wiggle grid h-16 w-16 shrink-0 place-items-center rounded-[1.4rem] bg-linear-to-b from-gold-soft to-gold font-fun text-2xl font-bold text-navy shadow-[0_6px_0_rgba(0,0,0,0.15)] sm:h-20 sm:w-20 sm:text-3xl">
            {initialsOf(displayName)}
          </span>
          <div className="min-w-0">
            <p className="font-fun text-sm font-semibold text-gold/90 sm:text-base">
              {t('title')}
            </p>
            <h1 className="truncate font-fun text-2xl font-bold leading-tight sm:text-4xl">
              {t('hello', {name: firstName})}
            </h1>
            {cls && (
              <span className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-xs font-bold ring-1 ring-white/25 sm:text-sm">
                {cls.name} · {cls.school_year}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Nhiệt kế cảm xúc — NGÔI SAO của trang: mặt to + lời động viên */}
      <section>
        <h2 className="mb-4 flex items-center gap-2 font-fun text-lg font-bold text-navy">
          <Star size={20} strokeWidth={2.5} className="text-gold" fill="currentColor" />
          {t('mood')}
        </h2>
        <div className="card-fun p-6 sm:p-7">
          {currentMood ? (
            <div className="flex flex-col items-center gap-5 sm:flex-row sm:gap-7">
              <div
                className="animate-wiggle grid h-28 w-28 shrink-0 place-items-center rounded-full shadow-[0_8px_0_rgba(23,25,48,0.10)]"
                style={{background: currentMood.color, color: currentMood.text}}
              >
                <currentMood.Icon size={64} strokeWidth={2} />
              </div>
              <div className="text-center sm:text-left">
                <div className="font-fun text-2xl font-bold text-navy sm:text-3xl">
                  {t(`levels.${currentMood.key}`)}
                </div>
                <p className="mt-1 text-sm text-txt sm:text-base">
                  {t(`moodMsg.${currentMood.key}`)}
                </p>
                {/* Dãy 5 mức nhỏ — mức hiện tại nổi bật */}
                <div className="mt-4 flex justify-center gap-2 sm:justify-start">
                  {MOOD_LEVELS.map((lv, i) => {
                    const active = mood === i;
                    return (
                      <span
                        key={lv.key}
                        aria-current={active ? 'true' : undefined}
                        title={t(`levels.${lv.key}`)}
                        className={`grid place-items-center rounded-full transition-all duration-200 ${
                          active ? 'h-11 w-11 ring-2 ring-navy/25' : 'h-8 w-8 opacity-45'
                        }`}
                        style={{background: lv.color, color: lv.text}}
                      >
                        <lv.Icon size={active ? 24 : 16} strokeWidth={2} />
                      </span>
                    );
                  })}
                </div>
              </div>
            </div>
          ) : (
            <p className="text-center text-sm text-grey-mid">{t('noWig')}</p>
          )}
        </div>
      </section>

      {/* WIG năm — 4 thẻ môn nhiều màu, vòng tròn to */}
      <section>
        <h2 className="mb-4 flex items-center gap-2 font-fun text-lg font-bold text-navy">
          <Sparkles size={20} strokeWidth={2.5} className="text-gold" />
          {t('wigYear')}
        </h2>
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {AREAS.map((a, i) => {
            const w = wigByArea.get(a);
            const s = SUBJECTS[a];
            return (
              <div
                key={a}
                className="card-fun card-fun-hover animate-pop p-5 text-center"
                style={{animationDelay: `${i * 60}ms`}}
              >
                <span
                  className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-2xl"
                  style={{background: s.soft, color: s.color}}
                >
                  <s.Icon size={24} strokeWidth={2.5} />
                </span>
                <div className="mb-3 font-fun text-sm font-bold text-navy">{tc(`areas.${a}`)}</div>
                {w ? (
                  <PlayRing pct={Number(w.pct ?? 0)} color={s.color} soft={s.soft} />
                ) : (
                  <div className="grid h-20 place-items-center text-xs font-semibold text-grey-mid">
                    {tc('noWig')}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* WIG tuần — sao thắng/thua theo màu môn */}
      <section>
        <h2 className="mb-4 flex items-center gap-2 font-fun text-lg font-bold text-navy">
          <Star size={20} strokeWidth={2.5} className="text-gold" fill="currentColor" />
          {t('wigWeek')}
        </h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {AREAS.map((a) => {
            const weeks = weeksByArea.get(a) ?? [];
            const wins = weeks.filter((w) => Number(w.pct ?? 0) >= 1).length;
            const s = SUBJECTS[a];
            return (
              <div key={a} className="card-fun p-5">
                <div className="flex items-center justify-between gap-2">
                  <span
                    className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-fun text-xs font-bold"
                    style={{background: s.soft, color: s.color}}
                  >
                    <s.Icon size={14} strokeWidth={2.5} />
                    {tc(`areas.${a}`)}
                  </span>
                  {weeks.length > 0 && (
                    <span className="font-fun text-lg font-bold" style={{color: s.color}}>
                      {wins}
                      <span className="text-sm text-grey-mid">/{weeks.length}</span>
                    </span>
                  )}
                </div>
                {weeks.length > 0 ? (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {weeks.slice(-10).map((w) => {
                      const won = Number(w.pct ?? 0) >= 1;
                      return (
                        <span key={w.wig_id} title={w.period_label ?? ''} className="inline-grid place-items-center">
                          <Star
                            size={26}
                            strokeWidth={2}
                            className={won ? 'text-gold' : 'text-grey-line'}
                            fill={won ? 'currentColor' : 'transparent'}
                          />
                        </span>
                      );
                    })}
                  </div>
                ) : (
                  <div className="mt-3 text-xs font-semibold text-grey-mid">{tc('noWeekWig')}</div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* Lead measure — tick hằng ngày, khoá 24h */}
      <section>
        <h2 className="mb-4 flex items-center gap-2 font-fun text-lg font-bold text-navy">
          <Star size={20} strokeWidth={2.5} className="text-gold" fill="currentColor" />
          {t('leads')}
        </h2>
        {tickerLeads.length === 0 ? (
          <p className="text-sm italic text-grey-mid">{t('noLeads')}</p>
        ) : (
          <LeadTicker leads={tickerLeads} studentId={studentId} canTick={canTick} />
        )}
      </section>

      {/* Họp WIG cá nhân Coach × Buddy */}
      <section>
        <h2 className="mb-4 flex items-center gap-2 font-fun text-lg font-bold text-navy">
          <Sparkles size={20} strokeWidth={2.5} className="text-gold" />
          {t('meetings')}
        </h2>
        <StudentMeetings
          studentId={studentId}
          classId={classId}
          meetings={meetings}
          classmates={classmates}
          canManage={canManage}
          defaultWeek={isoWeekLabel(new Date())}
          flash={flash}
        />
      </section>
    </div>
  );
}

import {getTranslations} from 'next-intl/server';
import {Users, CalendarClock} from 'lucide-react';
import {createClient} from '@/lib/supabase/server';
import {SubmitButton} from '@/components/ui/SubmitButton';
import {ConfirmButton} from '@/components/ui/ConfirmButton';
import {taoBuddyPair, goBuddyPair, luuLichBuddy, luuLichCoach} from '@/app/[locale]/(dashboard)/roster/buddy-actions';

// ════════════════════════════════════════════════════════════════════════════
// BUDDY & LỊCH PDR — khu của GVCN trên /roster (PRD v3, migration 0146)
// ════════════════════════════════════════════════════════════════════════════
//
// GVCN ghép cặp buddy (tối đa 2/em — trigger chặn), cài lịch họp buddy hằng tuần cho từng cặp,
// và lịch PDR 1-1 với giáo viên (một ngày cố định 1–28 hằng tháng cho từng em). Học sinh chỉ
// XEM các thứ này trên màn của mình — đăng ký/đổi cặp là nói với GVCN, đúng luật PRD.

const THU = [2, 3, 4, 5, 6, 7, 8];

export async function KhuBuddyPdr({
  classId,
  hocSinh,
}: {
  classId: string;
  /** Danh sách em đang học của lớp (id + tên hiển thị) — trang roster đã có sẵn. */
  hocSinh: {id: string; name: string}[];
}) {
  const t = await getTranslations('buddy');
  const supabase = await createClient();

  const [{data: capRows}, {data: lichRows}] = await Promise.all([
    supabase
      .from('buddy_pairs')
      .select('id, student_id, buddy_id')
      .eq('class_id', classId)
      .eq('is_active', true)
      .order('created_at'),
    supabase
      .from('pdr_schedules')
      .select('id, type, buddy_pair_id, student_id, weekday, time_slot, monthly_day')
      .eq('class_id', classId)
      .eq('is_active', true),
  ]);
  const cap = capRows ?? [];
  const lich = lichRows ?? [];
  const ten = new Map(hocSinh.map((h) => [h.id, h.name]));
  const lichCua = new Map(lich.filter((l) => l.type === 'buddy').map((l) => [l.buddy_pair_id, l]));
  const coachCua = new Map(lich.filter((l) => l.type === 'coach').map((l) => [l.student_id, l]));
  const nhanThu = (d: number | null) => (d === 8 ? 'CN' : d ? `T${d}` : '');
  const oNho =
    'h-9 rounded-[9px] border-[1.5px] border-navy/15 bg-white px-2 text-[12px] font-bold text-navy outline-none focus:border-navy';

  return (
    <section className="glass rounded-[20px] p-[18px]">
      <h2 className="mb-1 inline-flex items-center gap-1.5 font-display text-[16px] font-bold text-navy">
        <Users size={16} strokeWidth={2.2} className="text-gold-deep" />
        {t('title')}
      </h2>

      {/* Các cặp hiện có + lịch tuần của từng cặp */}
      <div className="mt-2 flex flex-col gap-2">
        {cap.length === 0 && <p className="text-[12.5px] italic text-grey-mid">{t('noPairs')}</p>}
        {cap.map((c) => {
          const l = lichCua.get(c.id);
          return (
            <div key={c.id} className="flex flex-wrap items-center gap-2 rounded-[12px] bg-navy/[0.035] p-2.5">
              <span className="min-w-0 text-[13px] font-extrabold text-navy">
                {ten.get(c.student_id) ?? '—'} ↔ {ten.get(c.buddy_id) ?? '—'}
              </span>
              <form action={luuLichBuddy} className="ml-auto flex items-center gap-1.5">
                <input type="hidden" name="class_id" value={classId} />
                <input type="hidden" name="pair_id" value={c.id} />
                <select name="weekday" defaultValue={l?.weekday ?? 6} className={`${oNho} cursor-pointer`} aria-label={t('weekday')}>
                  {THU.map((d) => (
                    <option key={d} value={d}>
                      {nhanThu(d)}
                    </option>
                  ))}
                </select>
                <input
                  type="time"
                  name="time_slot"
                  defaultValue={l?.time_slot ? String(l.time_slot).slice(0, 5) : ''}
                  className={`${oNho} w-24`}
                  aria-label={t('time')}
                />
                <SubmitButton className={`${oNho} cursor-pointer font-extrabold hover:border-navy`} wrapClass="contents">
                  {t('saveSchedule')}
                </SubmitButton>
              </form>
              <form action={goBuddyPair}>
                <input type="hidden" name="class_id" value={classId} />
                <input type="hidden" name="id" value={c.id} />
                <ConfirmButton
                  message={t('confirmUnpair', {a: ten.get(c.student_id) ?? '', b: ten.get(c.buddy_id) ?? ''})}
                  label={t('unpair')}
                  className="grid h-9 w-9 cursor-pointer place-items-center rounded-[9px] text-status-bad"
                >
                  ✕
                </ConfirmButton>
              </form>
            </div>
          );
        })}
      </div>

      {/* Ghép cặp mới */}
      <form action={taoBuddyPair} className="mt-3 flex flex-wrap items-center gap-2 border-t border-navy/[0.08] pt-3">
        <input type="hidden" name="class_id" value={classId} />
        <select name="em_a" defaultValue="" required className={`${oNho} min-w-[150px] cursor-pointer`} aria-label={t('studentA')}>
          <option value="" disabled>
            {t('studentA')}
          </option>
          {hocSinh.map((h) => (
            <option key={h.id} value={h.id}>
              {h.name}
            </option>
          ))}
        </select>
        <span className="text-[13px] font-extrabold text-grey-mid">↔</span>
        <select name="em_b" defaultValue="" required className={`${oNho} min-w-[150px] cursor-pointer`} aria-label={t('studentB')}>
          <option value="" disabled>
            {t('studentB')}
          </option>
          {hocSinh.map((h) => (
            <option key={h.id} value={h.id}>
              {h.name}
            </option>
          ))}
        </select>
        <SubmitButton className="btn-gold h-9 cursor-pointer rounded-[9px] px-3.5 text-[12.5px] font-extrabold" wrapClass="contents">
          {t('pair')}
        </SubmitButton>
      </form>

      {/* Lịch PDR 1-1 với giáo viên — mỗi em một ngày cố định hằng tháng */}
      <div className="mt-4 border-t border-navy/[0.08] pt-3">
        <h3 className="mb-2 inline-flex items-center gap-1.5 text-[13px] font-extrabold text-navy">
          <CalendarClock size={14} strokeWidth={2.2} className="text-gold-deep" />
          {t('coachTitle')}
        </h3>
        {coachCua.size > 0 && (
          <p className="mb-2 flex flex-wrap gap-1.5">
            {[...coachCua.values()].map((l) => (
              <span key={l.id} className="rounded-full bg-navy/[0.06] px-2.5 py-1 text-[11.5px] font-bold text-navy">
                {ten.get(l.student_id ?? '') ?? '—'} · {t('dayOfMonth', {d: l.monthly_day ?? 0})}
              </span>
            ))}
          </p>
        )}
        <form action={luuLichCoach} className="flex flex-wrap items-center gap-2">
          <input type="hidden" name="class_id" value={classId} />
          <select name="student_id" defaultValue="" required className={`${oNho} min-w-[150px] cursor-pointer`} aria-label={t('student')}>
            <option value="" disabled>
              {t('student')}
            </option>
            {hocSinh.map((h) => (
              <option key={h.id} value={h.id}>
                {h.name}
              </option>
            ))}
          </select>
          <select name="monthly_day" defaultValue="" required className={`${oNho} cursor-pointer`} aria-label={t('dayLabel')}>
            <option value="" disabled>
              {t('dayLabel')}
            </option>
            {Array.from({length: 28}, (_, i) => i + 1).map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
          <SubmitButton className={`${oNho} cursor-pointer font-extrabold hover:border-navy`} wrapClass="contents">
            {t('saveSchedule')}
          </SubmitButton>
        </form>
      </div>
    </section>
  );
}

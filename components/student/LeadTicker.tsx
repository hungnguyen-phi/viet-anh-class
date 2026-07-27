'use client';

import {useState} from 'react';
import {useRouter} from '@/i18n/navigation';
import {useTranslations} from 'next-intl';
import {Lock, Loader2} from 'lucide-react';
import {createClient} from '@/lib/supabase/client';

export type TickerLead = {
  id: string;
  title: string;
  target: number;
  unit: string | null;
  entries: {id: string; value: number; loggedDate: string; createdAt: string; mine: boolean}[];
};

const DOW_LABEL = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];

// Bảng tick hằng ngày.
//
// Đổi mô hình 2026-07-27: học sinh TỰ tick / gỡ tick / tick bù cho BẤT KỲ ngày trong tuần này —
// không phải xin ai. Đến ngày chốt của lớp (classes.tick_lock_dow) thì cả tuần khoá lại để buổi
// họp WIG đọc số liệu đã chốt. Trước đây chỉ sửa được đúng hôm nay, nên quên tick một hôm là phải
// làm đơn xin GVCN — thêm việc cho cả hai bên mà chẳng bảo vệ gì, vì tick là em tự khai.
//
// RLS lp_student_insert/update/delete (0046) là chốt cuối: trong tuần, không quá hôm nay, và
// tick_open(class) còn true. UI ở đây chỉ phản ánh lại cho khỏi bấm vô ích.
export function LeadTicker({
  leads,
  studentId,
  canTick,
  today,
  weekDays,
  tickOpen,
}: {
  leads: TickerLead[];
  studentId: string;
  canTick: boolean;
  // Ngày hôm nay theo GIỜ VN (app_today từ server).
  today: string;
  // 7 ngày của tuần hiện tại, Thứ Hai → Chủ Nhật, dạng 'YYYY-MM-DD'.
  weekDays: string[];
  // Tuần còn cho sửa không (theo ngày chốt của lớp).
  tickOpen: boolean;
}) {
  const t = useTranslations('student');
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null); // `${leadId}|${date}`
  const [err, setErr] = useState<string | null>(null);
  const [supabase] = useState(() => createClient());

  async function toggle(leadId: string, date: string, existingId: string | null) {
    const key = `${leadId}|${date}`;
    if (!canTick || !tickOpen || busy) return;
    setBusy(key);
    setErr(null);

    if (existingId) {
      const {error} = await supabase.from('lead_progress').delete().eq('id', existingId);
      setBusy(null);
      if (error) {
        setErr(t('undoError'));
        return;
      }
    } else {
      const {error} = await supabase.from('lead_progress').insert({
        lead_measure_id: leadId,
        student_id: studentId,
        logged_by: studentId,
        value: 1,
        logged_date: date,
      });
      setBusy(null);
      // 23505 = đã có tick ngày đó (unique 1 lần/ngày) → coi như xong, chỉ làm mới.
      if (error && error.code !== '23505') {
        setErr(t('tickError'));
        return;
      }
    }
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="glass overflow-hidden rounded-[20px]">
        {leads.map((l, i) => {
          const actual = l.entries.reduce((s, e) => s + e.value, 0);
          const pct = l.target > 0 ? Math.min(1, actual / l.target) : 0;
          const done = l.target > 0 && actual >= l.target;
          const shown = l.target > 0 ? Math.min(actual, l.target) : actual;
          // Tick CỦA MÌNH theo ngày → biết ngày nào đã tick và id nào để gỡ.
          const mineByDate = new Map(
            l.entries.filter((e) => e.mine).map((e) => [e.loggedDate, e.id]),
          );

          return (
            <div
              key={l.id}
              className={`flex flex-col gap-2 px-4 py-3.5 ${
                i < leads.length - 1 ? 'border-b border-navy/[0.08]' : ''
              }`}
            >
              <div className="flex items-center gap-2">
                <div className="flex min-w-0 flex-1 items-center gap-[7px]">
                  <div className="truncate text-[14.5px] font-extrabold text-navy">{l.title}</div>
                  {done && (
                    <span className="shrink-0 rounded-full border border-success/30 bg-success/[0.12] px-2 py-0.5 text-[10.5px] font-extrabold text-success">
                      {t('doneTag')}
                    </span>
                  )}
                </div>
                <span className="shrink-0 text-[12px] font-extrabold tabular-nums text-grey-mid">
                  {shown}/{l.target} {l.unit ?? ''}
                </span>
              </div>

              <div className="h-[9px] w-full overflow-hidden rounded-[5px] bg-navy/[0.08]">
                <div
                  className="h-full rounded-[5px] transition-[width] duration-500 ease-[cubic-bezier(0.16,1,0.3,1)]"
                  style={{
                    width: `${Math.round(pct * 100)}%`,
                    background: done ? 'var(--color-success)' : 'linear-gradient(to right,#ffe94d,#f9dd0e)',
                  }}
                />
              </div>

              {/* Dải 7 ngày của tuần: bấm để tick / bỏ tick. Ngày chưa tới thì tắt. */}
              {canTick && (
                <div className="flex flex-wrap items-center gap-1.5">
                  {weekDays.map((d, idx) => {
                    const entryId = mineByDate.get(d) ?? null;
                    const ticked = Boolean(entryId);
                    const future = d > today;
                    const disabled = !tickOpen || future || busy !== null;
                    const isToday = d === today;
                    return (
                      <button
                        key={d}
                        type="button"
                        onClick={() => toggle(l.id, d, entryId)}
                        disabled={disabled}
                        title={`${DOW_LABEL[idx]} ${d.slice(5)}`}
                        aria-label={`${DOW_LABEL[idx]} ${d.slice(5)}`}
                        aria-pressed={ticked}
                        className={`grid h-9 w-11 place-items-center rounded-[10px] border-[1.5px] text-[11px] font-extrabold transition-all ${
                          ticked
                            ? 'btn-gold border-transparent text-navy'
                            : 'border-navy/15 bg-white/60 text-navy/70'
                        } ${isToday && !ticked ? 'border-navy/45' : ''} ${
                          disabled ? 'cursor-default opacity-45' : 'cursor-pointer hover:border-navy'
                        }`}
                      >
                        {busy === `${l.id}|${d}` ? (
                          <Loader2 size={13} className="animate-spin" />
                        ) : (
                          DOW_LABEL[idx]
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {err && (
        <p className="rounded-lg bg-status-bad/10 px-3 py-1.5 text-xs font-bold text-status-bad">{err}</p>
      )}
      {canTick && (
        <p className="inline-flex items-center gap-1.5 text-xs italic text-grey-mid">
          <Lock size={12} strokeWidth={2.5} />
          {tickOpen ? t('tickWeekOpen') : t('tickWeekLocked')}
        </p>
      )}
    </div>
  );
}

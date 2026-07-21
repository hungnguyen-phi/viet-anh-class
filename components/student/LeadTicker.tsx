'use client';

import {useMemo, useState} from 'react';
import {useRouter} from '@/i18n/navigation';
import {useTranslations} from 'next-intl';
import {Star, Plus, Undo2, Lock, Loader2, PartyPopper} from 'lucide-react';
import {createClient} from '@/lib/supabase/client';

export type TickerLead = {
  id: string;
  title: string;
  target: number;
  unit: string | null;
  entries: {id: string; value: number; loggedDate: string; createdAt: string; mine: boolean}[];
};

// yyyy-mm-dd theo giờ máy người dùng (đủ tốt cho pip 7 ngày; nguồn chuẩn là logged_date từ DB).
function dayKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function LeadTicker({
  leads,
  studentId,
  canTick,
}: {
  leads: TickerLead[];
  studentId: string;
  canTick: boolean;
}) {
  const t = useTranslations('student');
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [supabase] = useState(() => createClient());

  // 7 ngày gần nhất (cũ → mới) cho dãy sao.
  const last7 = useMemo(() => {
    const days: string[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      days.push(dayKey(d));
    }
    return days;
  }, []);

  async function tick(leadId: string) {
    if (!canTick || busy) return;
    setBusy(leadId);
    // RLS lp_student_insert bắt buộc student_id = logged_by = auth.uid().
    await supabase.from('lead_progress').insert({
      lead_measure_id: leadId,
      student_id: studentId,
      logged_by: studentId,
      value: 1,
    });
    router.refresh();
    setBusy(null);
  }

  async function undo(leadId: string, entryId: string) {
    if (!canTick || busy) return;
    setBusy(leadId);
    // RLS lp_student_delete chỉ cho xoá bản ghi của mình < 24h — DB là chốt chặn cuối.
    await supabase.from('lead_progress').delete().eq('id', entryId);
    router.refresh();
    setBusy(null);
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        {leads.map((l) => {
          const actual = l.entries.reduce((s, e) => s + e.value, 0);
          const pct = l.target > 0 ? Math.min(1, actual / l.target) : 0;
          const done = l.target > 0 && actual >= l.target;
          const byDay = new Map<string, number>();
          for (const e of l.entries) {
            byDay.set(e.loggedDate, (byDay.get(e.loggedDate) ?? 0) + e.value);
          }
          // Bản ghi của mình còn trong cửa sổ 24h → được hoàn tác.
          const undoable = l.entries
            .filter((e) => e.mine && Date.now() - new Date(e.createdAt).getTime() < 24 * 3600_000)
            .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];

          return (
            <div
              key={l.id}
              className={`card-fun p-5 ${done ? 'ring-2 ring-success/40' : ''}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-fun text-base font-bold text-navy">{l.title}</div>
                  <div className="mt-0.5 text-sm text-grey-mid">
                    <b className="text-navy">{actual}</b>/{l.target} {l.unit ?? ''}
                  </div>
                </div>
                {done && (
                  <span className="animate-float inline-flex shrink-0 items-center gap-1 rounded-full bg-success/12 px-2.5 py-1 text-xs font-bold text-success">
                    <PartyPopper size={13} strokeWidth={2.5} />
                    {t('doneTag')}
                  </span>
                )}
              </div>

              {/* Thanh tiến độ tròn, dày, vui */}
              <div className="mt-3 h-3.5 w-full overflow-hidden rounded-full bg-grey-light">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    done ? 'bg-success' : 'bg-gold'
                  }`}
                  style={{width: `${Math.max(6, Math.round(pct * 100))}%`}}
                />
              </div>

              {/* 7 ngày gần nhất — sao vàng khi có tick */}
              <div className="mt-4 flex items-center justify-between gap-2">
                <div className="flex items-center gap-1">
                  {last7.map((d) => {
                    const v = byDay.get(d) ?? 0;
                    return (
                      <span key={d} title={`${d}: ${v}`} className="relative grid place-items-center">
                        <Star
                          size={22}
                          strokeWidth={2}
                          className={v > 0 ? 'text-gold' : 'text-grey-line'}
                          fill={v > 0 ? 'currentColor' : 'transparent'}
                        />
                        {v > 1 && (
                          <span className="absolute -bottom-1 -right-1 grid h-3.5 w-3.5 place-items-center rounded-full bg-navy text-[8px] font-bold text-white">
                            {v}
                          </span>
                        )}
                      </span>
                    );
                  })}
                </div>

                {canTick && (
                  <div className="flex shrink-0 items-center gap-1.5">
                    {undoable && (
                      <button
                        type="button"
                        onClick={() => undo(l.id, undoable.id)}
                        disabled={busy !== null}
                        title={t('undo')}
                        aria-label={t('undo')}
                        className="grid h-10 w-10 cursor-pointer place-items-center rounded-full border-2 border-grey-line text-grey-mid transition-colors hover:border-navy hover:text-navy disabled:opacity-50"
                      >
                        <Undo2 size={16} strokeWidth={2.5} />
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => tick(l.id)}
                      disabled={busy !== null}
                      className="inline-flex h-10 cursor-pointer items-center gap-1.5 rounded-full bg-navy px-4 font-fun text-sm font-bold text-white shadow-[0_4px_0_rgba(23,25,48,0.25)] transition-all hover:bg-navy-700 active:translate-y-0.5 active:shadow-[0_2px_0_rgba(23,25,48,0.25)] disabled:opacity-50"
                    >
                      {busy === l.id ? (
                        <Loader2 size={16} className="animate-spin" />
                      ) : (
                        <Plus size={16} strokeWidth={3} />
                      )}
                      {t('tickToday')}
                    </button>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <p className="inline-flex items-center gap-1.5 text-xs italic text-grey-mid">
        <Lock size={12} strokeWidth={2.5} />
        {t('lockedNote')}
      </p>
    </div>
  );
}

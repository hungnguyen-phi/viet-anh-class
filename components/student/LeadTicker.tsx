'use client';

import {useState} from 'react';
import {useRouter} from '@/i18n/navigation';
import {useTranslations} from 'next-intl';
import {Star, Undo2, Lock, Loader2} from 'lucide-react';
import {createClient} from '@/lib/supabase/client';

export type TickerLead = {
  id: string;
  title: string;
  target: number;
  unit: string | null;
  entries: {id: string; value: number; loggedDate: string; createdAt: string; mine: boolean}[];
};

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

  async function tick(leadId: string) {
    if (!canTick || busy) return;
    setBusy(leadId);
    // RLS lp_student_insert: student_id = logged_by = auth.uid().
    await supabase.from('lead_progress').insert({
      lead_measure_id: leadId,
      student_id: studentId,
      logged_by: studentId,
      value: 1,
    });
    router.refresh();
    setBusy(null);
  }

  async function undo(entryId: string) {
    if (!canTick || busy) return;
    setBusy(entryId);
    // RLS lp_student_delete chỉ cho xoá bản ghi của mình < 24h — DB là chốt cuối.
    await supabase.from('lead_progress').delete().eq('id', entryId);
    router.refresh();
    setBusy(null);
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="glass overflow-hidden rounded-[20px]">
        {leads.map((l, i) => {
          const actual = l.entries.reduce((s, e) => s + e.value, 0);
          const pct = l.target > 0 ? Math.min(1, actual / l.target) : 0;
          const done = l.target > 0 && actual >= l.target;
          // Bản ghi của mình còn trong cửa sổ 24h → được hoàn tác.
          const undoable = l.entries
            .filter((e) => e.mine && Date.now() - new Date(e.createdAt).getTime() < 24 * 3600_000)
            .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
          const ticked = Boolean(undoable);

          return (
            <div
              key={l.id}
              className={`flex items-center gap-3.5 px-4 py-3.5 ${
                i < leads.length - 1 ? 'border-b border-navy/[0.08]' : ''
              }`}
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-[7px]">
                  <div className="truncate text-[14.5px] font-extrabold text-navy">{l.title}</div>
                  {done && (
                    <span className="shrink-0 rounded-full border border-success/30 bg-success/[0.12] px-2 py-0.5 text-[10.5px] font-extrabold text-success">
                      {t('doneTag')}
                    </span>
                  )}
                </div>
                <div className="mt-2 flex items-center gap-2.5">
                  <div className="h-[9px] flex-1 overflow-hidden rounded-[5px] bg-navy/[0.08]">
                    <div
                      className="h-full rounded-[5px] transition-all"
                      style={{
                        width: `${Math.round(pct * 100)}%`,
                        background: done ? 'var(--color-success)' : 'linear-gradient(to right,#ffe94d,#f9dd0e)',
                      }}
                    />
                  </div>
                  <span className="shrink-0 text-[12px] font-extrabold text-grey-mid">
                    {actual}/{l.target} {l.unit ?? ''}
                  </span>
                </div>
              </div>

              {canTick && (
                <div className="flex shrink-0 items-center gap-1.5">
                  {undoable && (
                    <button
                      type="button"
                      onClick={() => undo(undoable.id)}
                      disabled={busy !== null}
                      title={t('undo')}
                      aria-label={t('undo')}
                      className="grid h-10 w-10 cursor-pointer place-items-center rounded-xl border-[1.5px] border-navy/20 text-navy/60 transition-colors hover:border-navy hover:text-navy disabled:opacity-50"
                    >
                      <Undo2 size={15} strokeWidth={2.5} />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => tick(l.id)}
                    disabled={busy !== null}
                    className={`inline-flex h-10 cursor-pointer items-center gap-1.5 rounded-xl px-3.5 font-display text-[13px] font-bold text-navy transition-all active:translate-y-[1.5px] disabled:opacity-50 ${
                      ticked
                        ? 'btn-gold border-[1.5px] border-transparent'
                        : 'border-[1.5px] border-navy/20 bg-white/50 hover:border-navy'
                    }`}
                  >
                    {busy === l.id ? (
                      <Loader2 size={15} className="animate-spin" />
                    ) : (
                      <Star size={16} strokeWidth={2} fill={ticked ? '#26275d' : 'transparent'} />
                    )}
                    {ticked ? t('ticked') : t('tickToday')}
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
      {canTick && (
        <p className="inline-flex items-center gap-1.5 text-xs italic text-grey-mid">
          <Lock size={12} strokeWidth={2.5} />
          {t('lockedNote')}
        </p>
      )}
    </div>
  );
}

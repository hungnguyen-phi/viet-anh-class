'use client';

import {useState} from 'react';
import {useRouter} from '@/i18n/navigation';
import {useTranslations} from 'next-intl';
import {Star, Lock, Loader2} from 'lucide-react';
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
  const [err, setErr] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null); // lead vừa tick → sao nảy + tô gold sớm
  const [supabase] = useState(() => createClient());

  async function tick(leadId: string) {
    if (!canTick || busy) return;
    setBusy(leadId);
    setErr(null);
    setFlash(leadId); // tô gold ngay (optimistic) — feedback tức thì
    // RLS lp_student_insert: student_id = logged_by = auth.uid().
    const {error} = await supabase.from('lead_progress').insert({
      lead_measure_id: leadId,
      student_id: studentId,
      logged_by: studentId,
      value: 1,
    });
    setBusy(null);
    // 23505 = đã tick hôm nay (unique 1 lần/ngày) → coi như xong, chỉ làm mới.
    if (error && error.code !== '23505') {
      setFlash(null); // lỗi thật → hoàn lại
      setErr(t('tickError'));
      return;
    }
    window.setTimeout(() => setFlash(null), 600); // giữ đủ để sao nảy xong, rồi server tiếp quản
    router.refresh();
  }

  async function undo(entryId: string) {
    if (!canTick || busy) return;
    setBusy(entryId);
    setErr(null);
    // RLS lp_student_delete chỉ cho xoá bản ghi của mình < 24h — DB là chốt cuối.
    const {error} = await supabase.from('lead_progress').delete().eq('id', entryId);
    setBusy(null);
    if (error) {
      setErr(t('undoError'));
      return;
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
          // Hiển thị không vượt mục tiêu: 5/5 chứ không phải 6/5.
          const shown = l.target > 0 ? Math.min(actual, l.target) : actual;
          // Bản ghi của mình còn trong cửa sổ 24h → được hoàn tác.
          const undoable = l.entries
            .filter((e) => e.mine && Date.now() - new Date(e.createdAt).getTime() < 24 * 3600_000)
            .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
          const ticked = Boolean(undoable);
          const flashing = flash === l.id; // vừa bấm tick → nảy sao + tô gold
          const goldLook = ticked || done || flashing;
          const locked = busy !== null || (done && !ticked); // đã đạt mục tiêu → khoá, không tick thêm
          const busyRow = busy === l.id || (undoable ? busy === undoable.id : false);

          return (
            <div
              key={l.id}
              className={`flex items-center gap-3.5 px-4 py-3.5 ${
                i < leads.length - 1 ? 'border-b border-navy/[0.08]' : ''
              }`}
            >
              <div className="min-w-0 flex-1">
                {/* Tiêu đề + nhãn Xong (trái) · số đếm (phải) — số đặt ở đây nên KHÔNG kéo dài thanh */}
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
                {/* Thanh đo — CHIỀU DÀI CỐ ĐỊNH (w-full), chỉ phần tô bên trong chạy */}
                <div className="mt-2 h-[9px] w-full overflow-hidden rounded-[5px] bg-navy/[0.08]">
                  <div
                    className="h-full rounded-[5px] transition-[width] duration-500 ease-[cubic-bezier(0.16,1,0.3,1)]"
                    style={{
                      width: `${Math.round(pct * 100)}%`,
                      background: done ? 'var(--color-success)' : 'linear-gradient(to right,#ffe94d,#f9dd0e)',
                    }}
                  />
                </div>
              </div>

              {/* MỘT nút gạt duy nhất, bề rộng cố định → thanh không đổi chiều dài.
                  Chưa tick: viền. Đã tick: gold (bấm để hoàn tác). Đã đạt mục tiêu: gold, khoá. */}
              {canTick && (
                <button
                  type="button"
                  onClick={() => (ticked ? undo(undoable.id) : tick(l.id))}
                  disabled={locked}
                  title={ticked ? t('undo') : undefined}
                  aria-label={ticked ? t('undo') : t('tickToday')}
                  className={`inline-flex h-11 w-[112px] shrink-0 items-center justify-center gap-1.5 rounded-xl font-display text-[13px] font-bold text-navy transition-all active:translate-y-[1.5px] disabled:opacity-60 ${
                    goldLook
                      ? 'btn-gold border-[1.5px] border-transparent'
                      : 'border-[1.5px] border-navy/20 bg-white/50 hover:border-navy'
                  } ${locked ? 'cursor-default' : 'cursor-pointer'}`}
                >
                  {busyRow ? (
                    <Loader2 size={15} className="animate-spin" />
                  ) : (
                    <Star
                      size={16}
                      strokeWidth={2}
                      className={flashing ? 'animate-tick' : undefined}
                      fill={goldLook ? '#26275d' : 'transparent'}
                    />
                  )}
                  {ticked || flashing ? t('ticked') : done ? t('doneTag') : t('tickToday')}
                </button>
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
          {t('lockedNote')}
        </p>
      )}
    </div>
  );
}

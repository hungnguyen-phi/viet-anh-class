'use client';

import {useOptimistic, useState, useTransition} from 'react';
import {useRouter} from '@/i18n/navigation';
import {useTranslations} from 'next-intl';
import {Check, Flame, Lock, Users} from 'lucide-react';
import {createClient} from '@/lib/supabase/client';

export type TickerLead = {
  id: string;
  title: string;
  target: number;
  unit: string | null;
  // 'class' = việc CHUNG của lớp — mỗi lượt tick của mọi bạn cộng vào cùng một bộ đếm, và chính
  // bộ đếm đó quyết định WIG tuần của lớp thắng hay thua (0073).
  // 'mine'  = việc riêng của em, chỉ tính cho WIG cá nhân.
  kind: 'class' | 'mine';
  // Những NGÀY trong tuần này mà việc này được tick — đã lọc theo `active_weekdays` của lead
  // measure, nên bảng không còn bày ra T7/CN cho một việc chỉ làm ngày đi học.
  days: string[];
  // Ngày chính em đã tick.
  myDates: string[];
  // Chỉ có ở việc chung: tổng cả lớp đã góp, và bao nhiêu bạn đã góp.
  classTotal: number | null;
  contributors: number | null;
  classSize: number | null;
};

type Action = {leadId: string; date: string; on: boolean};

// Bảng tick hằng ngày của học sinh.
//
// Viết lại 2026-08-02 (0073) vì hai lý do:
//
// 1. NGUỒN SỐ LIỆU. Trước đây bảng này chỉ chứa việc của WIG CÁ NHÂN, còn WIG của lớp thì giáo
//    viên tự bấm "Ghi +" để cộng số. Nay em tick thẳng vào việc chung của lớp, nên cái em bấm ở
//    đây CHÍNH LÀ con số quyết định lớp thắng hay thua tuần này — và bảng phải nói được điều đó,
//    nếu không thì em vẫn tưởng mình đang tự chấm điểm cho riêng mình.
//
// 2. ĐÂY LÀ VIỆC HẰNG NGÀY. Bản cũ đưa ra một dải 7 ô T2…CN như nhau cho mọi việc, không phân
//    biệt hôm nay là ô nào, và mỗi lần bấm phải chờ trọn một vòng máy chủ mới thấy ô đổi màu.
//    Bản này: khối "Hôm nay" nằm trên cùng để việc thường ngày chỉ còn MỘT chạm, ô đổi màu ngay
//    lập tức (useOptimistic), và có chuỗi ngày liên tiếp 🔥 để em thấy công mình đang dài ra.
//
// Luật khoá vẫn nguyên: RLS (0046/0048/0073) là chốt cuối — trong tuần, không quá hôm nay, tuần
// chưa chốt, và đúng thứ mà việc đó áp dụng. Giao diện chỉ phản ánh lại cho khỏi bấm vô ích.
export function LeadTicker({
  leads,
  studentId,
  canTick,
  today,
  tickOpen,
}: {
  leads: TickerLead[];
  studentId: string;
  canTick: boolean;
  // Hôm nay theo GIỜ VN.
  today: string;
  // Tuần còn cho sửa không (theo ngày chốt của lớp).
  tickOpen: boolean;
}) {
  const t = useTranslations('student');
  const router = useRouter();
  const [err, setErr] = useState<string | null>(null);
  const [supabase] = useState(() => createClient());
  const [, startTransition] = useTransition();

  // Đổi màu NGAY khi bấm, không chờ máy chủ. Với một việc làm mỗi ngày thì độ trễ 200–400 ms mỗi
  // lượt là thứ cảm nhận được — và cảm giác "bấm mà không thấy gì" khiến người ta bấm lại lần nữa.
  // useOptimistic tự hoàn tác nếu transition kết thúc mà dữ liệu thật không đổi.
  const [view, apply] = useOptimistic(leads, (state: TickerLead[], a: Action) =>
    state.map((l) => {
      if (l.id !== a.leadId) return l;
      const set = new Set(l.myDates);
      if (a.on) set.add(a.date);
      else set.delete(a.date);
      return {
        ...l,
        myDates: [...set].sort(),
        // Tổng của lớp cũng nhích theo — nếu không thì em bấm xong thấy ô mình sáng lên mà tỷ số
        // chung đứng yên, tưởng lượt tick của mình không được tính.
        classTotal: l.classTotal === null ? null : l.classTotal + (a.on ? 1 : -1),
      };
    }),
  );

  const dayShort = t.raw('dayShort') as string[];
  const isoDow = (d: string) => {
    const n = new Date(`${d}T00:00:00Z`).getUTCDay();
    return n === 0 ? 7 : n;
  };

  function toggle(lead: TickerLead, date: string) {
    if (!canTick || !tickOpen || date > today) return;
    const on = !lead.myDates.includes(date);
    setErr(null);
    startTransition(async () => {
      apply({leadId: lead.id, date, on});
      if (on) {
        const {error} = await supabase.from('lead_progress').insert({
          lead_measure_id: lead.id,
          student_id: studentId,
          logged_by: studentId,
          value: 1,
          logged_date: date,
        });
        // 23505 = đã có tick ngày đó (chỉ mục duy nhất 1 lượt/ngày) → coi như xong.
        if (error && error.code !== '23505') {
          setErr(t('tickError'));
          return;
        }
      } else {
        // Xoá theo (việc, em, ngày) chứ không theo id dòng: chỉ mục uq_lead_progress_daily bảo
        // đảm nhiều nhất một dòng, nên không cần mang id của từng dòng xuống trình duyệt.
        const {error} = await supabase
          .from('lead_progress')
          .delete()
          .eq('lead_measure_id', lead.id)
          .eq('student_id', studentId)
          .eq('logged_date', date);
        if (error) {
          setErr(t('undoError'));
          return;
        }
      }
      router.refresh();
    });
  }

  // Chuỗi ngày liên tiếp tính ngược từ ngày áp dụng gần nhất (không tính ngày chưa tới).
  const streakOf = (l: TickerLead) => {
    const past = l.days.filter((d) => d <= today);
    const set = new Set(l.myDates);
    let n = 0;
    for (let i = past.length - 1; i >= 0; i--) {
      if (!set.has(past[i])) break;
      n += 1;
    }
    return n;
  };

  const classLeads = view.filter((l) => l.kind === 'class');
  const myLeads = view.filter((l) => l.kind === 'mine');
  // Việc của HÔM NAY — chỉ những việc mà hôm nay đúng là thứ áp dụng.
  const todayLeads = view.filter((l) => l.days.includes(today));
  const todayLeft = todayLeads.filter((l) => !l.myDates.includes(today));

  // ---- Một việc: tiến độ + dải ngày ----
  const leadCard = (l: TickerLead) => {
    const mine = l.myDates.length;
    const total = l.classTotal ?? mine;
    const pct = l.target > 0 ? Math.min(1, total / l.target) : 0;
    const done = l.target > 0 && total >= l.target;
    const streak = streakOf(l);
    const left = Math.max(0, l.target - total);

    return (
      <div key={l.id} className="rounded-[16px] border-[1.5px] border-navy/10 bg-white p-3.5">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="min-w-0 flex-1 truncate text-[14.5px] font-extrabold text-navy">
            {l.title}
          </span>
          {streak >= 2 && (
            <span
              title={t('streakHint')}
              className="inline-flex shrink-0 items-center gap-1 rounded-full bg-gold/25 px-2 py-0.5 text-[11px] font-extrabold text-navy"
            >
              <Flame size={12} strokeWidth={2.5} />
              {streak}
            </span>
          )}
          {done && (
            <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-success/30 bg-success/[0.12] px-2 py-0.5 text-[10.5px] font-extrabold text-success">
              <Check size={11} strokeWidth={3} />
              {t('doneTag')}
            </span>
          )}
          <span className="shrink-0 text-[12.5px] font-extrabold tabular-nums text-grey-mid">
            {Math.min(total, l.target)}/{l.target} {l.unit ?? ''}
          </span>
        </div>

        <div className="mt-2 h-[10px] w-full overflow-hidden rounded-[5px] bg-navy/[0.08]">
          <div
            className="h-full rounded-[5px] transition-[width] duration-500 ease-[cubic-bezier(0.16,1,0.3,1)]"
            style={{
              width: `${Math.round(pct * 100)}%`,
              background: done ? 'var(--color-success)' : 'linear-gradient(to right,#ffe94d,#f9dd0e)',
            }}
          />
        </div>

        {/* Dòng ý nghĩa: việc chung thì nói bằng tiếng của cả đội, việc riêng thì của em. */}
        <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11.5px] font-semibold text-grey-mid">
          {l.kind === 'class' ? (
            <>
              <span className="inline-flex items-center gap-1">
                <Users size={12} strokeWidth={2.5} />
                {t('classContrib', {n: l.contributors ?? 0, total: l.classSize ?? 0})}
              </span>
              <span>· {t('myContrib', {n: mine})}</span>
            </>
          ) : (
            <span>{t('myContrib', {n: mine})}</span>
          )}
          {/* Việc chung thì đích là của CẢ LỚP, việc riêng thì của em — không dùng chung một câu,
              nếu không thì mục tiêu cá nhân lại hiện "còn 5 nữa là lớp thắng". */}
          {!done && left > 0 && (
            <span className="ml-auto font-bold text-navy/70">
              {l.kind === 'class' ? t('remaining', {n: left}) : t('remainingMine', {n: left})}
            </span>
          )}
        </div>

        {/* Dải ngày — chỉ những thứ mà việc này áp dụng. Ô 44px: đây là màn của học sinh, và
            các em bấm bằng ngón tay trên máy tính bảng (WCAG 2.5.5 mức AAA). */}
        <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
          {l.days.map((d) => {
            const ticked = l.myDates.includes(d);
            const future = d > today;
            const isToday = d === today;
            const disabled = !canTick || !tickOpen || future;
            return (
              <button
                key={d}
                type="button"
                onClick={() => toggle(l, d)}
                disabled={disabled}
                title={`${dayShort[isoDow(d) - 1]} ${d.slice(5)}`}
                aria-label={`${l.title} — ${dayShort[isoDow(d) - 1]} ${d.slice(5)}`}
                aria-pressed={ticked}
                className={`relative grid h-11 w-11 place-items-center rounded-[12px] border-[1.5px] text-[11.5px] font-extrabold transition-all ${
                  ticked
                    ? 'border-transparent bg-gold text-navy shadow-[var(--shadow-gold)]'
                    : 'border-navy/15 bg-white text-navy/60'
                } ${isToday && !ticked ? 'border-navy ring-2 ring-navy/15' : ''} ${
                  disabled ? 'cursor-default opacity-45' : 'cursor-pointer hover:border-navy active:scale-95'
                }`}
              >
                {/* Ô đã tick vẫn GIỮ tên thứ, dấu ✓ là huy hiệu góc. Bản đầu thay hẳn tên thứ
                    bằng dấu ✓ — nhìn dải "✓ ✓ T6 T7 CN" thì không đọc ra hai ô vàng là thứ mấy,
                    mà tick bù đúng ngày lại chính là việc hay làm nhất ở dải này. */}
                {dayShort[isoDow(d) - 1]}
                {ticked && (
                  <span className="absolute -right-1 -top-1 grid h-[18px] w-[18px] place-items-center rounded-full bg-navy text-white">
                    <Check size={11} strokeWidth={3.5} />
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col gap-3.5">
      {/* ---- HÔM NAY: việc thường ngày, một chạm ---- */}
      {canTick && todayLeads.length > 0 && (
        <div className="glass rounded-[20px] p-4">
          <div className="mb-2.5 flex flex-wrap items-center gap-2">
            <span className="font-display text-[15px] font-bold text-navy">{t('todayTitle')}</span>
            <span className="rounded-full bg-navy/[0.06] px-2.5 py-0.5 text-[11px] font-bold text-grey-mid">
              {dayShort[isoDow(today) - 1]} · {today.slice(5)}
            </span>
            {todayLeft.length === 0 && (
              <span className="ml-auto inline-flex items-center gap-1 rounded-full border border-success/30 bg-success/[0.12] px-2.5 py-1 text-[11px] font-extrabold text-success">
                <Check size={12} strokeWidth={3} />
                {t('todayAllDone')}
              </span>
            )}
          </div>
          <div className="flex flex-col gap-2">
            {todayLeads.map((l) => {
              const ticked = l.myDates.includes(today);
              return (
                <button
                  key={l.id}
                  type="button"
                  onClick={() => toggle(l, today)}
                  disabled={!tickOpen}
                  aria-pressed={ticked}
                  className={`flex min-h-[56px] w-full items-center gap-3 rounded-[14px] border-[1.5px] px-3.5 py-2.5 text-left transition-all ${
                    ticked
                      ? 'border-transparent bg-gold/25'
                      : 'border-navy/15 bg-white hover:border-navy'
                  } ${tickOpen ? 'cursor-pointer active:scale-[0.99]' : 'cursor-default opacity-60'}`}
                >
                  <span
                    className={`grid h-8 w-8 shrink-0 place-items-center rounded-full border-2 transition-all ${
                      ticked ? 'border-transparent bg-gold text-navy' : 'border-navy/20 text-transparent'
                    }`}
                  >
                    <Check size={17} strokeWidth={3.5} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[14px] font-extrabold text-navy">{l.title}</span>
                    <span className="block text-[11.5px] font-semibold text-grey-mid">
                      {l.kind === 'class' ? t('classWork') : t('myWork')}
                    </span>
                  </span>
                  {ticked && (
                    <span className="shrink-0 text-[11.5px] font-extrabold text-navy/70">
                      {t('tickedToday')}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* ---- VIỆC CHUNG CỦA LỚP ---- */}
      {classLeads.length > 0 && (
        <section className="flex flex-col gap-2">
          <div className="flex flex-wrap items-baseline gap-x-2">
            <h3 className="font-display text-[15px] font-bold text-navy">{t('classLeadsTitle')}</h3>
            <span className="text-[11.5px] font-semibold text-grey-mid">{t('classLeadsHint')}</span>
          </div>
          {classLeads.map(leadCard)}
        </section>
      )}

      {/* ---- VIỆC RIÊNG CỦA EM ---- */}
      {myLeads.length > 0 && (
        <section className="flex flex-col gap-2">
          <div className="flex flex-wrap items-baseline gap-x-2">
            <h3 className="font-display text-[15px] font-bold text-navy">{t('myLeadsTitle')}</h3>
            <span className="text-[11.5px] font-semibold text-grey-mid">{t('myLeadsHint')}</span>
          </div>
          {myLeads.map(leadCard)}
        </section>
      )}

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

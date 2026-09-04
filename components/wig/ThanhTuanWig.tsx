'use client';

// THANH TUẦN GỌN cho /wig — một hàng: ‹ · W36 · 31/08 → 06/09 · TUẦN NÀY · › (đúng kiểu màn của em).
// Trước đây ba nút to chiếm 3 hàng ở 360 px (audit 04/09). Đổi tuần = đổi ?week= và GIỮ ?class=
// (admin đang xem lớp khác không bị văng về lớp mặc định). Có vòng xoay lúc chờ máy chủ.
import {useTransition} from 'react';
import {useTranslations} from 'next-intl';
import {ChevronLeft, ChevronRight, Loader2, RotateCcw} from 'lucide-react';
import {useRouter} from '@/i18n/navigation';
import {ngayVN, shiftWeeks} from '@/lib/dates';

export function ThanhTuanWig({
  monday,
  thisMonday,
  label,
  start,
  end,
  classParam,
}: {
  monday: string;
  thisMonday: string;
  label: string;
  start: string;
  end: string;
  classParam?: string;
}) {
  const t = useTranslations('tuan');
  const router = useRouter();
  const [dangTai, batDau] = useTransition();
  const di = (m: string) =>
    batDau(() =>
      router.push({
        pathname: '/wig',
        query: {...(classParam ? {class: classParam} : {}), ...(m === thisMonday ? {} : {week: m})},
      } as Parameters<typeof router.push>[0]),
    );
  const khi = monday === thisMonday ? 'now' : monday < thisMonday ? 'past' : 'future';
  const nut =
    'grid h-11 w-11 shrink-0 cursor-pointer place-items-center rounded-[10px] border-[1.5px] border-navy/20 bg-white text-navy transition-all hover:border-navy focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold disabled:cursor-wait disabled:opacity-60';

  return (
    <div className="flex items-center gap-2" aria-busy={dangTai || undefined}>
      <button type="button" onClick={() => di(shiftWeeks(monday, -1))} className={nut} aria-label={t('weekPrev')} disabled={dangTai}>
        <ChevronLeft size={16} strokeWidth={2.5} />
      </button>
      <div className="flex min-w-0 flex-1 flex-wrap items-baseline justify-center gap-x-2 gap-y-0.5 text-center">
        <span className="font-display text-[16px] font-bold leading-none text-navy">{label}</span>
        <span className="text-[12.5px] font-bold tabular-nums text-grey-mid">
          {ngayVN(start).slice(0, 5)} → {ngayVN(end).slice(0, 5)}
        </span>
        {khi === 'now' ? (
          <span className="rounded-full bg-gold/25 px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wide text-gold-text">{t('weekNow')}</span>
        ) : (
          <button
            type="button"
            onClick={() => di(thisMonday)}
            disabled={dangTai}
            className="inline-flex min-h-[28px] cursor-pointer items-center gap-1 rounded-full border-[1.5px] border-navy/15 px-2 text-[10.5px] font-extrabold uppercase tracking-wide text-grey-mid hover:border-navy focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold"
          >
            <RotateCcw size={10} strokeWidth={2.5} />
            {khi === 'past' ? t('weekPast') : t('weekFuture')} · {t('weekNow')}
          </button>
        )}
        {dangTai && <Loader2 size={14} className="animate-spin text-grey-mid" />}
      </div>
      <button type="button" onClick={() => di(shiftWeeks(monday, 1))} className={nut} aria-label={t('weekNext')} disabled={dangTai}>
        <ChevronRight size={16} strokeWidth={2.5} />
      </button>
    </div>
  );
}

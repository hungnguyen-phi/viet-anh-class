'use client';

import {useTransition} from 'react';
import {useTranslations} from 'next-intl';
import {ChevronLeft, ChevronRight, Loader2, RotateCcw} from 'lucide-react';
import {useRouter} from '@/i18n/navigation';
import {btnGhost} from '@/components/ui/Field';
import {LichVN} from '@/components/ui/LichVN';
import {mondayOf, ngayVN, shiftWeeks} from '@/lib/dates';

// THANH TUẦN TRÊN MÀN CỦA EM — ← tuần trước · W33 · 10/08 → 16/08 · tuần sau → · lịch.
//
// Chủ dự án 16/08/2026: "có nút Tuần trước, tuần sau, chọn lịch để xem, chứ ko phải chỉ hiện mỗi
// hiện tại". Đổi tuần là đổi ?week= trên cùng đường dẫn; mọi khối dưới (cam kết, việc, tick) đọc
// theo tuần ấy. Tuần đang chạy thì không mang ?week= — địa chỉ mặc định luôn là hôm nay.
export function ChonTuanCuaEm({
  pathname,
  monday,
  thisMonday,
  label,
  start,
  end,
}: {
  pathname: string;
  monday: string;
  thisMonday: string;
  label: string;
  start: string;
  end: string;
}) {
  // Namespace 'wig' đã gỡ khỏi client (PA2 §A) — nhãn thanh tuần chuyển sang 'tuan' (F1),
  // cùng chỗ với các chuỗi tuần học/nghỉ/thi. Khoá weekPrev/weekNow/… giữ nguyên tên.
  const t = useTranslations('tuan');
  const router = useRouter();
  const [dangTai, batDau] = useTransition();
  const di = (m: string) =>
    batDau(() =>
      router.push({pathname, query: m === thisMonday ? {} : {week: m}} as Parameters<typeof router.push>[0]),
    );
  const khi = monday === thisMonday ? 'now' : monday < thisMonday ? 'past' : 'future';

  return (
    <div data-hd="tuan" className="sticky top-[var(--h-nav,76px)] z-10 -mx-4 flex items-center gap-2 bg-[rgba(247,247,251,0.92)] px-4 py-1.5 backdrop-blur-md sm:static sm:mx-0 sm:bg-transparent sm:px-0 sm:py-0 sm:backdrop-blur-none">
      <button
        type="button"
        onClick={() => di(shiftWeeks(monday, -1))}
        className={`${btnGhost} h-11 w-11 shrink-0 !px-0 ${dangTai ? 'cursor-wait opacity-60' : ''}`}
        aria-label={t('weekPrev')}
        disabled={dangTai}
      >
        <ChevronLeft size={16} strokeWidth={2.5} />
      </button>
      <div className="flex min-w-0 flex-1 flex-wrap items-baseline justify-center gap-x-2 gap-y-0.5 text-center">
        <span className="font-display text-doc font-bold leading-none text-navy">{label}</span>
        <span className="text-than font-bold tabular-nums text-grey-mid">
          {ngayVN(start).slice(0, 5)} → {ngayVN(end).slice(0, 5)}
        </span>
        {khi === 'now' ? (
          <span className="rounded-full bg-gold/25 px-2 py-0.5 text-nhan font-extrabold uppercase tracking-wide text-gold-text">{t('weekNow')}</span>
        ) : (
          <button
            type="button"
            onClick={() => di(thisMonday)}
            disabled={dangTai}
            className="cham-44 inline-flex min-h-[28px] cursor-pointer items-center gap-1 rounded-full border-[1.5px] border-navy/15 px-2.5 text-nhan font-extrabold uppercase tracking-wide text-grey-mid hover:border-navy focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold"
          >
            <RotateCcw size={12} strokeWidth={2.5} />
            {khi === 'past' ? t('weekPast') : t('weekFuture')} · {t('weekNow')}
          </button>
        )}
        {dangTai && <Loader2 size={14} className="animate-spin text-grey-mid" />}
      </div>
      <button
        type="button"
        onClick={() => di(shiftWeeks(monday, 1))}
        className={`${btnGhost} h-11 w-11 shrink-0 !px-0 ${dangTai ? 'cursor-wait opacity-60' : ''}`}
        aria-label={t('weekNext')}
        disabled={dangTai}
      >
        <ChevronRight size={16} strokeWidth={2.5} />
      </button>
      <LichVN value={monday} nhan={t('weekPick')} onChange={(iso) => iso && di(mondayOf(iso))} className="hidden sm:block" />
    </div>
  );
}

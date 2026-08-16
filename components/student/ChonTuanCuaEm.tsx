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
  const t = useTranslations('wig');
  const router = useRouter();
  const [dangTai, batDau] = useTransition();
  const di = (m: string) =>
    batDau(() =>
      router.push({pathname, query: m === thisMonday ? {} : {week: m}} as Parameters<typeof router.push>[0]),
    );
  const nut = `${btnGhost} shrink-0 ${dangTai ? 'cursor-wait opacity-60' : ''}`;
  const khi = monday === thisMonday ? 'now' : monday < thisMonday ? 'past' : 'future';

  return (
    <div className="glass flex flex-wrap items-center justify-center gap-2 rounded-[20px] p-3">
      <button type="button" onClick={() => di(shiftWeeks(monday, -1))} className={nut} aria-label={t('weekPrev')} disabled={dangTai}>
        <ChevronLeft size={16} strokeWidth={2.5} />
        {t('weekPrev')}
      </button>
      <div className="flex min-w-0 flex-1 flex-col items-center px-1 text-center">
        <span className="flex items-center gap-2 font-display text-[15px] font-bold text-navy">
          {label}
          {dangTai && <Loader2 size={14} className="animate-spin text-grey-mid" />}
          {khi !== 'now' && (
            <span className="rounded-full border-[1.5px] border-navy/15 bg-navy/[0.06] px-2 py-0.5 text-[10.5px] font-extrabold text-grey-mid">
              {khi === 'past' ? t('weekPast') : t('weekFuture')}
            </span>
          )}
        </span>
        <span className="text-[12px] font-bold tabular-nums text-grey-mid">
          {ngayVN(start).slice(0, 5)} → {ngayVN(end).slice(0, 5)}
        </span>
      </div>
      <button type="button" onClick={() => di(shiftWeeks(monday, 1))} className={nut} aria-label={t('weekNext')} disabled={dangTai}>
        {t('weekNext')}
        <ChevronRight size={16} strokeWidth={2.5} />
      </button>
      <LichVN value={monday} nhan={t('weekPick')} onChange={(iso) => iso && di(mondayOf(iso))} />
      {khi !== 'now' && (
        <button type="button" onClick={() => di(thisMonday)} className={nut} disabled={dangTai}>
          <RotateCcw size={13} strokeWidth={2.5} />
          {t('weekNow')}
        </button>
      )}
    </div>
  );
}

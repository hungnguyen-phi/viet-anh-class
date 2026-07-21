'use client';

import {useRouter, usePathname} from '@/i18n/navigation';

// Bộ lọc tuần cho báo cáo phụ huynh — đổi ?week= giữ nguyên trang.
export function WeekPicker({
  weeks,
  current,
  label,
}: {
  weeks: string[];
  current: string;
  label: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  if (weeks.length === 0) return null;

  return (
    <div className="flex flex-col items-end gap-2">
      <span className="text-[10px] font-extrabold uppercase tracking-wide text-grey-mid">
        {label}
      </span>
      <div className="flex flex-wrap justify-end gap-1.5">
        {weeks.map((w) => {
          const active = w === current;
          return (
            <button
              key={w}
              type="button"
              onClick={() => router.push(`${pathname}?week=${encodeURIComponent(w)}`)}
              className={`inline-flex h-8 cursor-pointer items-center rounded-[10px] px-3 text-xs font-extrabold whitespace-nowrap text-navy transition-all ${
                active
                  ? 'btn-gold border border-transparent'
                  : 'border-[1.5px] border-navy/20 bg-white/60 hover:border-navy'
              }`}
            >
              {w}
            </button>
          );
        })}
      </div>
    </div>
  );
}

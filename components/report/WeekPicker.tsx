'use client';

import {useRouter, usePathname} from '@/i18n/navigation';
import {CalendarRange} from 'lucide-react';

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
    <label className="inline-flex items-center gap-2 rounded-xl bg-white/10 px-3 py-2 ring-1 ring-white/25 backdrop-blur-sm">
      <CalendarRange size={16} strokeWidth={2} className="text-gold" />
      <span className="text-xs font-semibold text-white/80">{label}</span>
      <select
        value={current}
        onChange={(e) => router.push(`${pathname}?week=${encodeURIComponent(e.target.value)}`)}
        className="cursor-pointer rounded-lg border-0 bg-transparent text-sm font-bold text-white outline-none [&>option]:text-navy"
      >
        {weeks.map((w) => (
          <option key={w} value={w}>
            {w}
          </option>
        ))}
      </select>
    </label>
  );
}

'use client';

import {ChevronDown} from 'lucide-react';
import {useRouter, usePathname} from '@/i18n/navigation';
import type {ClassOption} from '@/lib/queries';

// Bộ chọn lớp cho admin/BGH (và GVCN nhiều lớp) — đổi lớp đang xem qua ?class=.
export function ClassPicker({
  classes,
  current,
}: {
  classes: ClassOption[];
  current?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  if (classes.length <= 1) return null;

  return (
    <div className="relative inline-flex items-center">
      <select
        value={current ?? ''}
        onChange={(e) => router.push(`${pathname}?class=${e.target.value}`)}
        className="glass-pill cursor-pointer appearance-none rounded-full py-2 pl-4 pr-9 text-sm font-bold text-navy outline-none transition-all hover:bg-white/70 focus:border-navy"
      >
        {classes.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name} · {c.school_year}
          </option>
        ))}
      </select>
      <ChevronDown
        size={16}
        strokeWidth={2.5}
        className="pointer-events-none absolute right-3 text-navy/60"
      />
    </div>
  );
}

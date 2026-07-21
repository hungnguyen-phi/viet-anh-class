'use client';

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
    <select
      value={current ?? ''}
      onChange={(e) => router.push(`${pathname}?class=${e.target.value}`)}
      className="cursor-pointer rounded-lg border border-grey-line bg-white px-3 py-2 text-sm font-semibold text-navy shadow-card transition-all hover:border-line-strong hover:shadow-raise focus:border-navy"
    >
      {classes.map((c) => (
        <option key={c.id} value={c.id}>
          {c.name} · {c.school_year}
        </option>
      ))}
    </select>
  );
}

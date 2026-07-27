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

  // Gom theo KHỐI: BGH của một cơ sở có thể có vài chục lớp, danh sách phẳng thì phải dò từng
  // dòng. <optgroup> cho ra đúng thao tác "khối nào → lớp nào" ngay trong một ô chọn, không cần
  // thêm bộ lọc riêng. `classes` đã được sắp theo (khối, tên) từ getAccessibleClasses nên Map
  // giữ đúng thứ tự chèn.
  const byGrade = new Map<string, ClassOption[]>();
  for (const c of classes) {
    const list = byGrade.get(c.grade_name);
    if (list) list.push(c);
    else byGrade.set(c.grade_name, [c]);
  }
  // Chỉ một khối thì optgroup là nhiễu — hiện phẳng như cũ.
  const grouped = byGrade.size > 1;

  return (
    <div className="relative inline-flex items-center">
      <select
        value={current ?? ''}
                aria-label="Chọn lớp"
        onChange={(e) => router.push(`${pathname}?class=${e.target.value}`)}
        className="glass-pill cursor-pointer appearance-none rounded-full py-2 pl-4 pr-9 text-sm font-bold text-navy outline-none transition-all hover:bg-white/70 focus:border-navy"
      >
        {grouped
          ? [...byGrade.entries()].map(([gradeName, list]) => (
              <optgroup key={gradeName} label={gradeName}>
                {list.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} · {c.school_year}
                  </option>
                ))}
              </optgroup>
            ))
          : classes.map((c) => (
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

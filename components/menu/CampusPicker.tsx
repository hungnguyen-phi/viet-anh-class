'use client';

import {ChevronDown} from 'lucide-react';
import {useRouter, usePathname} from '@/i18n/navigation';

// Bộ chọn CƠ SỞ — chỉ quản trị viên mới thấy (xem comment ở /menu/page.tsx).
// Dùng lại nguyên hình thức của ClassPicker để hai ô chọn đứng cạnh nhau không lệch nhau.
export function CampusPicker({
  campuses,
  current,
}: {
  campuses: {id: string; name: string}[];
  current?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  // Một cơ sở thì ô chọn chỉ là nhiễu.
  if (campuses.length <= 1) return null;

  return (
    <div className="relative inline-flex items-center">
      <select
        value={current ?? ''}
        aria-label="Chọn cơ sở"
        onChange={(e) => router.push(`${pathname}?campus=${e.target.value}`)}
        className="glass-pill cursor-pointer appearance-none rounded-full py-2 pl-4 pr-9 text-sm font-bold text-navy outline-none transition-all hover:bg-white/70 focus:border-navy"
      >
        {campuses.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </select>
      <ChevronDown
        size={16}
        strokeWidth={2.5}
        className="pointer-events-none absolute right-3 text-navy/70"
      />
    </div>
  );
}

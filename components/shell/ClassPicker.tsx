'use client';

import {useEffect, useTransition} from 'react';
import {ChevronDown, Loader2} from 'lucide-react';
import {useTranslations} from 'next-intl';
import {useRouter, usePathname} from '@/i18n/navigation';
import {useSearchParams} from 'next/navigation';
import type {ClassOption} from '@/lib/queries';

// Bộ chọn lớp cho admin/BGH (và GVCN nhiều lớp) — đổi lớp đang xem qua ?class=.
//
// AUDIT 04/09/2026 — "đổi lớp không ăn": máy chủ dựng lớp mới mất 0,4–1,8 s (có cú 10 s), mà suốt
// lúc ấy bộ chọn đã hiện tên lớp mới còn nội dung đứng im — không một dấu hiệu nào. Người dùng
// bấm lại → xếp thêm hàng. Nay:
//   · useTransition: đang chuyển thì khoá bộ chọn, thay mũi tên bằng vòng xoay, và mờ phần nội
//     dung (html[data-chuyen-lop] → CSS ở globals.css) cho tới khi lớp mới hiện.
//   · GIỮ query đang có (?week=, ?bang=…): trước đây `router.push(pathname?class=)` làm rơi tuần
//     đang xem — đổi lớp xong là bị kéo về tuần hiện tại.
//   · Gom theo CƠ SỞ rồi KHỐI: 28 lớp hai cơ sở trong một danh sách phẳng thì phải dò từng dòng.
export function ClassPicker({
  classes,
  current,
}: {
  classes: ClassOption[];
  current?: string;
}) {
  const t = useTranslations('common');
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [dangChuyen, batDau] = useTransition();

  // Mờ nội dung trang khi đang chuyển — bộ chọn nằm ngoài <main> nên đánh dấu ở <html>.
  useEffect(() => {
    if (dangChuyen) document.documentElement.setAttribute('data-chuyen-lop', '1');
    else document.documentElement.removeAttribute('data-chuyen-lop');
    return () => document.documentElement.removeAttribute('data-chuyen-lop');
  }, [dangChuyen]);

  if (classes.length <= 1) return null;

  // Nhóm = "Cơ sở · Khối". <optgroup> không lồng được hai cấp, nên gộp tên; một cơ sở thì chỉ hiện
  // khối; một khối thì không nhóm (nhóm một mục là nhiễu). `classes` đã sắp (cơ sở, khối, tên)
  // từ getAccessibleClasses nên Map giữ đúng thứ tự chèn.
  const nhieuCoSo = new Set(classes.map((c) => c.campus_name ?? '')).size > 1;
  const nhom = new Map<string, ClassOption[]>();
  for (const c of classes) {
    const ten = nhieuCoSo && c.campus_name ? `${c.campus_name} · ${c.grade_name}` : c.grade_name;
    const list = nhom.get(ten);
    if (list) list.push(c);
    else nhom.set(ten, [c]);
  }
  const coNhom = nhom.size > 1;

  const doiLop = (id: string) => {
    const q = new URLSearchParams(searchParams.toString());
    q.set('class', id);
    batDau(() => {
      router.push(`${pathname}?${q.toString()}`);
    });
  };

  return (
    <div className="relative inline-flex items-center">
      <select
        value={current ?? ''}
        aria-label={t('chonLop')}
        aria-busy={dangChuyen}
        disabled={dangChuyen}
        onChange={(e) => doiLop(e.target.value)}
        className="glass-pill min-h-11 cursor-pointer appearance-none rounded-full py-2 pl-4 pr-9 text-sm font-bold text-navy transition-all hover:bg-white/70 focus:border-navy disabled:cursor-wait disabled:opacity-70"
      >
        {coNhom
          ? [...nhom.entries()].map(([tenNhom, list]) => (
              <optgroup key={tenNhom} label={tenNhom}>
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
      {dangChuyen ? (
        <Loader2 size={16} strokeWidth={2.5} className="pointer-events-none absolute right-3 animate-spin text-navy/70" aria-hidden />
      ) : (
        <ChevronDown size={16} strokeWidth={2.5} className="pointer-events-none absolute right-3 text-navy/70" aria-hidden />
      )}
      {dangChuyen && (
        <span className="sr-only" role="status">
          {t('dangChuyenLop')}
        </span>
      )}
    </div>
  );
}

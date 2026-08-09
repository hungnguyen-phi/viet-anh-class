'use client';

import {useTransition, type ComponentProps, type ReactNode} from 'react';
import {Loader2} from 'lucide-react';
import {Link, useRouter} from '@/i18n/navigation';

// Nút điều hướng CÓ BÁO ĐANG TẢI — cho các nút chỉ đổi searchParams trên cùng một route.
//
// <Link> kiểu ấy không có bất kỳ phản hồi nào cho tới khi server render xong trang mới; qua
// đường mạng của VPS (rớt ~5% gói TCP) khoảng lặng đó dài hàng giây, và người thử 08/2026 đọc
// thành "bấm lùi rất chậm, như kiểu nút không ăn" (nút lùi ngày điểm danh) và "không bấm di
// chuyển tuần được" (phòng họp WIG). Nút này đổi sang trạng thái chờ NGAY khi bấm: mờ đi, khoá
// bấm lặp, icon xoay thế chỗ nội dung.
export function NutDoiTrang({
  href,
  className,
  ariaLabel,
  children,
}: {
  href: ComponentProps<typeof Link>['href'];
  className: string;
  ariaLabel?: string;
  children: ReactNode;
}) {
  const router = useRouter();
  const [dangTai, batDau] = useTransition();
  return (
    <button
      type="button"
      aria-label={ariaLabel}
      disabled={dangTai}
      aria-busy={dangTai}
      onClick={() => batDau(() => router.push(href as Parameters<typeof router.push>[0]))}
      className={`${className} ${dangTai ? 'cursor-wait opacity-50' : 'cursor-pointer'}`}
    >
      {dangTai ? <Loader2 size={16} strokeWidth={2.5} className="animate-spin" /> : children}
    </button>
  );
}

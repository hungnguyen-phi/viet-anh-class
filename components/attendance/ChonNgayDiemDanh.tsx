'use client';

import {useTransition} from 'react';
import {Loader2} from 'lucide-react';
import {useRouter} from '@/i18n/navigation';

// Ô CHỌN NGÀY RIÊNG — chọn là đi, không có nút "Xem".
//
// Bản trước là <form method="get"> có nhãn "Ngày khác", ô ngày và nút Xem: ba thứ cho một việc.
// Chọn xong một ngày trong lịch là người ta đã nói rõ muốn gì rồi; bắt bấm thêm một nút là hỏi
// lại lần nữa. Chấm quay hiện thay ô lúc đang chờ trang mới, cùng cách NutDoiTrang đang làm.
export function ChonNgayDiemDanh({
  ngay,
  toiDa,
  classParam,
}: {
  ngay: string;
  toiDa: string;
  classParam?: string;
}) {
  const router = useRouter();
  const [dangTai, batDau] = useTransition();
  return (
    <span className="relative inline-flex items-center">
      <input
        type="date"
        value={ngay}
        max={toiDa}
        aria-label="Chọn ngày"
        disabled={dangTai}
        onChange={(e) => {
          const v = e.target.value;
          if (!v || v === ngay) return;
          batDau(() =>
            router.push({
              pathname: '/attendance',
              query: {...(classParam ? {class: classParam} : {}), date: v},
            }),
          );
        }}
        className={`h-9 rounded-[10px] border-[1.5px] border-navy/15 bg-white px-2 text-[12.5px] font-bold text-navy outline-none focus:border-navy ${
          dangTai ? 'cursor-wait opacity-50' : 'cursor-pointer'
        }`}
      />
      {dangTai && (
        <Loader2
          size={14}
          strokeWidth={2.5}
          className="pointer-events-none absolute right-2 animate-spin text-navy"
        />
      )}
    </span>
  );
}

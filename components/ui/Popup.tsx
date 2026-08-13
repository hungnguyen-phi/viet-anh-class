'use client';

import {useEffect, useState, type ReactNode} from 'react';
import {createPortal} from 'react-dom';
import {X} from 'lucide-react';

// HỘP THOẠI DÙNG CHUNG — cùng lớp áo với hộp xác nhận xoá nhiều người ở màn Quản trị
// (BulkDeleteDialog): phủ navy mờ, thẻ glass bo 20px. Tách ra vì nay có hai chỗ cần nó — ô thời
// khoá biểu và form dời lớp ở sổ lớp.
//
// DỰNG QUA PORTAL, KHÔNG ĐỂ TẠI CHỖ. Cả hai chỗ gọi đều nằm trong một khung có `overflow-x-auto`
// (bảng cuộn ngang); hộp thoại dựng tại chỗ sẽ bị chính khung ấy cắt mất một nửa, hoặc trôi theo
// khi người dùng cuộn bảng. Portal đưa nó ra thẳng <body> nên không dính gì tới bảng.
export function Popup({
  title,
  onClose,
  children,
  width = 'max-w-[520px]',
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  width?: string;
}) {
  // Chỉ dựng sau khi đã gắn vào cây DOM: createPortal cần `document`, mà lần render đầu của
  // Next chạy trên máy chủ.
  const [daGan, setDaGan] = useState(false);
  useEffect(() => setDaGan(true), []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    // Khoá cuộn nền: mở hộp thoại rồi lăn chuột mà trang sau lưng cuộn theo là mất phương hướng.
    const cu = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = cu;
    };
  }, [onClose]);

  if (!daGan) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-navy/35 p-4 backdrop-blur-[2px]"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div role="dialog" aria-modal="true" aria-label={title} className={`glass w-full ${width} rounded-[20px] p-[18px]`}>
        <div className="mb-3 flex items-start gap-2">
          <h2 className="min-w-0 flex-1 font-display text-[16px] font-bold text-navy">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Đóng"
            className="relative grid h-7 w-7 shrink-0 cursor-pointer place-items-center rounded-[9px] text-grey-mid transition-colors after:absolute after:left-1/2 after:top-1/2 after:h-11 after:w-11 after:-translate-x-1/2 after:-translate-y-1/2 after:content-[''] hover:bg-navy/[0.07] hover:text-navy"
          >
            <X size={15} strokeWidth={2.5} />
          </button>
        </div>
        {children}
      </div>
    </div>,
    document.body,
  );
}

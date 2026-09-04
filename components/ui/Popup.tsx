'use client';

import {useEffect, useRef, useState, type ReactNode} from 'react';
import {createPortal} from 'react-dom';
import {X} from 'lucide-react';
import {useTranslations} from 'next-intl';
import {useFocusTrap} from '@/lib/useFocusTrap';

// HỘP THOẠI DÙNG CHUNG — cùng lớp áo với hộp xác nhận xoá nhiều người ở màn Quản trị
// (BulkDeleteDialog): phủ navy mờ, thẻ glass bo 20px. Tách ra vì nay có hai chỗ cần nó — ô thời
// khoá biểu và form dời lớp ở sổ lớp.
//
// DỰNG QUA PORTAL, KHÔNG ĐỂ TẠI CHỖ. Cả hai chỗ gọi đều nằm trong một khung có `overflow-x-auto`
// (bảng cuộn ngang); hộp thoại dựng tại chỗ sẽ bị chính khung ấy cắt mất một nửa, hoặc trôi theo
// khi người dùng cuộn bảng. Portal đưa nó ra thẳng <body> nên không dính gì tới bảng.
//
// FOCUS (audit 04/09/2026): mở hộp mà activeElement vẫn là <body> — người dùng bàn phím/đọc màn
// hình không biết hộp đã mở, Tab thì lọt ra trang sau lưng. Nay dùng chung useFocusTrap với
// MoodCheckin: đưa focus vào phần tử đầu, giữ Tab luẩn quẩn trong hộp, trả focus về nút mở khi
// đóng. Hộp cam kết/thước có autoFocus riêng vẫn thắng (trap chỉ focus khi chưa có gì được focus).
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
  const tc = useTranslations('common');
  // Chỉ dựng sau khi đã gắn vào cây DOM: createPortal cần `document`, mà lần render đầu của
  // Next chạy trên máy chủ.
  const [daGan, setDaGan] = useState(false);
  useEffect(() => setDaGan(true), []);
  const hopRef = useRef<HTMLDivElement>(null);
  // Nút đã mở hộp: ghi ở LẦN RENDER ĐẦU trên máy khách — trước khi ô `autoFocus` trong hộp giật
  // focus (effect của trap chạy sau mount nên nhìn thấy ô nhập chứ không phải nút). Audit 04/09:
  // 2/7 popup có autoFocus đóng xong focus rơi về skip-link vì thế.
  const nutMoRef = useRef<HTMLElement | null>(null);
  if (typeof document !== 'undefined' && nutMoRef.current === null) {
    const ae = document.activeElement as HTMLElement | null;
    nutMoRef.current = ae && ae !== document.body ? ae : null;
  }
  useFocusTrap(daGan, hopRef, nutMoRef);

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
      <div
        ref={hopRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`glass w-full ${width} rounded-[20px] p-[18px] outline-none`}
      >
        <div className="mb-3 flex items-start gap-2">
          <h2 className="min-w-0 flex-1 font-display text-doc font-bold text-navy">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label={tc('dong')}
            className="-mr-2 -mt-2 grid h-11 w-11 shrink-0 cursor-pointer place-items-center rounded-[12px] text-grey-mid transition-colors hover:bg-navy/[0.07] hover:text-navy"
          >
            <X size={16} strokeWidth={2.5} />
          </button>
        </div>
        {children}
      </div>
    </div>,
    document.body,
  );
}

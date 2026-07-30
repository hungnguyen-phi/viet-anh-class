'use client';

import {useFormStatus} from 'react-dom';
import {Loader2} from 'lucide-react';
import {SlowNotice} from './SlowNotice';

// Nút submit có hộp xác nhận (cho thao tác nguy hiểm như xoá).
// Mặc định kiểu "danger" đỏ nhạt của v3; caller vẫn có thể truyền className riêng.
//
// CÓ TRẠNG THÁI ĐANG GỬI (useFormStatus) — trước đây không có, và đó là một lỗ thật:
// bấm ✕ xong màn hình y nguyên, không spinner, không thông báo. Đã đo trên production: thao tác
// CHẠY XONG ở máy chủ (hàng dữ liệu đã bị xoá) nhưng phản hồi không về tới trình duyệt, nên dòng
// vừa xoá vẫn còn trên bảng. Người dùng không có cách nào biết là xong hay hỏng — đúng kiểu phàn
// nàn "bấm không thấy gì xảy ra". Nay: khoá nút (chặn bấm hai lần), hiện spinner, và sau 12 giây
// thì bày cách tự thoát (tải lại trang).
//
// Giữ NGUYÊN kích thước nút khi đang gửi: nội dung chuyển invisible, spinner phủ tuyệt đối ở
// giữa. Các nút này nằm trong hàng bảng chật nên không được phép nhảy bố cục.
export function ConfirmButton({
  message,
  className = 'cursor-pointer rounded-[10px] border-[1.5px] border-[rgba(192,57,43,0.3)] bg-[rgba(192,57,43,0.12)] px-3 py-1.5 text-sm font-bold text-status-bad transition-all hover:bg-[rgba(192,57,43,0.2)] active:translate-y-px',
  children,
}: {
  message: string;
  className?: string;
  children: React.ReactNode;
}) {
  const {pending} = useFormStatus();

  return (
    <>
      <button
        type="submit"
        disabled={pending}
        aria-busy={pending}
        className={`relative ${className}`}
        onClick={(e) => {
          if (!window.confirm(message)) e.preventDefault();
        }}
      >
        <span className={pending ? 'invisible' : undefined}>{children}</span>
        {pending && (
          <Loader2
            size={14}
            className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 animate-spin"
          />
        )}
      </button>
      <SlowNotice pending={pending} />
    </>
  );
}

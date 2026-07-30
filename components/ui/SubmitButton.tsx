'use client';

import {useEffect, useState, type ReactNode} from 'react';
import {useFormStatus} from 'react-dom';
import {Loader2, RotateCcw} from 'lucide-react';

// Sau bao lâu thì coi là "quá lâu" và bày cách tự thoát.
// 12 giây: đủ dài để không quấy rầy thao tác bình thường (đo thực tế phần lớn dưới 3 giây),
// đủ ngắn để người dùng chưa kịp kết luận là app hỏng.
const SLOW_MS = 12_000;

// Nút submit dùng chung cho các form server-action.
// - useFormStatus → tự biết form đang gửi (pending).
// - Khi pending: khoá nút (chặn double-submit) + hiện spinner phủ giữa, ẩn nội dung
//   (giữ nguyên kích thước nút, không nhảy layout).
// Dùng thay <button type="submit">; giữ nguyên className cũ để trông y hệt.
export function SubmitButton({
  className,
  children,
  wrapClass = 'inline-flex items-center gap-1.5',
}: {
  className?: string;
  children: ReactNode;
  // Lớp cho span bọc nội dung — khớp cách nút cũ bố trí icon+chữ (mặc định inline-flex gap).
  wrapClass?: string;
}) {
  const {pending} = useFormStatus();
  const [slow, setSlow] = useState(false);

  // Chờ quá lâu → hiện lời nhắc tự thoát.
  //
  // VÌ SAO CẦN: người thử vai ban giám hiệu báo "đợi 5 phút vẫn thấy nút vàng đang quay, tải lại
  // cả trang web thì thấy đã tạo xong". Đúng như vậy — thao tác ĐÃ chạy xong ở máy chủ, chỉ có
  // phản hồi không về tới trình duyệt (đường truyền VPS đang mất gói). Trước đây spinner quay vô
  // hạn, không có gì gợi ý rằng chỉ cần tải lại là thấy kết quả, nên người dùng đứng chờ rồi
  // kết luận app hỏng — hoặc bấm lại lần nữa, tạo trùng dữ liệu.
  useEffect(() => {
    if (!pending) {
      setSlow(false);
      return;
    }
    const id = setTimeout(() => setSlow(true), SLOW_MS);
    return () => clearTimeout(id);
  }, [pending]);

  return (
    <>
      <button
        type="submit"
        disabled={pending}
        aria-busy={pending}
        className={`relative ${className ?? ''}`}
      >
        <span className={`${wrapClass} ${pending ? 'invisible' : ''}`}>{children}</span>
        {pending && (
          <Loader2
            size={16}
            className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 animate-spin"
          />
        )}
      </button>

      {/* position: fixed → nổi ở đáy màn hình, KHÔNG chen vào bố cục nên không đẩy lệch bất kỳ
          form nào đang dùng nút này (nút xuất hiện trong nhiều hàng flex chật). */}
      {slow && (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-4 left-1/2 z-50 w-[calc(100%-2rem)] max-w-[420px] -translate-x-1/2 rounded-[14px] border border-gold-deep/30 bg-white px-4 py-3 shadow-pop"
        >
          <div className="flex items-start gap-2.5">
            <RotateCcw size={16} strokeWidth={2.4} className="mt-0.5 shrink-0 text-gold-deep" />
            <p className="text-[12.5px] font-semibold leading-[1.55] text-navy">
              Máy chủ đang phản hồi chậm. <b>Đừng bấm lại</b> — thao tác có thể đã xong rồi. Hãy
              tải lại trang (F5) để xem kết quả.
            </p>
          </div>
        </div>
      )}
    </>
  );
}

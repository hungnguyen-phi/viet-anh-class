import {ChevronRight} from 'lucide-react';
import type {ReactNode} from 'react';

// Một mục QUẢN TRỊ GẤP LẠI ĐƯỢC: chỉ hiện tiêu đề + số lượng, bấm mới mở ruột.
//
// Trang này trước đây bày tất cả mọi thứ ra cùng lúc — bốn thẻ cấu hình lĩnh vực 4DX, bảng
// wifi, kho lưu trữ, mục lục màn hình — nên thứ dùng mỗi ngày (duyệt người, tìm người) bị đẩy
// xuống dưới đúng những thứ dùng mỗi năm một lần. Gấp lại là cách rẻ nhất để trả lại thứ tự đó
// mà không giấu mất chức năng nào.
//
// Dùng <details>/<summary> chứ không useState: nó mở/đóng được kể cả khi JavaScript chưa tải
// xong, và Ctrl+F của trình duyệt vẫn tìm thấy chữ bên trong.
export function Disclosure({
  title,
  hint,
  count,
  badge,
  defaultOpen = false,
  children,
}: {
  title: string;
  hint?: string;
  count?: number;
  /** Nhãn nhỏ bên phải tiêu đề — dùng để cảnh báo mà không cần mở ruột ra mới thấy. */
  badge?: ReactNode;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  return (
    <details className="glass group rounded-[20px]" open={defaultOpen}>
      <summary className="flex cursor-pointer list-none items-center gap-2.5 p-[18px] [&::-webkit-details-marker]:hidden">
        <ChevronRight
          size={16}
          strokeWidth={2.6}
          className="shrink-0 text-grey-mid transition-transform group-open:rotate-90"
        />
        <span className="min-w-0">
          <span className="font-display text-[15px] font-bold text-navy">
            {title}
            {count != null && <span className="ml-1.5 font-semibold text-grey-mid">({count})</span>}
          </span>
          {hint && <span className="mt-0.5 block text-xs text-grey-mid">{hint}</span>}
        </span>
        {badge && <span className="ml-auto shrink-0">{badge}</span>}
      </summary>
      <div className="px-[18px] pb-[18px]">{children}</div>
    </details>
  );
}

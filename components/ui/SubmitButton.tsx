'use client';

import {type ReactNode} from 'react';
import {useFormStatus} from 'react-dom';
import {Loader2} from 'lucide-react';
import {SlowNotice} from './SlowNotice';

// Nút submit dùng chung cho các form server-action.
// - useFormStatus → tự biết form đang gửi (pending).
// - Khi pending: khoá nút (chặn double-submit) + hiện spinner phủ giữa, ẩn nội dung
//   (giữ nguyên kích thước nút, không nhảy layout).
// - Quá 12 giây: SlowNotice bày cách tự thoát (dùng chung với ConfirmButton).
// Dùng thay <button type="submit">; giữ nguyên className cũ để trông y hệt.
export function SubmitButton({
  className,
  children,
  label,
  wrapClass = 'inline-flex items-center gap-1.5',
}: {
  className?: string;
  children: ReactNode;
  /**
   * TÊN ĐỌC ĐƯỢC riêng, khi chữ trên nút KHÔNG đủ để biết nút này tác động lên ai.
   *
   * Sinh ra cho các bảng nhiều dòng: năm mươi dòng người dùng thì có năm mươi nút mang đúng chữ
   * "Đổi vai trò". Mắt thường biết là dòng nào nhờ nút nằm cạnh tên; trình đọc màn hình đi tuần
   * tự thì nghe đúng một câu ấy lặp lại năm mươi lần. Truyền `label` vào là nút có tên thật
   * ("Đổi vai trò cho Nguyễn Văn A"), còn trên màn hình vẫn chỉ hiện chữ ngắn.
   *
   * Cùng cơ chế với `label` của ConfirmButton — giữ hai nút nói cùng một thứ tiếng.
   */
  label?: string;
  // Lớp cho span bọc nội dung — khớp cách nút cũ bố trí icon+chữ (mặc định inline-flex gap).
  wrapClass?: string;
}) {
  const {pending} = useFormStatus();

  return (
    <>
      <button
        type="submit"
        disabled={pending}
        aria-busy={pending}
        aria-label={label}
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
      <SlowNotice pending={pending} />
    </>
  );
}

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
  wrapClass = 'inline-flex items-center gap-1.5',
}: {
  className?: string;
  children: ReactNode;
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

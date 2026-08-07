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
  // rgba(192,57,43,…) là --color-status-bad gõ lại bằng tay. Pha từ chính token để đổi một chỗ
  // là đổi cả nút, thay vì phải nhớ ba con số này nằm ở đây.
  className = 'cursor-pointer rounded-[10px] border-[1.5px] border-[color-mix(in_srgb,var(--color-status-bad)_30%,transparent)] bg-[color-mix(in_srgb,var(--color-status-bad)_12%,transparent)] px-3 py-1.5 text-sm font-bold text-status-bad transition-all hover:bg-[color-mix(in_srgb,var(--color-status-bad)_20%,transparent)] active:translate-y-px',
  children,
  label,
}: {
  message: string;
  className?: string;
  children: React.ReactNode;
  /**
   * TÊN ĐỌC ĐƯỢC của nút, cho nút chỉ có ký hiệu.
   *
   * Phần lớn nút xoá trong app có nội dung đúng một chữ "✕". Trình đọc màn hình đọc ký tự đó
   * thành "dấu nhân" — người khiếm thị nghe được là có một nút tên "dấu nhân", không biết nó
   * xoá cái gì. Truyền `label` vào là nút có tên thật, còn mắt thường vẫn chỉ thấy dấu ✕.
   */
  label?: string;
}) {
  const {pending} = useFormStatus();

  return (
    <>
      <button
        type="submit"
        disabled={pending}
        aria-busy={pending}
        aria-label={label}
        className={`relative ${className}`}
        onClick={(e) => {
          if (!window.confirm(message)) e.preventDefault();
        }}
      >
        {/* `contents` để cái span này KHÔNG tự làm một hộp.
            Nơi gọi đặt `inline-flex items-center gap-1` lên NÚT rồi truyền vào một icon và một
            chữ, đinh ninh hai thứ ấy là hai ô của flex. Nhưng span bọc ngoài nuốt mất: nó thành
            MỘT ô duy nhất, còn icon với chữ bên trong nó lại là nội dung inline nên xuống dòng
            khi hẹp. Đó là lý do nút "Xoá" cao gấp đôi nút "Sửa" đứng cạnh — thùng rác một dòng,
            chữ Xoá một dòng. `display: contents` cho icon và chữ ra thẳng làm ô của flex, đúng
            như nơi gọi tưởng.
            Vẫn giữ được mẹo che nội dung lúc đang gửi: visibility DI TRUYỀN xuống con, nên
            `invisible` trên một phần tử `contents` vẫn giấu cả icon lẫn chữ. */}
        <span className={`contents ${pending ? 'invisible' : ''}`}>{children}</span>
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

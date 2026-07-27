import type {ReactNode} from 'react';
import {AlertCircle} from 'lucide-react';

// ============================================================
// Bộ điều khiển form dùng chung — thêm 2026-07-27 sau audit giao diện.
//
// VẤN ĐỀ ĐANG SỬA: mỗi file tự khai một chuỗi class riêng cho ô nhập và nút. Chúng dùng
// padding khác nhau (py-2 / py-1.5) và cỡ chữ khác nhau (13px / 12px), nên trong cùng một hàng
// `flex items-center` ba thứ cạnh nhau lại cao 40px / 38px / 31px. Đó là lý do "nút bị lệch".
//
// CÁCH SỬA: chiều cao TƯỜNG MINH (ctl-h = 44px) cho mọi điều khiển thay vì để padding quyết
// định. Cùng chiều cao thì tự thẳng hàng, không cần canh tay.
//
// Giữ nguyên ngôn ngữ hình ảnh cũ (bo 10px, viền 1.5px navy/15, nền trắng, chữ navy đậm) —
// đây là sửa cấu trúc, không phải đổi phong cách.
// ============================================================

// Nền chung: bo góc, viền, chuyển động. Màu viền tách riêng để đổi sang đỏ khi lỗi.
const CTL_BASE =
  'ctl-h w-full min-w-0 rounded-[10px] border-[1.5px] bg-white px-3 text-sm font-semibold text-navy outline-none transition-colors';

export const BORDER_OK = 'border-navy/15 focus:border-navy';
export const BORDER_ERR = 'border-status-bad focus:border-status-bad';

export const inputCls = `${CTL_BASE} ${BORDER_OK}`;
export const selectCls = `${CTL_BASE} ${BORDER_OK} cursor-pointer`;

// Viền theo trạng thái lỗi — dùng khi form có validation inline (useActionState).
export const ctlWithBorder = (hasError: boolean) =>
  `${CTL_BASE} ${hasError ? BORDER_ERR : BORDER_OK}`;

// ---- Nút ----
// Cùng `ctl-h` với ô nhập → đứng cùng hàng là thẳng. `shrink-0` để nút không bị bóp méo khi
// hàng chật; nếu hết chỗ thì cả nút xuống dòng nguyên vẹn thay vì co lại thành hình chữ nhật dẹt.
const BTN_BASE =
  'ctl-h inline-flex shrink-0 cursor-pointer items-center justify-center gap-1.5 whitespace-nowrap rounded-[10px] px-4 text-[13px] font-extrabold transition-all disabled:cursor-not-allowed disabled:opacity-60';

export const btnGold = `btn-gold ${BTN_BASE}`;
export const btnNavy = `${BTN_BASE} bg-navy text-white hover:bg-navy-700`;
export const btnGhost = `${BTN_BASE} border-[1.5px] border-navy/20 bg-white text-navy hover:border-navy`;
export const btnDanger = `${BTN_BASE} border-[1.5px] border-status-bad/30 bg-status-bad/[0.08] px-3 text-status-bad hover:bg-status-bad/[0.16]`;

// Nhãn: hoa nhỏ, đậm — giữ đúng kiểu nhãn đã dùng ở WigCreateForm.
export const labelCls =
  'mb-1 block text-[10px] font-extrabold uppercase tracking-wide text-grey-mid';

/**
 * Một ô nhập kèm NHÃN THẬT.
 *
 * Vì sao bắt buộc có nhãn: trước đây 88/98 ô trong app chỉ có `placeholder` làm nhãn. Placeholder
 * biến mất ngay khi người dùng gõ chữ đầu tiên, nên đang điền dở mà ngẩng lên là không biết ô
 * này là ô gì (WCAG 3.3.2). Tệ hơn: khi ô bị bóp hẹp thì chính cái placeholder-làm-nhãn đó bị
 * cắt cụt — "Mục tiêu (số)" hiện thành "Mục tiê…". Nhãn nằm ngoài ô thì không bao giờ bị cắt và
 * không biến mất.
 *
 * `hint` dành cho đơn vị hoặc ví dụ; nó ở dưới ô nên không tranh chỗ với nội dung.
 */
export function Field({
  label,
  htmlFor,
  error,
  hint,
  className = '',
  children,
}: {
  label: string;
  htmlFor?: string;
  error?: string | null;
  hint?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={`min-w-0 ${className}`}>
      <label className={labelCls} htmlFor={htmlFor}>
        {label}
      </label>
      {children}
      {error ? (
        <p className="mt-1 inline-flex items-center gap-1 text-[12px] font-bold text-status-bad">
          <AlertCircle size={12} strokeWidth={2.5} />
          {error}
        </p>
      ) : hint ? (
        <p className="mt-1 text-[11px] font-semibold text-grey-mid">{hint}</p>
      ) : null}
    </div>
  );
}

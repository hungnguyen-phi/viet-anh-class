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

// Nền chung: bo góc, viền, chuyển động. KHÔNG chứa bề rộng — xem ghi chú ở inputInline.
//
// `text-base sm:text-sm` (audit 04/09/2026): iOS tự PHÓNG TO cả trang khi chạm vào ô nhập có chữ
// dưới 16px — 700 em dùng điện thoại, mọi form đều bị. Từ 640px trở lên giữ 14px như cũ.
// Không còn `outline-none`: vòng focus bàn phím do luật :focus-visible toàn cục (globals.css) vẽ.
const CTL_BASE =
  'ctl-h min-w-0 rounded-[10px] border-[1.5px] bg-white px-3 text-base sm:text-sm font-semibold text-navy transition-colors';

export const BORDER_OK = 'border-navy/15 focus:border-navy';
export const BORDER_ERR = 'border-status-bad focus:border-status-bad';

// Dùng TRONG <Field> (ô chiếm trọn ô lưới).
export const inputCls = `${CTL_BASE} w-full ${BORDER_OK}`;
export const selectCls = `${CTL_BASE} w-full ${BORDER_OK} cursor-pointer`;

// Dùng cho hàng inline, nơi người gọi TỰ đặt bề rộng (`w-20`, `flex-1`…).
//
// Vì sao phải tách: nếu base đã có `w-full` mà người gọi viết thêm `w-20` thì hai lớp width
// cùng tồn tại, và cái nào thắng phụ thuộc thứ tự Tailwind sinh CSS chứ KHÔNG phải thứ tự
// mình viết trong className — tức là kết quả không đoán trước được.
export const inputInline = `${CTL_BASE} ${BORDER_OK}`;
export const selectInline = `${CTL_BASE} ${BORDER_OK} cursor-pointer`;

// Viền theo trạng thái lỗi — dùng khi form có validation inline (useActionState).
export const ctlWithBorder = (hasError: boolean) =>
  `${CTL_BASE} w-full ${hasError ? BORDER_ERR : BORDER_OK}`;

// ---- Nút ----
// Cùng `ctl-h` với ô nhập → đứng cùng hàng là thẳng. `shrink-0` để nút không bị bóp méo khi
// hàng chật; nếu hết chỗ thì cả nút xuống dòng nguyên vẹn thay vì co lại thành hình chữ nhật dẹt.
const BTN_BASE =
  'ctl-h inline-flex shrink-0 cursor-pointer items-center justify-center gap-1.5 whitespace-nowrap rounded-[10px] px-4 text-[13px] font-extrabold transition-all disabled:cursor-not-allowed disabled:opacity-60';

export const btnGold = `btn-gold ${BTN_BASE}`;
export const btnNavy = `${BTN_BASE} bg-navy text-white hover:bg-navy-700`;
export const btnGhost = `${BTN_BASE} border-[1.5px] border-navy/20 bg-white text-navy hover:border-navy`;

// NÚT GHOST CHO NHÃN DÀI — chữ được XUỐNG DÒNG.
//
// BTN_BASE cố ý có `shrink-0` + `whitespace-nowrap` + chiều cao cứng `ctl-h`: nút đứng cùng hàng
// với ô nhập thì thà xuống dòng nguyên vẹn còn hơn co lại thành hình chữ nhật dẹt. Nhưng nút nào
// ĐỨNG MỘT MÌNH mà nhãn dài hơn bề ngang máy thì đúng ba thuộc tính ấy quay ra chống lại nó —
// "Bạn muốn thêm một mục tiêu của riêng bạn" thò ra khỏi thẻ 33px ở màn 360px (đo 14/08/2026).
// Ở đây: cho phép ngắt dòng, `max-w-full` để không vượt thẻ, và đổi chiều cao cứng thành
// `min-h-11` (vẫn đủ 44px vùng chạm) để hai dòng chữ có chỗ.
export const btnGhostDai =
  'inline-flex min-h-11 max-w-full cursor-pointer items-center justify-center gap-1.5 rounded-[10px] border-[1.5px] border-navy/20 bg-white px-4 py-2.5 text-[13px] font-extrabold text-navy transition-all hover:border-navy';
export const btnDanger = `${BTN_BASE} border-[1.5px] border-status-bad/30 bg-status-bad/[0.08] px-3 text-status-bad hover:bg-status-bad/[0.16]`;

// Nút XOÁ chỉ có icon, dùng ở đầu mỗi thẻ (biên bản họp, WIG…).
//
// Chuỗi class này trước đây được CHÉP TAY nguyên văn ở 4 file. Gom về đây để sửa một lần là đổi
// khắp nơi — và để lần sau không mọc thêm bản thứ năm lệch một hai lớp so với bốn bản kia.
//
// VÙNG CHẠM 28px: đạt WCAG 2.5.8 (mức AA, ngưỡng 24×24). Ngưỡng 44px là 2.5.5 mức AAA, và là
// luật riêng của dự án cho MÀN HỌC SINH — nút này chỉ hiện với `canManage`, tức giáo viên/quản
// trị trên laptop, nên 28px là đúng mức.
//
// ĐÃ CÂN NHẮC VÀ BỎ: nới vùng chạm lên 44px bằng lớp phủ `after:-inset-2`. Ở /wig nút này đứng
// ngay sát liên kết "Sửa"; lớp phủ trong suốt tràn 8px sang trái sẽ nằm ĐÈ lên liên kết đó, và
// người dùng bấm "Sửa" lại ra hộp thoại xoá. Đổi một lỗi nhỏ lấy một lỗi lớn hơn.
export const btnIconDanger =
  'grid h-7 w-7 cursor-pointer place-items-center rounded-[9px] border-[1.5px] border-status-bad/30 bg-status-bad/[0.08] text-status-bad transition-all hover:bg-status-bad/[0.16]';

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

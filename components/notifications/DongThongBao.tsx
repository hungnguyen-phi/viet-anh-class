'use client';

import {useState} from 'react';
import {docMotThongBao} from '@/app/[locale]/(dashboard)/notifications/actions';

// GIỮ DẤU "MỚI" QUA LẦN LÀM TƯƠI.
//
// Mở trang thông báo là tắt số trên chuông (DaXem), và tắt xong thì router.refresh() dựng lại
// trang — lúc ấy mọi dòng đều đã `read = true`, nên chấm vàng và nền vàng nhạt đánh dấu "cái này
// mới" biến mất ngay trước mắt người đang đọc. Tức là vào xem thì mất luôn thứ cho biết cái nào
// cần xem — đúng cái mà việc tắt số lẽ ra phải giúp, chứ không phải phá.
//
// Nên "mới" do CLIENT nhớ, không do cột `read` quyết. Ghi lại ở lần dựng đầu — trước khi DaXem
// kịp đánh dấu — rồi giữ nguyên suốt lượt xem này: useState khởi tạo một lần cho mỗi lần gắn vào
// cây, mà router.refresh() KHÔNG gắn lại. Rời trang rồi quay lại thì component gắn mới, `read`
// đã true, nền sạch — đúng như mong đợi.
//
// Cả dòng là <form> gọi server action rồi redirect (không còn là <Link>): bấm vào là đánh dấu
// đúng dòng ấy rồi mới đi. <button> phủ kín dòng nên vùng bấm y như cũ.
export function DongThongBao({
  id,
  link,
  title,
  body,
  ngay,
  chuaDoc,
  coVien,
}: {
  id: string;
  link: string;
  title: string;
  body: string | null;
  ngay: string;
  chuaDoc: boolean;
  coVien: boolean;
}) {
  const [moiLucVao] = useState(chuaDoc);
  return (
    <form
      action={docMotThongBao}
      className={`${coVien ? 'border-t border-navy/[0.08]' : ''} ${
        moiLucVao ? 'bg-gold/[0.06]' : ''
      }`}
    >
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="link" value={link} />
      <button
        type="submit"
        className="block w-full cursor-pointer px-4 py-3 text-left transition-colors hover:bg-navy/[0.03]"
      >
        <span className="flex items-center gap-2">
          {moiLucVao && <span className="h-2 w-2 shrink-0 rounded-full bg-gold-deep" />}
          <span className="text-[14px] font-bold text-navy">{title}</span>
          <span className="ml-auto shrink-0 text-[11px] font-semibold text-grey-mid">{ngay}</span>
        </span>
        {body && <span className="mt-1 block text-[13px] leading-relaxed text-txt">{body}</span>}
      </button>
    </form>
  );
}

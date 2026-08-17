'use client';

import {useLinkStatus} from 'next/link';
import {ChevronLeft, ChevronRight, Loader2} from 'lucide-react';

// ════════════════════════════════════════════════════════════════════════════════════════════
// RUỘT CỦA NÚT ← / → CHUYỂN TUẦN — biết mình đang chờ
// ════════════════════════════════════════════════════════════════════════════════════════════
//
// Chủ dự án 16/08/2026: "khi tôi nhấn vào nút tuần trước, tuần sau, không có hiệu ứng hay đóng
// băng nào biểu thị nó đang load, mà nó còn load chậm nữa chứ".
//
// Trang /wig là server component, nên bấm ← là một lượt đi máy chủ trọn vẹn. Với đường truyền
// chậm thì có cả giây không có gì nhúc nhích — và cái người ta làm khi bấm mà không thấy gì là
// BẤM LẠI, rồi thêm một lượt đi nữa. Vòng ấy tự nuôi nó.
//
// `useLinkStatus` (Next 15.3+) chỉ chạy được ở component nằm BÊN TRONG <Link>, nên phải tách
// riêng cái ruột này thay vì gắn trạng thái lên chính thẻ Link. Đổi lại được đúng thứ cần: mũi
// tên biến thành vòng xoay ngay lúc bấm, chữ mờ đi, và `aria-busy` để trình đọc màn hình cũng
// nghe được là đang chờ.
export function NutChuyenTuan({huong, nhan, chiIcon}: {huong: 'truoc' | 'sau'; nhan: string; chiIcon?: boolean}) {
  const {pending} = useLinkStatus();
  const Mui = huong === 'truoc' ? ChevronLeft : ChevronRight;

  const icon = pending ? (
    <Loader2 size={17} strokeWidth={2.5} className="animate-spin" />
  ) : (
    <Mui size={17} strokeWidth={2.5} />
  );

  return (
    <span
      aria-busy={pending || undefined}
      className={`inline-flex items-center gap-1 transition-opacity ${pending ? 'opacity-60' : ''}`}
      title={chiIcon ? nhan : undefined}
    >
      {huong === 'truoc' && icon}
      {!chiIcon && <span className="hidden sm:inline">{nhan}</span>}
      {huong === 'sau' && icon}
    </span>
  );
}

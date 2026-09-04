'use client';

import {useEffect, useState} from 'react';
import {RotateCcw} from 'lucide-react';
import {useTranslations} from 'next-intl';

// Sau bao lâu thì coi là "quá lâu" và bày cách tự thoát.
// 12 giây: đủ dài để không quấy rầy thao tác bình thường (đo thực tế phần lớn dưới 3 giây),
// đủ ngắn để người dùng chưa kịp kết luận là app hỏng.
export const SLOW_MS = 12_000;

// Lời nhắc "máy chủ chậm, đừng bấm lại" — dùng chung cho MỌI nút gửi form.
//
// VÌ SAO CẦN: người thử vai ban giám hiệu báo "đợi 5 phút vẫn thấy nút vàng đang quay, tải lại cả
// trang web thì thấy đã tạo xong". Đúng như vậy, và đã đo lại được trên production: thao tác chạy
// xong ở máy chủ (dữ liệu đã đổi) nhưng phản hồi không về tới trình duyệt — đường truyền của VPS
// chập chờn. Không có lời nhắc này thì người dùng đứng chờ rồi kết luận app hỏng, hoặc bấm lại
// lần nữa.
export function SlowNotice({pending}: {pending: boolean}) {
  const t = useTranslations('common');
  const [slow, setSlow] = useState(false);

  useEffect(() => {
    if (!pending) {
      setSlow(false);
      return;
    }
    const id = setTimeout(() => setSlow(true), SLOW_MS);
    return () => clearTimeout(id);
  }, [pending]);

  if (!slow) return null;

  // position: fixed → nổi ở đáy màn hình, KHÔNG chen vào bố cục nên không đẩy lệch bất kỳ form
  // nào đang dùng nút này (nút xuất hiện trong nhiều hàng flex chật).
  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-4 left-1/2 z-50 w-[calc(100%-2rem)] max-w-[420px] -translate-x-1/2 rounded-[16px] border border-gold-deep/30 bg-white px-4 py-3 shadow-pop"
    >
      <div className="flex items-start gap-2.5">
        <RotateCcw size={16} strokeWidth={2.5} className="mt-0.5 shrink-0 text-gold-deep" />
        <p className="text-than font-semibold leading-[1.55] text-navy">
          {t.rich('mayChuCham', {b: (c) => <b>{c}</b>})}
        </p>
      </div>
    </div>
  );
}

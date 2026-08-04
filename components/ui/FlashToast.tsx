'use client';

import {useEffect, useState} from 'react';
import {AlertTriangle, CheckCircle2, X} from 'lucide-react';

// Bao lâu thì tự tắt. 7 giây: đủ đọc hết một câu tiếng Việt, đủ ngắn để không che nội dung.
// Báo HỎNG thì KHÔNG tự tắt: đó là việc chưa xong, người dùng phải làm gì đó, và một câu biến
// mất sau bảy giây là một câu không ai kịp đọc trong lúc đang cuộn tìm chỗ vừa bấm.
const TU_TAT_MS = 7_000;

// Thông báo sau khi làm xong một việc (đã ghi danh, đã huỷ lời mời, đã xoá lớp…).
//
// VÌ SAO NỔI CHỨ KHÔNG NẰM TRONG TRANG: ban giám hiệu phản ánh — "các thông báo như đã huỷ lời
// mời thường hiện đầu trang web, việc này làm người thao tác khó nhận biết thao tác đó đã hoàn
// thành", và mong "thông báo hiện lên phía trên nhưng người thao tác vẫn thấy được chứ không
// phải đầu trang web". Đúng vậy: dải thông báo cũ nằm trong luồng nội dung, ở TRÊN CÙNG trang.
// Ai đang thao tác ở cuối một danh sách 30 em thì bấm xong chẳng thấy gì — tưởng nút không ăn.
//
// Nay nổi cố định ngay dưới thanh menu, luôn nằm trong tầm mắt dù đang cuộn tới đâu.
//
// Vị trí đo lúc chạy từ khối [data-appnav] thay vì đóng cứng một con số: thanh menu cao khác
// nhau giữa điện thoại và máy tính, đóng cứng là sai một trong hai.
export function FlashToast({message, kind = 'ok'}: {message: string; kind?: 'ok' | 'err'}) {
  const [hien, setHien] = useState(true);
  const [top, setTop] = useState<number | null>(null);

  useEffect(() => {
    const do_ = () => {
      const nav = document.querySelector('[data-appnav]');
      setTop(nav ? Math.round(nav.getBoundingClientRect().height) + 8 : 12);
    };
    do_();
    window.addEventListener('resize', do_);
    return () => window.removeEventListener('resize', do_);
  }, []);

  // Bỏ ?flash=… khỏi địa chỉ: tải lại trang thì không hiện lại thông báo của việc đã xong từ lâu.
  // replaceState nên không thêm một bước vào lịch sử — bấm Quay lại vẫn về đúng chỗ cũ.
  useEffect(() => {
    const u = new URL(window.location.href);
    let doi = false;
    for (const k of ['flash', 'flash_err']) {
      if (u.searchParams.has(k)) {
        u.searchParams.delete(k);
        doi = true;
      }
    }
    if (doi) window.history.replaceState(null, '', u.pathname + u.search + u.hash);
  }, [message]);

  useEffect(() => {
    setHien(true);
    if (kind === 'err') return; // báo hỏng thì nằm lại tới khi người ta tự đóng
    const id = setTimeout(() => setHien(false), TU_TAT_MS);
    return () => clearTimeout(id);
  }, [message, kind]);

  if (!hien || top === null) return null;

  // MỘT HÌNH THỨC CHO CẢ TIN TỐT LẪN TIN XẤU LÀ NÓI DỐI.
  //
  // Bản cũ chỉ có một kiểu: viền xanh, dấu tích, chữ xanh. Nên câu "Bạn không có quyền thực hiện
  // thao tác này." hiện ra trông y hệt "Đã lưu" — cô giáo liếc thấy dấu tích xanh là đóng máy,
  // WIG tuần không tồn tại, và sáng thứ Hai màn hình học sinh trống trơn. Không ai làm gì sai cả;
  // màn hình đã bảo họ là xong.
  const loi = kind === 'err';
  const Icon = loi ? AlertTriangle : CheckCircle2;

  return (
    <div
      role={loi ? 'alert' : 'status'}
      aria-live={loi ? 'assertive' : 'polite'}
      style={{top}}
      className={`fixed left-1/2 z-30 w-[calc(100%-2rem)] max-w-[520px] -translate-x-1/2 rounded-[14px] border bg-white px-4 py-2.5 shadow-pop ${
        loi ? 'border-status-bad/40' : 'border-success/30'
      }`}
    >
      <div className="flex items-start gap-2.5">
        <Icon
          size={16}
          strokeWidth={2.5}
          className={`mt-0.5 shrink-0 ${loi ? 'text-status-bad' : 'text-success-dark'}`}
        />
        <p
          className={`min-w-0 flex-1 text-[13px] font-bold leading-[1.5] ${
            loi ? 'text-status-bad' : 'text-success-dark'
          }`}
        >
          {message}
        </p>
        <button
          type="button"
          onClick={() => setHien(false)}
          aria-label="Đóng thông báo"
          className="-mr-1 -mt-0.5 grid h-6 w-6 shrink-0 cursor-pointer place-items-center rounded-[8px] text-grey-mid transition-colors hover:bg-navy/[0.06] hover:text-navy"
        >
          <X size={14} strokeWidth={2.5} />
        </button>
      </div>
    </div>
  );
}

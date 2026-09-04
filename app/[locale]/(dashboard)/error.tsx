'use client';

import {useEffect} from 'react';
import {RotateCcw, TriangleAlert} from 'lucide-react';
import {useTranslations} from 'next-intl';

// Lưới an toàn cho MỌI trang sau đăng nhập.
//
// Vì sao cần: mỗi trang dashboard chạy nhiều truy vấn Supabase (trang WIG ~10 cái). Trước đây
// app KHÔNG có error boundary nào, nên chỉ cần một truy vấn lỗi — mạng chập, token vừa hết hạn,
// dữ liệu bị xoá giữa chừng — là cả trang văng ra màn TRẮNG TRƠN: không chữ, không nút, không
// biết phải làm gì. Người thử đã báo đúng hiện tượng này ("trang web hiện trắng kiểu đang load lại").
//
// Có boundary thì lỗi biến thành một thẻ đọc được kèm nút thử lại, và phần khung (thanh nav)
// vẫn còn để đi sang trang khác.
export default function DashboardError({
  error,
  reset,
}: {
  error: Error & {digest?: string};
  reset: () => void;
}) {
  const t = useTranslations('common');
  useEffect(() => {
    // Ghi ra console để còn lần được dấu vết khi người dùng báo lỗi; `digest` là mã Next gán
    // cho lỗi phía server, đối chiếu được với log của container.
    console.error('[dashboard error]', error.digest ?? '', error);
  }, [error]);

  return (
    <div className="mx-auto mt-8 max-w-[520px]">
      <div className="glass rounded-[20px] p-6 text-center">
        <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-status-bad/10 text-status-bad">
          <TriangleAlert size={24} strokeWidth={2.2} />
        </div>
        <h1 className="mt-3 font-display text-tieu-de font-bold text-navy">{t('loiTrangTitle')}</h1>
        <p className="mt-2 text-noi-dung font-semibold leading-[1.65] text-navy/70">{t('loiTrangMoTa')}</p>
        <div className="mt-5 flex flex-wrap justify-center gap-2">
          <button
            type="button"
            onClick={reset}
            className="btn-gold inline-flex h-11 cursor-pointer items-center gap-2 rounded-[12px] px-5 text-noi-dung font-extrabold"
          >
            <RotateCcw size={16} strokeWidth={2.5} />
            {t('thuLai')}
          </button>
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages --
              CỐ Ý dùng <a> chứ không phải <Link>: đây là màn hình lỗi, tức là router phía client
              đang ở trạng thái hỏng. <Link> chỉ điều hướng trong cùng phiên React nên có thể lại
              rơi vào chính lỗi vừa xảy ra; <a> nạp lại trang từ đầu, dựng sạch mọi thứ. */}
          <a
            href="/"
            className="inline-flex h-11 items-center rounded-[12px] border-[1.5px] border-navy/20 bg-white px-5 text-noi-dung font-extrabold text-navy transition-colors hover:border-navy"
          >
            {t('veTrangChinh')}
          </a>
        </div>
        {error.digest && (
          <p className="mt-4 text-chu-thich font-semibold text-navy/65">{t('maLoiKyThuat', {ma: error.digest})}</p>
        )}
      </div>
    </div>
  );
}

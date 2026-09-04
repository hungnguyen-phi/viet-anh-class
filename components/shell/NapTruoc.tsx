'use client';

import {useEffect, useRef} from 'react';
import {usePathname, useRouter} from '@/i18n/navigation';

// ĐỨNG SẴN Ở ĐÓ TRƯỚC KHI NGƯỜI TA TỚI — nhưng chỉ ở CHỖ NGƯỜI TA SẮP TỚI.
//
// Chủ dự án 16/08/2026: "tại sao phải chờ người ta nhấn mới load, sao ko học theo netflix, đứng
// ngay ở đó trước khi người ta tới?". Đúng — nhưng bản đầu tải trước CẢ BẢY TAB ở chế độ đầy đủ,
// và audit 04/09/2026 đo được cái giá: mỗi lượt vào app = 7 lần dựng trang động trên một máy chủ
// mà 10 người cùng mở đã mất 4–6 giây/trang; đệm chỉ sống 30 giây nên phần lớn thứ tải trước bị
// vứt trước khi ai bấm tới. 700 em vào lúc 7h30 là 5000 lượt dựng vô ích trong vài phút.
//
// NAY:
//   · Chỉ tải trước 1–2 tab hay đi nhất theo vai (AppNav quyết định danh sách: em → Mục tiêu;
//     thầy cô → Mục tiêu + Điểm danh; quản trị → Quản trị). Tab còn lại vẫn được tải khi rê
//     chuột/chạm (napKhiCham ở AppNav) — vài trăm mili-giây đi trước cú bấm, đủ dùng.
//   · Vẫn chờ trang hiện tại DỰNG XONG rồi mới bắt đầu (requestIdleCallback, hoặc 1,5 s), mỗi tab
//     cách nhau 700 ms, tab đang đứng thì bỏ qua.
//   · Tải nhẹ (kind: 'auto'): với trang dynamic là lấy khung + đoạn đầu; cú bấm thật vẫn hỏi máy
//     chủ phần còn lại nhưng khung hiện ngay. Cái "đứng sẵn" đầy đủ (kind: 'full') chỉ dành cho
//     tab VỪA RỜI (xem dưới) — cú "quay lại tab vừa nãy" là cú bấm hay gặp nhất và chỉ tốn một
//     lượt dựng.
//   · Người dùng bật tiết kiệm dữ liệu (saveData) hoặc đang trên 2G thì thôi.
export function NapTruoc({duong}: {duong: {pathname: string; query?: Record<string, string>}[]}) {
  const router = useRouter();
  const daChay = useRef(false);

  useEffect(() => {
    if (daChay.current) return;
    daChay.current = true;

    const mang = (navigator as Navigator & {connection?: {saveData?: boolean; effectiveType?: string}}).connection;
    if (mang?.saveData || /(^|-)2g$/.test(mang?.effectiveType ?? '')) return;

    const hen: ReturnType<typeof setTimeout>[] = [];
    const batDau = () => {
      duong.slice(0, 2).forEach((d, i) => {
        hen.push(
          setTimeout(() => {
            try {
              router.prefetch(d as Parameters<typeof router.prefetch>[0], {kind: 'auto'} as Parameters<typeof router.prefetch>[1]);
            } catch {
              // Tải trước là thứ có thì tốt — không bao giờ được làm hỏng trang đang mở.
            }
          }, i * 700),
        );
      });
    };
    const w = window as Window & {requestIdleCallback?: (cb: () => void, o?: {timeout: number}) => number};
    if (w.requestIdleCallback) w.requestIdleCallback(batDau, {timeout: 2500});
    else hen.push(setTimeout(batDau, 1500));

    return () => hen.forEach(clearTimeout);
    // Chạy đúng một lần cho cả phiên — danh sách tab của một vai không đổi giữa chừng.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // TAB VỪA RỜI KHỎI cũng đứng sẵn: đệm của nó hết hạn sau 30 giây, mà "quay lại tab vừa nãy" là
  // cú bấm hay gặp nhất. Đổi trang xong 2 giây thì tải lại đúng một tab ấy — một lượt dựng, không
  // phải cả thanh menu.
  const pathname = usePathname();
  const truoc = useRef(pathname);
  useEffect(() => {
    const cu = truoc.current;
    truoc.current = pathname;
    if (cu === pathname) return;
    const d = duong.find((x) => x.pathname === cu) ?? {pathname: cu};
    const hen = setTimeout(() => {
      try {
        router.prefetch(d as Parameters<typeof router.prefetch>[0], {kind: 'full'} as Parameters<typeof router.prefetch>[1]);
      } catch {
        /* thôi */
      }
    }, 2000);
    return () => clearTimeout(hen);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  return null;
}

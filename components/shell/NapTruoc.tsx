'use client';

import {useEffect, useRef} from 'react';
import {usePathname, useRouter} from '@/i18n/navigation';

// ĐỨNG SẴN Ở ĐÓ TRƯỚC KHI NGƯỜI TA TỚI.
//
// Chủ dự án 16/08/2026: "tại sao phải chờ người ta nhấn mới load, sao ko học theo netflix, đứng
// ngay ở đó trước khi người ta tới?". Đúng. Trước đây prefetch bị tắt cả app vì Next vứt bỏ những
// gì tải trước (staleTimes.dynamic = 0) — nay đã bật 30 giây trong next.config.ts, nên tải trước
// mới có nghĩa.
//
// CÁCH TẢI TRƯỚC — có nhịp, không ồ ạt:
//   · Chờ trang hiện tại DỰNG XONG rồi mới bắt đầu (requestIdleCallback, hoặc 1,5 s). Bắn cùng
//     lúc với trang đang tải là tranh đường truyền với đúng cái người ta đang chờ — chính lý do
//     prefetch từng bị tắt.
//   · Mỗi tab cách nhau 700 ms, tab đang đứng thì bỏ qua. Bảy tab là ~5 giây, xong. Máy chủ chịu
//     thêm sáu lượt dựng cho một phiên — không phải cho mỗi cú bấm.
//   · Tải ĐẦY ĐỦ (kind: 'full'): với trang dynamic, mặc định 'auto' chỉ lấy khung chờ, bấm vào
//     vẫn phải hỏi máy chủ; 'full' mới là "đứng sẵn ở đó".
//   · Người dùng bật tiết kiệm dữ liệu (saveData) hoặc đang trên 2G thì thôi — không đốt gói của
//     người ta cho những trang họ có thể không mở.
//
// Sau 30 giây đệm hết hạn thì <Link> tự tải lại lúc rê chuột / chạm — vẫn được vài trăm mili-giây
// đi trước cú bấm. Hai lớp ấy cộng lại là thứ Netflix làm.
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
      duong.forEach((d, i) => {
        hen.push(
          setTimeout(() => {
            try {
              router.prefetch(d as Parameters<typeof router.prefetch>[0], {kind: 'full'} as Parameters<typeof router.prefetch>[1]);
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

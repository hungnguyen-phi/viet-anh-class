'use client';

import {useEffect, useRef, useState} from 'react';
import {usePathname, useSearchParams} from 'next/navigation';

// THANH TIẾN TRÌNH TRÊN ĐỈNH — phản hồi NGAY khi bấm bất kỳ link điều hướng nào.
//
// Vì sao cần (chủ dự án 18/08/2026: "mọi nút nhấn đều phải có đóng băng mỗi lần nhấn để thể hiện
// rằng đã nhận"): form server-action đã có spinner ở SubmitButton/ConfirmButton, nhưng <Link>
// điều hướng thì bấm xong màn hình đứng im vài trăm mili-giây tới cả giây trên VPS này — người
// dùng tưởng nút chết rồi bấm lại. Một thanh chạy ở đỉnh là dấu "đã nhận" phủ được MỌI link mà
// không phải sửa 52 chỗ.
//
// Cách chạy: bắt sự kiện click ở tầng document (capture) cho mọi thẻ <a> nội bộ → CHẠY thanh
// ngay lập tức. Khi pathname/searchParams đổi (điều hướng xong) → kéo về 100% rồi ẩn. Không kéo
// thư viện ngoài; CSP của app chặn CDN nên tự dựng là đúng hướng.
export function TopProgress() {
  const pathname = usePathname();
  const search = useSearchParams();
  const [width, setWidth] = useState(0);
  const [hien, setHien] = useState(false);
  const trickle = useRef<ReturnType<typeof setInterval> | null>(null);
  const anLuc = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Dọn timer khi rời trang.
  useEffect(() => {
    return () => {
      if (trickle.current) clearInterval(trickle.current);
      if (anLuc.current) clearTimeout(anLuc.current);
    };
  }, []);

  // Bấm một link nội bộ → khởi động thanh ngay. Nghe ở capture để chạy TRƯỚC khi Next bắt đầu
  // điều hướng, và trước cả handler nào gọi stopPropagation.
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      // Bỏ qua bấm chuột giữa/phải, giữ phím mở tab mới — những cái đó không đổi trang hiện tại.
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as Element | null)?.closest('a');
      if (!a) return;
      const href = a.getAttribute('href');
      if (!href || href.startsWith('#') || a.target === '_blank' || a.hasAttribute('download')) return;
      // Chỉ link NỘI BỘ (không http ngoài, không mailto/tel).
      if (/^([a-z]+:)?\/\//i.test(href) && !href.startsWith(location.origin)) return;
      if (/^(mailto|tel):/i.test(href)) return;
      batDau();
    };
    document.addEventListener('click', onClick, {capture: true});
    return () => document.removeEventListener('click', onClick, {capture: true});
  }, []);

  const batDau = () => {
    if (anLuc.current) clearTimeout(anLuc.current);
    if (trickle.current) clearInterval(trickle.current);
    setHien(true);
    setWidth(8);
    // Bò dần tới ~90% để "còn đang chạy", đừng chạm 100% khi chưa xong.
    trickle.current = setInterval(() => {
      setWidth((w) => (w < 90 ? w + (90 - w) * 0.12 : w));
    }, 200);
  };

  // Điều hướng xong (pathname/search đổi) → hoàn tất rồi ẩn.
  useEffect(() => {
    if (!hien) return;
    if (trickle.current) clearInterval(trickle.current);
    setWidth(100);
    anLuc.current = setTimeout(() => {
      setHien(false);
      setWidth(0);
    }, 260);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, search]);

  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-x-0 top-0 z-[100] h-[3px]"
      style={{opacity: hien ? 1 : 0, transition: 'opacity 200ms ease'}}
    >
      {/* scaleX thay cho width: chỉ chạy trên GPU (compositor), không bắt trình duyệt tính lại
          bố cục mỗi khung — thanh mượt cả trên máy yếu. transform-origin trái để bò từ mép trái. */}
      <div
        className="h-full w-full origin-left bg-gold shadow-[0_0_8px_var(--color-gold)]"
        style={{transform: `scaleX(${width / 100})`, transition: 'transform 200ms ease'}}
      />
    </div>
  );
}

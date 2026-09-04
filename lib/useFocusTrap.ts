import {useEffect, type RefObject} from 'react';

// Selector các phần tử có thể nhận focus trong modal.
const FOCUSABLE =
  'a[href],button:not([disabled]),textarea:not([disabled]),input:not([disabled]),select:not([disabled]),[tabindex]:not([tabindex="-1"])';

// Bẫy focus cho modal/dialog:
// - Khi mở: lưu phần tử đang focus, đưa focus vào phần tử focus-able đầu tiên (hoặc chính container).
// - Giữ Tab / Shift+Tab luẩn quẩn trong container (không lọt ra nền).
// - Khi đóng: trả focus về đúng phần tử đã mở modal.
// Container cần có tabIndex={-1} để làm fallback focus.
export function useFocusTrap(active: boolean, containerRef: RefObject<HTMLElement | null>, nutMoRef?: RefObject<HTMLElement | null>) {
  useEffect(() => {
    if (!active) return;
    const container = containerRef.current;
    if (!container) return;

    const previouslyFocused = (nutMoRef?.current ?? document.activeElement) as HTMLElement | null;
    // Nút mở popup thường bị UNMOUNT khi popup mở (server component render lại + useState) — audit
    // 04/09 đo 7/7 popup sau ESC focus rơi về <body>. Ghi lại "chữ ký" của nút để lúc đóng tìm lại
    // đúng nút mới cùng vai trò: data-mo-popup (nếu caller đặt) > aria-label > chữ trên nút.
    const chuKy = chuKyCua(previouslyFocused);

    const items = () =>
      Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
        (el) => el.offsetParent !== null,
      );

    // Đưa focus vào modal (phần tử đầu, hoặc container nếu chưa có gì focus-able).
    (items()[0] ?? container).focus();

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;
      const focusables = items();
      if (focusables.length === 0) {
        e.preventDefault();
        return;
      }
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const activeEl = document.activeElement;
      if (e.shiftKey && (activeEl === first || activeEl === container)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && activeEl === last) {
        e.preventDefault();
        first.focus();
      }
    };

    container.addEventListener('keydown', onKeyDown);
    return () => {
      container.removeEventListener('keydown', onKeyDown);
      // Trả focus về nút đã mở modal — hoặc nút thay thế nó nếu nút cũ đã rời DOM.
      const dich = previouslyFocused?.isConnected ? previouslyFocused : timLai(chuKy);
      // Đợi React dựng xong DOM sau khi popup unmount rồi mới focus (không thì nút mới chưa có).
      requestAnimationFrame(() => (dich?.isConnected ? dich : timLai(chuKy))?.focus?.());
    };
  }, [active, containerRef, nutMoRef]);
}

type ChuKy = {id: string | null; nhan: string | null; chu: string | null} | null;

function chuKyCua(el: HTMLElement | null): ChuKy {
  if (!el || el === document.body) return null;
  return {
    id: el.getAttribute('data-mo-popup'),
    nhan: el.getAttribute('aria-label'),
    chu: (el.textContent ?? '').trim().slice(0, 80) || null,
  };
}

function timLai(k: ChuKy): HTMLElement | null {
  if (!k) return null;
  if (k.id) {
    const el = document.querySelector<HTMLElement>(`[data-mo-popup="${CSS.escape(k.id)}"]`);
    if (el) return el;
  }
  const ungVien = Array.from(document.querySelectorAll<HTMLElement>('button,a[href],[tabindex]:not([tabindex="-1"])'))
    .filter((el) => el.offsetParent !== null);
  if (k.nhan) {
    const el = ungVien.find((e) => e.getAttribute('aria-label') === k.nhan);
    if (el) return el;
  }
  if (k.chu) {
    const el = ungVien.find((e) => (e.textContent ?? '').trim().slice(0, 80) === k.chu);
    if (el) return el;
  }
  return null;
}

import {useEffect, type RefObject} from 'react';

// Selector các phần tử có thể nhận focus trong modal.
const FOCUSABLE =
  'a[href],button:not([disabled]),textarea:not([disabled]),input:not([disabled]),select:not([disabled]),[tabindex]:not([tabindex="-1"])';

// Bẫy focus cho modal/dialog:
// - Khi mở: lưu phần tử đang focus, đưa focus vào phần tử focus-able đầu tiên (hoặc chính container).
// - Giữ Tab / Shift+Tab luẩn quẩn trong container (không lọt ra nền).
// - Khi đóng: trả focus về đúng phần tử đã mở modal.
// Container cần có tabIndex={-1} để làm fallback focus.
export function useFocusTrap(active: boolean, containerRef: RefObject<HTMLElement | null>) {
  useEffect(() => {
    if (!active) return;
    const container = containerRef.current;
    if (!container) return;

    const previouslyFocused = document.activeElement as HTMLElement | null;

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
      // Trả focus về nút đã mở modal (nếu còn trong DOM).
      previouslyFocused?.focus?.();
    };
  }, [active, containerRef]);
}

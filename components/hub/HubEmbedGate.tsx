'use client';

import {useEffect, useState} from 'react';
import {useTranslations} from 'next-intl';
import {Loader2} from 'lucide-react';

// BẮT TAY NHÚNG + ĐĂNG NHẬP QUA HUB (mục 3.2 + 6.2 bản đấu nối 25/08/2026).
//
// Component này chỉ LÀM VIỆC khi app đang chạy trong khung của Hub (cờ `data-hub-embed` do script
// beforeInteractive ở app/[locale]/layout.tsx đặt TRƯỚC khi trang này vẽ — xem globals.css). Người
// vào app trực tiếp (gõ thẳng class.truongvietanh.com) không chạy qua đây một dòng nào — luật ① CLAUDE.md
// "không đổi bố cục trang đăng nhập" áp dụng nguyên vẹn cho họ.
//
// Đặt trên TRANG LOGIN (không phải trong layout dashboard): mọi lượt vào app CHƯA có phiên đều bị
// middleware đẩy về /login trước tiên, bất kể Hub nhúng đường dẫn nào — nên đây là đúng MỘT chỗ
// cần bắt tay, không phải rải ra nhiều trang.
function b64url(buf: ArrayBuffer | Uint8Array): string {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function taoPkce(): Promise<{verifier: string; challenge: string}> {
  const verifier = b64url(crypto.getRandomValues(new Uint8Array(32)));
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier));
  return {verifier, challenge: b64url(digest)};
}

type State = 'idle' | 'connecting' | 'error' | 'no_account';

export function HubEmbedGate() {
  const t = useTranslations('login');
  const [state, setState] = useState<State>('idle');

  useEffect(() => {
    if (document.documentElement.dataset.hubEmbed !== '1') return; // không nhúng — không làm gì.

    const hubOrigin = process.env.NEXT_PUBLIC_HUB_ORIGIN;
    if (!hubOrigin) {
      // Biến môi trường thiếu là lỗi CẤU HÌNH của app này, không phải của Hub hay của người
      // dùng — báo lỗi chung, đừng để trang treo mãi ở "đang kết nối".
      setState('error');
      return;
    }

    let huy = false;
    let nhac: ReturnType<typeof setInterval> | null = null;

    async function batTay() {
      setState('connecting');
      const {verifier, challenge} = await taoPkce();

      const code = await new Promise<string | null>((resolve) => {
        function nghe(e: MessageEvent) {
          if (e.origin !== hubOrigin) return; // BẮT BUỘC — thiếu dòng này là lỗ hổng đánh cắp token.
          if (e.data?.type !== 'embed:token') return;
          if (nhac) clearInterval(nhac);
          window.removeEventListener('message', nghe);
          resolve(typeof e.data.code === 'string' ? e.data.code : null);
        }
        window.addEventListener('message', nghe);

        const gui = () =>
          window.parent.postMessage({type: 'embed:ready', codeChallenge: challenge}, hubOrigin!);
        gui();
        let lan = 0;
        nhac = setInterval(() => {
          if (++lan >= 20) {
            // ~14 giây rồi bỏ cuộc — trần 10 giây của Hub (mục 3.2) cộng thêm chút dư.
            if (nhac) clearInterval(nhac);
            window.removeEventListener('message', nghe);
            window.parent.postMessage({type: 'embed:error', reason: 'no_token'}, hubOrigin!);
            resolve(null);
          } else gui();
        }, 700);
      });

      if (huy) return;
      if (!code) {
        setState('error');
        return;
      }

      try {
        const r = await fetch('/api/hub/doi-ma', {
          method: 'POST',
          headers: {'content-type': 'application/json'},
          body: JSON.stringify({code, verifier}),
        });
        const data = (await r.json().catch(() => null)) as {redirectTo?: string; error?: string} | null;
        if (huy) return;
        if (r.ok && data?.redirectTo) {
          window.location.href = data.redirectTo;
          return; // đang điều hướng — không đổi state nữa.
        }
        setState(data?.error === 'no_matching_account' ? 'no_account' : 'error');
      } catch {
        if (!huy) setState('error');
      }
    }

    void batTay();
    return () => {
      huy = true;
      if (nhac) clearInterval(nhac);
    };
  }, []);

  if (state === 'idle') return null;

  return (
    <div
      data-hub-loading
      className="fixed inset-0 z-50 items-center justify-center bg-white"
      role="status"
      aria-live="polite"
    >
      <div className="flex max-w-[320px] flex-col items-center gap-3 px-6 text-center">
        {state === 'connecting' && (
          <>
            <Loader2 size={32} strokeWidth={2.5} className="animate-spin text-navy" />
            <p className="text-doc font-bold text-navy">{t('hubConnecting')}</p>
          </>
        )}
        {state === 'error' && (
          <>
            <p className="text-noi-dung font-semibold leading-relaxed text-navy">{t('hubError')}</p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="min-h-[44px] rounded-[12px] bg-navy px-4 text-than font-extrabold text-white"
            >
              {t('hubRetry')}
            </button>
          </>
        )}
        {state === 'no_account' && (
          <p className="text-noi-dung font-semibold leading-relaxed text-navy">{t('hubNoAccount')}</p>
        )}
      </div>
    </div>
  );
}

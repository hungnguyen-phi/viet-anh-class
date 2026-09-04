'use client';

import {useTransition} from 'react';
import {Languages} from 'lucide-react';
import {useLocale} from 'next-intl';
import {usePathname, useRouter} from '@/i18n/navigation';

// Nút chuyển ngôn ngữ vi <-> en, giữ nguyên đường dẫn hiện tại.
// Dùng trên trang auth/guide (nền gradient sáng) — glass-pill chữ navy, hover trắng.
export function LocaleSwitcher() {
  const locale = useLocale();
  const pathname = usePathname();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const other = locale === 'vi' ? 'en' : 'vi';

  return (
    <button
      type="button"
      aria-label="Switch language"
      disabled={isPending}
      onClick={() =>
        startTransition(() => router.replace(pathname, {locale: other}))
      }
      className="glass-pill inline-flex cursor-pointer items-center gap-1.5 rounded-full px-3 py-1.5 text-than font-extrabold text-navy ring-1 ring-navy/10 transition-colors hover:ring-navy/20 disabled:opacity-50"
    >
      <Languages size={16} strokeWidth={2} />
      {locale === 'vi' ? 'EN' : 'VI'}
    </button>
  );
}

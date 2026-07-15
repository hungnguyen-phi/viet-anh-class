'use client';

import {useTransition} from 'react';
import {useLocale} from 'next-intl';
import {usePathname, useRouter} from '@/i18n/navigation';

// Nút chuyển ngôn ngữ vi <-> en, giữ nguyên đường dẫn hiện tại.
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
      className="rounded-md border border-grey-line bg-white px-3 py-1.5 text-sm font-semibold text-navy transition-colors hover:bg-grey-light disabled:opacity-50"
    >
      {locale === 'vi' ? 'EN' : 'VI'}
    </button>
  );
}

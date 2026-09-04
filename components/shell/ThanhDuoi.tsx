'use client';

// THANH ĐIỀU HƯỚNG DƯỚI (điện thoại, < lg) — mobile-first cho 700 em dùng điện thoại (04/09/2026).
//
// Trên điện thoại, mọi mục nằm trong hamburger là hai chạm cho một việc làm hằng ngày. Thanh đáy
// đặt 4 mục hay đi nhất của mỗi vai ngay dưới ngón cái; phần còn lại vẫn ở menu ☰. Cao 56px +
// env(safe-area-inset-bottom) để không chìm dưới thanh home iPhone; <main> chừa đáy (pb-thanh-duoi
// ở layout) để nội dung cuối trang không bị che.
//
// Cùng bảng link/quyền với AppNav (LINKS) — nhận sẵn danh sách từ AppNav để không lặp luật vai.
import type {CSSProperties} from 'react';
import {useTranslations} from 'next-intl';
import {useLinkStatus} from 'next/link';
import {Loader2} from 'lucide-react';
import {Link, usePathname} from '@/i18n/navigation';
import type {ComponentType} from 'react';
type LucideIcon = ComponentType<{size?: number; strokeWidth?: number; className?: string}>;

export type MucThanhDuoi = {href: string; key: string; Icon: LucideIcon; badge?: number};

function Icon({Icon, size}: {Icon: LucideIcon; size: number}) {
  const {pending} = useLinkStatus();
  return pending ? <Loader2 size={size} strokeWidth={2} className="animate-spin" /> : <Icon size={size} strokeWidth={2} />;
}

export function ThanhDuoi({muc, giuLai}: {muc: MucThanhDuoi[]; giuLai: Record<string, string>}) {
  const t = useTranslations('nav');
  const pathname = usePathname();
  const isActive = (href: string) => (href === '/' ? pathname === '/' : pathname.startsWith(href));
  if (muc.length === 0) return null;

  return (
    <nav
      aria-label={t('thanhDuoi')}
      className="fixed inset-x-0 bottom-0 z-30 pb-safe lg:hidden [background:linear-gradient(0deg,rgba(255,255,255,0.98)_0%,rgba(255,255,255,0.92)_100%)] shadow-[0_-6px_24px_-8px_rgba(38,39,93,0.25)] backdrop-blur-md"
    >
      <ul className="mx-auto grid h-14 max-w-[640px]" style={{gridTemplateColumns: `repeat(${muc.length}, minmax(0, 1fr))`} as CSSProperties}>
        {muc.map(({href, key, Icon: I, badge}) => {
          const active = isActive(href);
          return (
            <li key={href} className="min-w-0">
              <Link
                href={{pathname: href, query: giuLai}}
                aria-current={active ? 'page' : undefined}
                aria-label={badge ? `${t(key)} (${badge})` : undefined}
                className={`relative flex h-14 min-w-0 flex-col items-center justify-center gap-0.5 px-1 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-gold ${
                  active ? 'text-navy' : 'text-navy/55 hover:text-navy'
                }`}
              >
                <span
                  className={`grid h-7 w-12 place-items-center rounded-full transition-colors ${
                    active ? 'bg-gold/30' : ''
                  }`}
                >
                  <Icon Icon={I} size={20} />
                </span>
                <span className="max-w-full truncate text-nhan font-extrabold uppercase tracking-wide">{t.has(`duoi.${key}`) ? t(`duoi.${key}`) : t(key)}</span>
                {badge != null && badge > 0 && (
                  <span className="absolute right-[calc(50%-1.75rem)] top-1 grid h-[17px] min-w-[17px] place-items-center rounded-full bg-gold px-1 font-display text-chu-thich font-bold text-navy ring-2 ring-white">
                    {badge > 99 ? '99+' : badge}
                  </span>
                )}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

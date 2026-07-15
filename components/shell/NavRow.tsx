'use client';

import {useTranslations} from 'next-intl';
import {Link, usePathname} from '@/i18n/navigation';

// Lưu ý: /meeting (Họp WIG) sẽ thêm ở M6 — chưa đưa vào nav để tránh link chết.
const LINKS: Record<string, {href: string; key: string}[]> = {
  teacher: [
    {href: '/', key: 'scoreboard'},
    {href: '/roster', key: 'roster'},
    {href: '/attendance', key: 'attendance'},
    {href: '/wig', key: 'wig'},
    {href: '/meeting', key: 'meeting'},
  ],
  student: [
    {href: '/', key: 'scoreboard'},
    {href: '/attendance', key: 'attendance'},
  ],
  admin: [
    {href: '/admin', key: 'admin'},
    {href: '/', key: 'scoreboard'},
    {href: '/roster', key: 'roster'},
    {href: '/attendance', key: 'attendance'},
    {href: '/wig', key: 'wig'},
    {href: '/meeting', key: 'meeting'},
  ],
  principal: [
    {href: '/campus', key: 'campus'},
    {href: '/', key: 'scoreboard'},
  ],
  parent: [{href: '/report', key: 'report'}],
};

export function NavRow({role}: {role: string}) {
  const t = useTranslations('nav');
  const pathname = usePathname();
  const links = LINKS[role] ?? [];
  if (links.length === 0) return null;

  return (
    <nav className="bg-navy-dark">
      <div className="mx-auto flex max-w-5xl gap-1 overflow-x-auto px-3 py-1.5">
        {links.map((l) => {
          const active =
            l.href === '/' ? pathname === '/' : pathname.startsWith(l.href);
          return (
            <Link
              key={l.href}
              href={l.href}
              className={`whitespace-nowrap rounded-md px-3 py-1.5 text-xs font-bold transition-colors ${
                active
                  ? 'bg-gold text-navy'
                  : 'text-white/80 hover:bg-white/10'
              }`}
            >
              {t(l.key)}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

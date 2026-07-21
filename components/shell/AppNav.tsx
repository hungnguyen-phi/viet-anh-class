'use client';

import {useTransition, type ComponentType} from 'react';
import {useTranslations, useLocale} from 'next-intl';
import {Link, usePathname, useRouter} from '@/i18n/navigation';
import {signOut} from '@/lib/auth-actions';
import type {Profile} from '@/lib/auth';
import {isoWeekLabel} from '@/lib/dates';
import {
  LayoutDashboard,
  Users,
  ClipboardCheck,
  Target,
  MessagesSquare,
  ShieldCheck,
  Building2,
  LineChart,
  BookOpen,
  LogOut,
  Languages,
} from 'lucide-react';

type IconType = ComponentType<{size?: number; strokeWidth?: number; className?: string}>;
type NavItem = {href: string; key: string; Icon: IconType};

// Bộ link + quyền theo vai trò (giữ nguyên logic phân quyền cũ).
const LINKS: Record<string, NavItem[]> = {
  teacher: [
    {href: '/', key: 'scoreboard', Icon: LayoutDashboard},
    {href: '/roster', key: 'roster', Icon: Users},
    {href: '/attendance', key: 'attendance', Icon: ClipboardCheck},
    {href: '/wig', key: 'wig', Icon: Target},
    {href: '/meeting', key: 'meeting', Icon: MessagesSquare},
  ],
  admin: [
    {href: '/admin', key: 'admin', Icon: ShieldCheck},
    {href: '/', key: 'scoreboard', Icon: LayoutDashboard},
    {href: '/roster', key: 'roster', Icon: Users},
    {href: '/attendance', key: 'attendance', Icon: ClipboardCheck},
    {href: '/wig', key: 'wig', Icon: Target},
    {href: '/meeting', key: 'meeting', Icon: MessagesSquare},
  ],
  principal: [
    {href: '/campus', key: 'campus', Icon: Building2},
    {href: '/', key: 'scoreboard', Icon: LayoutDashboard},
  ],
  parent: [{href: '/report', key: 'report', Icon: LineChart}],
  // Học sinh thường chỉ thấy scoreboard cá nhân; tổ trưởng được thêm Điểm danh.
  student: [{href: '/student', key: 'myScoreboard', Icon: LayoutDashboard}],
};

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function AppNav({
  profile,
  isAttendanceLeader = false,
}: {
  profile: Profile;
  isAttendanceLeader?: boolean;
}) {
  const t = useTranslations('nav');
  const tr = useTranslations('roles');
  const tc = useTranslations('common');
  const pathname = usePathname();

  const role = profile.role;
  const baseLinks = LINKS[role] ?? [];
  const links =
    role === 'student' && isAttendanceLeader
      ? [...baseLinks, {href: '/attendance', key: 'attendance', Icon: ClipboardCheck}]
      : baseLinks;

  const displayName = profile.full_name ?? profile.email;
  const weekLabel = isoWeekLabel(new Date());

  return (
    <div className="sticky top-0 z-20 px-4 pb-2.5 pt-3.5 sm:px-6 [background:linear-gradient(180deg,rgba(235,240,236,0.95)_0%,rgba(235,240,236,0.75)_70%,rgba(235,240,236,0)_100%)]">
      <div className="glass-strong mx-auto flex max-w-[1160px] flex-wrap items-center gap-x-3.5 gap-y-2 rounded-[20px] px-3.5 py-2">
        {/* Logo + tên */}
        <Link href="/" className="flex min-w-0 items-center gap-2.5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/logo-viet-anh.jpg"
            alt="Logo Việt Anh"
            className="h-8 w-8 shrink-0 rounded-full border-[1.5px] border-white/90 bg-white object-cover shadow-[0_2px_8px_rgba(38,39,93,0.15)]"
          />
          <span className="whitespace-nowrap font-display text-[16px] font-bold text-navy">
            Việt Anh Class
          </span>
        </Link>

        {/* Nav tabs */}
        <nav className="ml-2 flex flex-wrap items-center gap-1">
          {links.map(({href, key, Icon}) => {
            const active = href === '/' ? pathname === '/' : pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? 'page' : undefined}
                className={`inline-flex h-[38px] items-center gap-[7px] whitespace-nowrap rounded-xl px-3.5 text-[13px] font-extrabold transition-all ${
                  active
                    ? 'bg-white/65 text-navy shadow-[inset_0_1px_0_rgba(255,255,255,0.95),0_4px_12px_rgba(38,39,93,0.12)]'
                    : 'text-navy/50 hover:text-navy'
                }`}
              >
                <Icon size={16} strokeWidth={2} />
                {t(key)}
              </Link>
            );
          })}
        </nav>

        <span className="flex-1" />

        {/* Tuần hiện tại */}
        <span className="glass-pill hidden whitespace-nowrap rounded-full px-3 py-[5px] text-[11.5px] font-extrabold text-navy sm:inline">
          {weekLabel}
        </span>

        {/* Người dùng */}
        <span className="glass-pill inline-flex items-center gap-2 rounded-full py-1 pl-1 pr-3">
          <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-linear-to-b from-gold-soft to-gold font-display text-[11px] font-bold text-navy">
            {initialsOf(displayName)}
          </span>
          <span className="min-w-0">
            <span className="block max-w-[140px] truncate text-[12.5px] font-extrabold leading-tight text-navy">
              {displayName}
            </span>
            <span className="block text-[9.5px] font-extrabold uppercase tracking-wide text-gold-deep">
              {tr(role)}
            </span>
          </span>
        </span>

        {/* Hành động: hướng dẫn · đổi ngôn ngữ · đăng xuất */}
        <div className="flex items-center gap-1.5">
          <Link
            href="/guide"
            aria-label={tc('guide')}
            title={tc('guide')}
            className="grid h-9 w-9 place-items-center rounded-full text-navy/60 transition-colors hover:bg-white/60 hover:text-navy"
          >
            <BookOpen size={17} strokeWidth={2} />
          </Link>
          <LocaleToggle />
          <form action={signOut}>
            <button
              type="submit"
              aria-label={tc('logout')}
              title={tc('logout')}
              className="grid h-9 w-9 cursor-pointer place-items-center rounded-full text-navy/60 transition-colors hover:bg-white/60 hover:text-navy"
            >
              <LogOut size={17} strokeWidth={2} />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

function LocaleToggle() {
  const locale = useLocale();
  const pathname = usePathname();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const other = locale === 'vi' ? 'en' : 'vi';

  return (
    <button
      type="button"
      aria-label="Đổi ngôn ngữ"
      disabled={isPending}
      onClick={() => startTransition(() => router.replace(pathname, {locale: other}))}
      className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-full px-3 text-[12px] font-extrabold text-navy/60 transition-colors hover:bg-white/60 hover:text-navy disabled:opacity-50"
    >
      <Languages size={16} strokeWidth={2} />
      {locale === 'vi' ? 'EN' : 'VI'}
    </button>
  );
}

'use client';

import {useState, useTransition, type ComponentType} from 'react';
import {useTranslations, useLocale} from 'next-intl';
import {Link, usePathname, useRouter} from '@/i18n/navigation';
import {signOut} from '@/lib/auth-actions';
import type {Profile} from '@/lib/auth';
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
  Menu,
  X,
  Languages,
} from 'lucide-react';

type NavItem = {href: string; key: string; Icon: ComponentType<{size?: number; strokeWidth?: number; className?: string}>};

// Cùng bộ link/quyền như bản cũ, nay kèm icon (không dùng emoji).
const LINKS: Record<string, NavItem[]> = {
  teacher: [
    {href: '/', key: 'scoreboard', Icon: LayoutDashboard},
    {href: '/roster', key: 'roster', Icon: Users},
    {href: '/attendance', key: 'attendance', Icon: ClipboardCheck},
    {href: '/wig', key: 'wig', Icon: Target},
    {href: '/meeting', key: 'meeting', Icon: MessagesSquare},
  ],
  // Học sinh thường CHỈ thấy scoreboard cá nhân của mình — không có gì của cả lớp.
  // Link "Điểm danh" chỉ thêm cho tổ trưởng điểm danh (xử lý trong AppNav).
  student: [{href: '/student', key: 'myScoreboard', Icon: LayoutDashboard}],
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
};

// Nền sidebar: navy gradient dọc + quầng gold rất nhẹ phía trên (chiều sâu, không lòe loẹt).
const SIDEBAR_BG =
  '[background:radial-gradient(28rem_16rem_at_50%_-8rem,rgba(249,221,14,0.10),transparent_60%),linear-gradient(180deg,#2c2e6e_0%,#26275d_45%,#1b1c45_100%)]';

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
  const role = profile.role;
  const baseLinks = LINKS[role] ?? [];
  // Tổ trưởng điểm danh (là học sinh) được thêm link Điểm danh — nhiệm vụ lớp giao.
  const links =
    role === 'student' && isAttendanceLeader
      ? [...baseLinks, {href: '/attendance', key: 'attendance', Icon: ClipboardCheck}]
      : baseLinks;
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* Sidebar cố định — desktop */}
      <aside
        className={`fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-white/[0.06] px-4 py-5 lg:flex ${SIDEBAR_BG}`}
      >
        <NavBody profile={profile} links={links} />
      </aside>

      {/* Thanh trên — mobile */}
      <header className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-white/10 bg-navy-dark/90 px-4 py-2.5 text-white backdrop-blur-md lg:hidden">
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Mở menu điều hướng"
          className="grid h-10 w-10 cursor-pointer place-items-center rounded-xl text-white/85 transition-colors hover:bg-white/10"
        >
          <Menu size={20} strokeWidth={2} />
        </button>
        <Brand />
        <form action={signOut}>
          <button
            type="submit"
            aria-label="Đăng xuất"
            className="grid h-10 w-10 cursor-pointer place-items-center rounded-xl text-white/85 transition-colors hover:bg-white/10"
          >
            <LogOut size={18} strokeWidth={2} />
          </button>
        </form>
      </header>

      {/* Drawer — mobile */}
      {open && (
        <div className="lg:hidden">
          <button
            type="button"
            aria-label="Đóng menu"
            onClick={() => setOpen(false)}
            className="animate-fade fixed inset-0 z-40 cursor-pointer bg-navy-900/70 backdrop-blur-sm"
          />
          <aside
            className={`animate-slide-in fixed inset-y-0 left-0 z-50 flex w-72 max-w-[82%] flex-col rounded-r-3xl px-4 py-5 shadow-pop ${SIDEBAR_BG}`}
          >
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Đóng menu"
              className="absolute right-3 top-4 grid h-9 w-9 cursor-pointer place-items-center rounded-xl text-white/70 transition-colors hover:bg-white/10 hover:text-white"
            >
              <X size={18} strokeWidth={2} />
            </button>
            <NavBody profile={profile} links={links} onNavigate={() => setOpen(false)} />
          </aside>
        </div>
      )}
    </>
  );
}

function Brand() {
  const t = useTranslations('app');
  return (
    <div className="flex items-center gap-2.5">
      <span className="flex h-9 w-8 shrink-0 items-center justify-center rounded-b-[40%] rounded-t-md bg-linear-to-b from-gold-soft to-gold font-heading text-[13px] font-black text-navy shadow-[0_2px_8px_rgba(249,221,14,0.35)]">
        VA
      </span>
      <span className="font-heading text-[15px] font-extrabold leading-tight text-white">
        {t('name')}
      </span>
    </div>
  );
}

function NavBody({
  profile,
  links,
  onNavigate,
}: {
  profile: Profile;
  links: NavItem[];
  onNavigate?: () => void;
}) {
  const t = useTranslations('nav');
  const tr = useTranslations('roles');
  const tc = useTranslations('common');
  const pathname = usePathname();

  const displayName = profile.full_name ?? profile.email;

  return (
    <div className="flex h-full flex-col">
      <div className="px-1.5 pb-4">
        <Brand />
      </div>

      <nav className="flex flex-1 flex-col gap-1 overflow-y-auto border-t border-white/[0.08] pt-4">
        {links.map(({href, key, Icon}) => {
          const active = href === '/' ? pathname === '/' : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              onClick={onNavigate}
              aria-current={active ? 'page' : undefined}
              className={`group relative flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-semibold transition-colors duration-200 ${
                active
                  ? 'bg-white/[0.12] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] ring-1 ring-white/[0.08]'
                  : 'text-white/65 hover:bg-white/[0.06] hover:text-white'
              }`}
            >
              <span
                aria-hidden
                className={`absolute left-0 top-1/2 h-5 w-1 -translate-y-1/2 rounded-full bg-gold transition-all duration-200 ${
                  active ? 'scale-y-100 opacity-100' : 'scale-y-0 opacity-0 group-hover:scale-y-75 group-hover:opacity-60'
                }`}
              />
              <Icon
                size={18}
                strokeWidth={2}
                className={`shrink-0 transition-colors duration-200 ${
                  active ? 'text-gold' : 'text-white/50 group-hover:text-white/90'
                }`}
              />
              <span className="truncate transition-transform duration-200 group-hover:translate-x-0.5">
                {t(key)}
              </span>
            </Link>
          );
        })}
      </nav>

      {/* Footer: thẻ người dùng + hành động */}
      <div className="mt-4 space-y-2.5">
        <div className="flex items-center gap-2.5 rounded-2xl bg-white/[0.06] p-2.5 ring-1 ring-white/[0.08]">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-linear-to-b from-gold-soft to-gold font-heading text-xs font-black text-navy">
            {initialsOf(displayName)}
          </span>
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold text-white">{displayName}</div>
            <div className="truncate text-[11px] font-medium uppercase tracking-wide text-gold/80">
              {tr(profile.role)}
            </div>
          </div>
        </div>

        <div className="space-y-1.5">
          <Link
            href="/guide"
            onClick={onNavigate}
            className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold text-white/70 transition-colors hover:bg-white/[0.08] hover:text-white"
          >
            <BookOpen size={15} strokeWidth={2} className="shrink-0" />
            {tc('guide')}
          </Link>
          <div className="flex items-center gap-1.5">
            <LocaleToggle />
            <form action={signOut} className="flex-1">
              <button
                type="submit"
                className="flex w-full cursor-pointer items-center justify-center gap-1.5 rounded-xl bg-white/[0.06] px-2 py-2 text-xs font-semibold text-white/70 ring-1 ring-white/[0.06] transition-colors hover:bg-white/[0.12] hover:text-white"
              >
                <LogOut size={15} strokeWidth={2} />
                {tc('logout')}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}

// Toggle ngôn ngữ tối giản, hợp nền navy (không tái dùng LocaleSwitcher nền sáng).
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
      className="flex flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-xl bg-white/[0.06] px-2 py-2 text-xs font-semibold text-white/70 ring-1 ring-white/[0.06] transition-colors hover:bg-white/[0.12] hover:text-white disabled:opacity-50"
    >
      <Languages size={15} strokeWidth={2} />
      {locale === 'vi' ? 'EN' : 'VI'}
    </button>
  );
}

'use client';

import {
  useEffect,
  useRef,
  useState,
  useTransition,
  type ComponentType,
  type CSSProperties,
} from 'react';
import {useTranslations, useLocale} from 'next-intl';
import {useLinkStatus} from 'next/link';
import {Link, usePathname, useRouter} from '@/i18n/navigation';
import {signOut} from '@/lib/auth-actions';
import type {Profile} from '@/lib/auth';
import {isoWeekLabel} from '@/lib/dates';
import {
  LayoutDashboard,
  Users,
  ClipboardCheck,
  Target,
  ShieldCheck,
  Building2,
  LineChart,
  LogOut,
  Languages,
  Trophy,
  CalendarDays,
  Bell,
  Settings,
  Loader2,
  Menu,
  X,
} from 'lucide-react';

type IconType = ComponentType<{size?: number; strokeWidth?: number; className?: string}>;
type NavItem = {href: string; key: string; Icon: IconType};

// Icon của tab: đổi thành spinner trong lúc điều hướng chưa xong.
// Trang dashboard là force-dynamic nên mỗi lần đổi trang server phải render lại (~1-2s) — không có
// phản hồi gì thì người dùng tưởng nút không ăn rồi bấm lại. useLinkStatus phải được gọi TRONG
// component con của <Link> mới nhận được trạng thái pending của chính link đó.
function NavIcon({Icon, size}: {Icon: IconType; size: number}) {
  const {pending} = useLinkStatus();
  return pending ? (
    <Loader2 size={size} strokeWidth={2} className="animate-spin" />
  ) : (
    <Icon size={size} strokeWidth={2} />
  );
}

// Bộ link + quyền theo vai trò (giữ nguyên logic phân quyền cũ).
const LINKS: Record<string, NavItem[]> = {
  teacher: [
    {href: '/', key: 'scoreboard', Icon: LayoutDashboard},
    {href: '/roster', key: 'roster', Icon: Users},
    {href: '/attendance', key: 'attendance', Icon: ClipboardCheck},
    // "Họp WIG" đã gộp vào /wig (ClassMeetingSection) → bớt 1 tab cho GVCN.
    {href: '/wig', key: 'wig', Icon: Target},
    {href: '/scoreboard', key: 'compete', Icon: Trophy},
    {href: '/timetable', key: 'schedule', Icon: CalendarDays},
  ],
  admin: [
    {href: '/admin', key: 'admin', Icon: ShieldCheck},
    {href: '/', key: 'scoreboard', Icon: LayoutDashboard},
    {href: '/roster', key: 'roster', Icon: Users},
    {href: '/attendance', key: 'attendance', Icon: ClipboardCheck},
    {href: '/wig', key: 'wig', Icon: Target},
    {href: '/scoreboard', key: 'compete', Icon: Trophy},
    {href: '/timetable', key: 'schedule', Icon: CalendarDays},
  ],
  // BGH làm việc ở CẤP TRƯỜNG, không phải cấp lớp.
  //
  // Trước đây menu này có 6 mục thì 5 mục là view của ĐÚNG MỘT LỚP — lớp đầu tiên sắp theo tên,
  // do getMyClass() chọn hộ. Hiệu trưởng bấm "Thi đua" ra bảng của một lớp ngẫu nhiên trong cơ
  // sở, hoàn toàn vô nghĩa ở cấp quản lý.
  //
  // Nay /campus là bảng TỔNG HỢP toàn trường (khối → lớp → tổng), và muốn xem một lớp cụ thể thì
  // bấm thẳng dòng lớp đó. Vì vậy bỏ khỏi menu: "/" và "/scoreboard" (đều là bảng điểm 1 lớp,
  // nay nằm trong bảng tổng hợp) và "/meeting" (biên bản họp WIG là nghi thức 4DX CẤP LỚP).
  //
  // GIỮ /roster và /timetable vì hai trang này nhận ?class= nên vẫn là đích hợp lệ khi đi sâu
  // vào một lớp, và chúng tự hiện ClassPicker khi có nhiều lớp.
  principal: [
    {href: '/campus', key: 'campus', Icon: Building2},
    {href: '/roster', key: 'roster', Icon: Users},
    {href: '/timetable', key: 'schedule', Icon: CalendarDays},
  ],
  parent: [
    {href: '/report', key: 'report', Icon: LineChart},
  ],
  // Học sinh thường chỉ thấy scoreboard cá nhân; tổ trưởng được thêm Điểm danh.
  student: [
    {href: '/student', key: 'myScoreboard', Icon: LayoutDashboard},
    {href: '/timetable', key: 'schedule', Icon: CalendarDays},
  ],
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
  unreadCount = 0,
}: {
  profile: Profile;
  isAttendanceLeader?: boolean;
  // Số thông báo chưa đọc — hiện thành badge trên chuông (thay cho tab "Thông báo" cũ).
  unreadCount?: number;
}) {
  const t = useTranslations('nav');
  const tr = useTranslations('roles');
  const tc = useTranslations('common');
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const role = profile.role;
  const baseLinks = LINKS[role] ?? [];
  const links =
    role === 'student' && isAttendanceLeader
      ? [...baseLinks, {href: '/attendance', key: 'attendance', Icon: ClipboardCheck}]
      : baseLinks;

  const displayName = profile.full_name ?? profile.email;
  const weekLabel = isoWeekLabel(new Date());

  const isActive = (href: string) => (href === '/' ? pathname === '/' : pathname.startsWith(href));
  const activeItem = links.find((l) => isActive(l.href));

  // Đóng menu mobile mỗi khi đổi trang.
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  return (
    <div className="sticky top-0 z-20 px-4 pb-2.5 pt-3.5 sm:px-6 [background:linear-gradient(180deg,rgba(255,255,255,0.98)_0%,rgba(255,255,255,0.85)_70%,rgba(255,255,255,0)_100%)]">
      {/* Bar full-width navy. Desktop (lg+): logo | tabs | cụm phải. Mobile (<lg): logo | tên trang | hamburger. */}
      <div className="flex w-full items-center gap-3 rounded-[24px] bg-[linear-gradient(180deg,#2f3170,#26275d)] px-3.5 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.1),0_10px_28px_-6px_rgba(38,39,93,0.5)] ring-1 ring-white/10">
        {/* Logo + tên */}
        <Link href="/" className="flex shrink-0 items-center gap-2.5" onClick={() => setOpen(false)}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/logo-viet-anh.jpg"
            alt="Logo Việt Anh"
            className="h-8 w-8 shrink-0 rounded-full border-[1.5px] border-white/90 bg-white object-cover shadow-[0_2px_8px_rgba(38,39,93,0.15)]"
          />
          <span className="hidden whitespace-nowrap font-display text-[16px] font-bold text-white sm:inline">
            Việt Anh Class
          </span>
        </Link>

        {/* Desktop: nav tabs — chỉ hiện từ lg, cuộn ngang khi hẹp */}
        <nav className="hidden min-w-0 flex-1 items-center gap-1 overflow-x-auto [scrollbar-width:none] lg:flex [&::-webkit-scrollbar]:hidden">
          {links.map(({href, key, Icon}) => {
            const active = isActive(href);
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? 'page' : undefined}
                className={`inline-flex h-11 shrink-0 items-center gap-[7px] whitespace-nowrap rounded-xl px-3.5 text-[13px] font-extrabold transition-all ${
                  active
                    ? 'bg-white text-navy shadow-[0_4px_12px_-2px_rgba(0,0,0,0.28)]'
                    : 'text-white/75 hover:bg-white/10 hover:text-white'
                }`}
              >
                <NavIcon Icon={Icon} size={16} />
                {t(key)}
              </Link>
            );
          })}
        </nav>

        {/* Desktop: cụm phải — chỉ hiện từ lg */}
        <div className="hidden shrink-0 items-center gap-1.5 lg:flex">
          {/* Tuần hiện tại */}
          <span className="hidden whitespace-nowrap rounded-full bg-white/10 px-3 py-[5px] text-[11.5px] font-extrabold text-white/90 ring-1 ring-white/15 lg:inline">
            {weekLabel}
          </span>

          {/* Người dùng */}
          <span className="inline-flex items-center gap-2 rounded-full bg-white/10 py-1 pl-1 pr-3 ring-1 ring-white/15">
            <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-linear-to-b from-gold-soft to-gold font-display text-[11px] font-bold text-navy">
              {initialsOf(displayName)}
            </span>
            <span className="block min-w-0">
              <span className="block max-w-[140px] truncate text-[12.5px] font-extrabold leading-tight text-white">
                {displayName}
              </span>
              <span className="block text-[9.5px] font-extrabold uppercase tracking-wide text-gold-soft">
                {tr(role)}
              </span>
            </span>
          </span>

          {/* Chuông + Cài đặt. Trước đây "Thông báo" là một tab trong thanh nav, mà GVCN có 8 tab
              nên chữ bị đè nhau; nay gom thành 2 icon ở góc, và ngôn ngữ/đăng xuất vào Cài đặt. */}
          <BellLink href="/notifications" count={unreadCount} label={t('notifications')} active={isActive('/notifications')} />
          <SettingsMenu />
        </div>

        {/* Mobile (<lg): tên trang hiện tại + chuông + hamburger.
            Chuông phải nằm ngoài drawer vì "Thông báo" không còn là tab trong danh sách trang. */}
        <div className="flex flex-1 items-center gap-2 lg:hidden">
          <span className="min-w-0 flex-1 truncate font-display text-[15px] font-bold text-white sm:opacity-0">
            {activeItem ? t(activeItem.key) : ''}
          </span>
          <BellLink
            href="/notifications"
            count={unreadCount}
            label={t('notifications')}
            active={isActive('/notifications')}
            onNavigate={() => setOpen(false)}
          />
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-label="Menu"
            aria-expanded={open}
            className="grid h-9 w-9 shrink-0 cursor-pointer place-items-center rounded-full text-white/80 transition-colors hover:bg-white/10 hover:text-white"
          >
            {open ? <X size={20} strokeWidth={2.2} /> : <Menu size={20} strokeWidth={2.2} />}
          </button>
        </div>
      </div>

      {/* Mobile: drawer menu dọc — hiện đầy đủ mục, touch target lớn */}
      {open && (
        <div className="mt-2 lg:hidden">
          <div className="glass-strong animate-drawer rounded-[20px] p-2.5">
            {/* Người dùng + tuần */}
            <div className="flex items-center gap-3 rounded-2xl px-2.5 py-2">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-linear-to-b from-gold-soft to-gold font-display text-[13px] font-bold text-navy">
                {initialsOf(displayName)}
              </span>
              <div className="min-w-0 flex-1">
                <div className="truncate text-[14px] font-extrabold leading-tight text-navy">
                  {displayName}
                </div>
                <div className="text-[10.5px] font-extrabold uppercase tracking-wide text-gold-deep">
                  {tr(role)}
                </div>
              </div>
              <span className="glass-pill shrink-0 whitespace-nowrap rounded-full px-3 py-[5px] text-[11.5px] font-extrabold text-navy">
                {weekLabel}
              </span>
            </div>

            {/* Danh sách trang */}
            <nav className="mt-1.5 grid gap-0.5">
              {links.map(({href, key, Icon}, i) => {
                const active = isActive(href);
                return (
                  <Link
                    key={href}
                    href={href}
                    onClick={() => setOpen(false)}
                    aria-current={active ? 'page' : undefined}
                    style={{'--i': i} as CSSProperties}
                    className={`animate-item flex items-center gap-3 rounded-xl px-3 py-2.5 text-[14.5px] font-extrabold transition-colors ${
                      active
                        ? 'bg-white/70 text-navy shadow-[inset_0_1px_0_rgba(255,255,255,0.95),0_4px_12px_rgba(38,39,93,0.10)]'
                        : 'text-navy/60 hover:bg-white/50 hover:text-navy'
                    }`}
                  >
                    <NavIcon Icon={Icon} size={18} />
                    {t(key)}
                  </Link>
                );
              })}
            </nav>

            {/* Tiện ích: ngôn ngữ · đăng xuất (đã bỏ nút Hướng dẫn theo yêu cầu) */}
            <div className="mt-2 flex items-center gap-1.5 border-t border-navy/[0.08] pt-2">
              <LocaleToggle className="flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-xl px-2 py-2.5 text-[13px] font-extrabold text-navy/70 transition-colors hover:bg-white/50 hover:text-navy disabled:opacity-50" />
              <form action={signOut} className="flex-1">
                <button
                  type="submit"
                  className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl px-2 py-2.5 text-[13px] font-extrabold text-navy/70 transition-colors hover:bg-white/50 hover:text-navy"
                >
                  <LogOut size={16} strokeWidth={2} />
                  {tc('logout')}
                </button>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Chuông thông báo + badge số chưa đọc. Dùng cả ở cụm phải desktop và thanh mobile.
function BellLink({
  href,
  count,
  label,
  active,
  onNavigate,
}: {
  href: string;
  count: number;
  label: string;
  active: boolean;
  onNavigate?: () => void;
}) {
  return (
    <Link
      href={href}
      onClick={onNavigate}
      aria-label={count > 0 ? `${label} (${count})` : label}
      title={label}
      aria-current={active ? 'page' : undefined}
      className={`relative grid h-9 w-9 shrink-0 place-items-center rounded-full transition-colors ${
        active ? 'bg-white text-navy' : 'text-white/70 hover:bg-white/10 hover:text-white'
      }`}
    >
      <Bell size={17} strokeWidth={2} />
      {count > 0 && (
        <span className="absolute -right-0.5 -top-0.5 grid h-[17px] min-w-[17px] place-items-center rounded-full bg-gold px-1 font-display text-[10px] font-bold text-navy ring-2 ring-navy">
          {count > 99 ? '99+' : count}
        </span>
      )}
    </Link>
  );
}

// Cài đặt: gom đổi ngôn ngữ + đăng xuất vào một chỗ (trước đây là 3 icon rời trên thanh).
function SettingsMenu() {
  const tc = useTranslations('common');
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  // Bấm ra ngoài hoặc Esc thì đóng — menu này không phải modal nên không bẫy focus.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    window.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const item =
    'flex w-full cursor-pointer items-center gap-2 rounded-xl px-3 py-2 text-left text-[13px] font-extrabold text-navy/75 transition-colors hover:bg-navy/[0.06] hover:text-navy';

  return (
    <div ref={boxRef} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={tc('settings')}
        title={tc('settings')}
        aria-expanded={open}
        aria-haspopup="menu"
        className={`grid h-9 w-9 cursor-pointer place-items-center rounded-full transition-colors ${
          open ? 'bg-white text-navy' : 'text-white/70 hover:bg-white/10 hover:text-white'
        }`}
      >
        <Settings size={17} strokeWidth={2} />
      </button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 top-[calc(100%+8px)] z-30 w-[188px] rounded-[16px] bg-white p-1.5 shadow-pop ring-1 ring-navy/10"
        >
          <LocaleToggle className={item} withLabel />
          <form action={signOut}>
            <button type="submit" className={item} role="menuitem">
              <LogOut size={16} strokeWidth={2} />
              {tc('logout')}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}

function LocaleToggle({className, withLabel}: {className?: string; withLabel?: boolean}) {
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
      className={
        className ??
        'inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-full px-3 text-[12px] font-extrabold text-white/70 transition-colors hover:bg-white/10 hover:text-white disabled:opacity-50'
      }
    >
      <Languages size={16} strokeWidth={2} />
      {/* Trong menu Cài đặt thì ghi rõ "Ngôn ngữ: EN"; trên thanh thì chỉ 2 chữ cho gọn. */}
      {withLabel ? `${tcLabel(locale)}: ${locale === 'vi' ? 'EN' : 'VI'}` : locale === 'vi' ? 'EN' : 'VI'}
    </button>
  );
}

// Nhãn "Ngôn ngữ" theo locale đang dùng — tránh phải truyền thêm hook vào LocaleToggle.
function tcLabel(locale: string): string {
  return locale === 'vi' ? 'Ngôn ngữ' : 'Language';
}

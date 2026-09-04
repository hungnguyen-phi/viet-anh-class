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
import {HOC_BA_BAT} from '@/lib/tinh-nang';
import {NapTruoc} from '@/components/shell/NapTruoc';
import {useLinkStatus} from 'next/link';
import {useSearchParams} from 'next/navigation';
import {Link, usePathname, useRouter} from '@/i18n/navigation';
import {signOut} from '@/lib/auth-actions';
import type {Profile} from '@/lib/auth';
import {tenHienThi} from '@/lib/ten-hien-thi';
import {
  Bell,
  BookOpenCheck,
  Building2,
  CalendarDays,
  ClipboardCheck,
  GraduationCap,
  Languages,
  LayoutDashboard,
  LineChart,
  Loader2,
  LogOut,
  Menu,
  MessageCircle,
  
  Settings,
  ShieldCheck,
  Target,
  Users,
  UtensilsCrossed,
  X,
} from 'lucide-react';

type IconType = ComponentType<{size?: number; strokeWidth?: number; className?: string}>;
type NavItem = {href: string; key: string; Icon: IconType};

// Link ở đây lấy từ @/i18n/navigation — bản bọc đã TẮT prefetch mặc định (xem lý do trong file
// đó). Thanh nav hưởng lợi nhiều nhất: nó luôn hiện trên màn, nên trước đây mở bất kỳ trang nào
// cũng bắn đồng loạt một lượt prefetch cho TẤT CẢ tab, mỗi lượt bắt server render lại layout
// dashboard kèm truy vấn Supabase — tranh tài nguyên với đúng trang người dùng đang chờ.

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
//
// NGÂN SÁCH CHỖ — đọc docs/NAV_IA.md trước khi thêm tab. Thanh nav là overflow-x-auto với thanh
// cuộn ẨN: quá chỗ thì tab bị đẩy ra ngoài màn hình mà không có dấu hiệu nào. Chuyện này đã xảy
// ra một lần (xem comment ở cụm phải, chỗ chuông thông báo). Đo trên máy 1366px thì chỉ còn chỗ
// cho khoảng hai tab nữa. Nên đợt 7 tính năng này chỉ được thêm ĐÚNG hai tab; "Liên lạc" xuống
// làm icon, "Thực đơn" và "Hình ảnh" vào thẳng trang liên quan.
const LINKS: Record<string, NavItem[]> = {
  teacher: [
    {href: '/', key: 'scoreboard', Icon: LayoutDashboard},
    {href: '/roster', key: 'roster', Icon: Users},
    {href: '/attendance', key: 'attendance', Icon: ClipboardCheck},
    {href: '/grades', key: 'grades', Icon: GraduationCap},
    // "Họp WIG" đã gộp vào /wig (ClassMeetingSection) → bớt 1 tab cho GVCN.
    {href: '/wig', key: 'wig', Icon: Target},
    {href: '/timetable', key: 'schedule', Icon: CalendarDays},
  ],
  admin: [
    {href: '/admin', key: 'admin', Icon: ShieldCheck},
    {href: '/', key: 'scoreboard', Icon: LayoutDashboard},
    {href: '/roster', key: 'roster', Icon: Users},
    {href: '/attendance', key: 'attendance', Icon: ClipboardCheck},
    {href: '/grades', key: 'grades', Icon: GraduationCap},
    {href: '/wig', key: 'wig', Icon: Target},
    // Mục tiêu TRƯỜNG (0181) — đích trên cùng của chuỗi hội tụ, chỉ admin/BGH ghi được.
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
  // Thêm "Học bạ": ban giám hiệu tự xin — "biết các thông tin về điểm số, rèn luyện của học
  // sinh". Họ chỉ XEM, RLS chặn mọi đường ghi.
  principal: [
    {href: '/campus', key: 'campus', Icon: Building2},
    {href: '/roster', key: 'roster', Icon: Users},
    {href: '/grades', key: 'grades', Icon: GraduationCap},
    {href: '/timetable', key: 'schedule', Icon: CalendarDays},
  ],
  // Phụ huynh trước đây chỉ có ĐÚNG MỘT mục, và cả ba người thử đều nói trang đó thiếu thứ họ
  // cần. Nay bốn mục — đúng bốn thứ họ liệt kê: báo bài, điểm số, thời khoá biểu, và Báo cáo cũ.
  // (Thời khoá biểu vốn đã đọc được về mặt quyền, chỉ chưa có link — xem lib/queries.ts.)
  parent: [
    {href: '/report', key: 'report', Icon: LineChart},
    {href: '/grades', key: 'grades', Icon: GraduationCap},
    {href: '/timetable', key: 'schedule', Icon: CalendarDays},
  ],
  // Học sinh thường chỉ thấy scoreboard cá nhân; tổ trưởng được thêm Điểm danh.
  student: [
    {href: '/student', key: 'myScoreboard', Icon: LayoutDashboard},
    {href: '/grades', key: 'grades', Icon: GraduationCap},
    {href: '/timetable', key: 'schedule', Icon: CalendarDays},
    // Thực đơn: trước đây là một thẻ nằm giữa màn của em, phần lớn thời gian chỉ để nói "nhà
    // trường chưa cập nhật". Thành mục riêng thì em bấm khi muốn xem — và xem được cả tuần.
    {href: '/menu', key: 'menu', Icon: UtensilsCrossed},
  ],
};

// Ai có icon "Liên lạc" ở cụm phải.
//
// CHỈ hai vai này, cố ý: kênh tin nhắn là chuyện riêng giữa gia đình và giáo viên chủ nhiệm của
// đúng đứa trẻ đó. Quản trị viên và hiệu trưởng KHÔNG đọc được nội dung (RLS chặn, xem migration
// 0065), nên vẽ icon cho họ là vẽ một cái cửa mở ra phòng trống.
const CO_LIEN_LAC = new Set(['teacher', 'parent']);

// Tab tải trước theo vai — chỗ người ta SẮP tới, không phải mọi chỗ có thể tới.
const UU_TIEN_NAP_TRUOC: Record<string, string[]> = {
  student: ['/student', '/timetable'],
  teacher: ['/wig', '/attendance'],
  admin: ['/admin', '/wig'],
  principal: ['/campus', '/roster'],
  parent: ['/report'],
};

// Logo dẫn về ĐÂU. Trước đây luôn là '/' — mà '/' là bảng điểm lớp của giáo viên. Phụ huynh bấm
// vào cái nút to nhất màn hình là rơi thẳng vào tám ô trống kèm câu bảo chị đi thiết lập WIG cho
// lớp; học sinh cũng vậy. Phải khớp với homeRouteForRole() trong lib/auth.ts — không import được
// vào đây vì file đó kéo theo cả supabase/server, nên chép bảng và ghi rõ ràng buộc này.
const NHA_CUA: Record<string, string> = {
  admin: '/admin',
  principal: '/campus',
  parent: '/report',
  student: '/student',
  teacher: '/',
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
  unreadMessages = 0,
}: {
  profile: Profile;
  isAttendanceLeader?: boolean;
  // Số thông báo chưa đọc — hiện thành badge trên chuông (thay cho tab "Thông báo" cũ).
  unreadCount?: number;
  // Số tin nhắn phụ huynh↔giáo viên chưa đọc — badge trên icon phong bì.
  unreadMessages?: number;
}) {
  const t = useTranslations('nav');
  const tr = useTranslations('roles');
  const tc = useTranslations('common');
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [open, setOpen] = useState(false);

  // ── MANG THEO "ĐANG XEM LỚP NÀO / CON NÀO" KHI ĐỔI TAB ──────────────────────────────────
  //
  // Cô chủ nhiệm ba lớp mở Điểm danh của 6A1, bấm sang Báo bài — và rơi về lớp app chọn hộ.
  // Phụ huynh hai con đang xem báo bài của đứa lớn, bấm sang Học bạ — ra đứa bé. Không có gì
  // trên màn hình nói ra chuyện vừa đổi người, nên người ta đọc số của đứa này rồi tưởng là
  // của đứa kia.
  //
  // Hai tham số này là NGỮ CẢNH của cả phiên làm việc, không phải của riêng một trang, nên nó
  // phải đi theo. Trang nào không hiểu thì bỏ qua — Next chỉ chuyển tiếp, không ai vấp.
  const giuLai: Record<string, string> = {};
  for (const k of ['class', 'child']) {
    const v = searchParams.get(k);
    if (v) giuLai[k] = v;
  }

  const role = profile.role;
  // Học bạ đang tắt (lib/tinh-nang.ts) thì mục ấy biến khỏi menu của mọi vai.
  const baseLinks = (LINKS[role] ?? []).filter((l) => HOC_BA_BAT || l.href !== '/grades');
  const links =
    role === 'student' && isAttendanceLeader
      ? [...baseLinks, {href: '/attendance', key: 'attendance', Icon: ClipboardCheck}]
      : baseLinks;

  const displayName = tenHienThi(profile.full_name, profile.email);

  const isActive = (href: string) => (href === '/' ? pathname === '/' : pathname.startsWith(href));
  const activeItem = links.find((l) => isActive(l.href));
  // Các tab để NapTruoc tải sẵn — CHỈ 1–2 tab hay đi nhất theo vai (audit 04/09/2026: tải trước
  // cả bảy tab = ×7 tải máy chủ mỗi phiên), trừ tab đang đứng; cùng query giữ lại (?class=,
  // ?child=) để đúng là cái đường mà cú bấm sẽ đi. Tab còn lại tải khi rê chuột/chạm (napKhiCham).
  const uuTien = UU_TIEN_NAP_TRUOC[role] ?? [];
  const duongNapTruoc = uuTien
    .filter((href) => links.some((l) => l.href === href) && !isActive(href))
    .map((href) => ({pathname: href, query: giuLai}));
  // Rê chuột / chạm vào tab là tải đầy đủ ngay — lớp thứ hai sau NapTruoc, cho lúc đệm 30 giây đã
  // hết hạn: vẫn đi trước cú bấm vài trăm mili-giây.
  const napKhiCham = (href: string) => () => {
    try {
      router.prefetch({pathname: href, query: giuLai} as Parameters<typeof router.prefetch>[0], {kind: 'full'} as Parameters<typeof router.prefetch>[1]);
    } catch {
      /* tải trước hỏng thì thôi */
    }
  };

  // Đóng menu mobile mỗi khi đổi trang.
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  // data-appnav trên khối dưới đây: FlashToast đo chiều cao nó lúc chạy để nổi ngay DƯỚI thanh
  // menu, thay vì đoán một con số cố định (khối này cao khác nhau giữa điện thoại và máy tính).
  return (
    <div
      data-appnav
      className="sticky top-0 z-20 px-4 pb-2.5 pt-3.5 sm:px-6 [background:linear-gradient(180deg,rgba(255,255,255,0.98)_0%,rgba(255,255,255,0.85)_70%,rgba(255,255,255,0)_100%)]"
    >
      <NapTruoc duong={duongNapTruoc} />
      {/* Bar full-width navy. Desktop (lg+): logo | tabs | cụm phải. Mobile (<lg): logo | tên trang | hamburger. */}
      <div className="flex w-full items-center gap-3 rounded-[20px] bg-[linear-gradient(180deg,var(--color-navy-700),var(--color-navy))] px-3.5 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.1),0_10px_28px_-6px_rgba(38,39,93,0.5)] ring-1 ring-white/10">
        {/* Logo + tên */}
        <Link href={NHA_CUA[role] ?? '/'} className="flex shrink-0 items-center gap-2.5" onClick={() => setOpen(false)}>
          {/* Dùng bản 128px (2,8 KB), KHÔNG dùng logo-viet-anh.jpg (900×900, 72 KB).
              Ô này rộng 32 CSS px, tức là bản .jpg đang tải về gấp 25 lần dữ liệu cần thiết — và
              nó nằm trên MỌI trang sau đăng nhập, nên cái giá đó phải trả lại ở từng lần chuyển
              trang. Trang đăng nhập vốn đã dùng đúng bản 128px rồi; chỗ này bị sót.
              width/height khai sẵn để trình duyệt chừa đúng chỗ, không giật layout lúc ảnh về. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/logo-viet-anh-128.webp"
            alt="Logo Việt Anh"
            width={32}
            height={32}
            className="cham-44 h-8 w-8 shrink-0 rounded-full border-[1.5px] border-white/90 bg-white object-cover shadow-[0_2px_8px_rgba(38,39,93,0.15)]"
          />
          <span className="hidden whitespace-nowrap font-display text-doc font-bold text-white sm:inline">
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
                href={{pathname: href, query: giuLai}}
                onMouseEnter={napKhiCham(href)}
                onTouchStart={napKhiCham(href)}
                aria-current={active ? 'page' : undefined}
                className={`inline-flex h-11 shrink-0 items-center gap-[7px] whitespace-nowrap rounded-[12px] px-3.5 text-than font-extrabold transition-all ${
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

        {/* Desktop: cụm phải — chỉ hiện từ lg.
            BỎ nhãn tuần "W31-2026" khỏi đây. Người thử hỏi thẳng: "Có chữ W31-2026 không biết là
            gì? Mình nghĩ là tuần 31 của năm 2026 nhưng không biết dùng để làm gì". Đoán đúng mà
            vẫn không biết để làm gì — nghĩa là nó không giúp được việc gì, chỉ chiếm chỗ trên
            thanh nav vốn đã chật (docs/NAV_IA.md) và bắt người ta dừng lại nghĩ.
            Tuần vẫn hiện ở nơi nó CÓ NGHĨA: bộ chọn tuần trong WIG, Thời khoá biểu, Báo cáo. */}
        <div className="hidden shrink-0 items-center gap-1.5 lg:flex">
          {/* Người dùng */}
          <span className="inline-flex items-center gap-2 rounded-full bg-white/10 py-1 pl-1 pr-3 ring-1 ring-white/15">
            <span className="cham-44 grid h-7 w-7 shrink-0 place-items-center rounded-full bg-linear-to-b from-gold-soft to-gold font-display text-chu-thich font-bold text-navy">
              {initialsOf(displayName)}
            </span>
            <span className="block min-w-0">
              <span className="block max-w-[140px] truncate text-than font-extrabold leading-tight text-white">
                {displayName}
              </span>
              <span className="block text-nhan font-extrabold uppercase tracking-wide text-gold-soft">
                {tr(role)}
              </span>
            </span>
          </span>

          {/* Chuông + Cài đặt. Trước đây "Thông báo" là một tab trong thanh nav, mà GVCN có 8 tab
              nên chữ bị đè nhau; nay gom thành 2 icon ở góc, và ngôn ngữ/đăng xuất vào Cài đặt. */}
          {CO_LIEN_LAC.has(role) && (
            <BellLink
              href="/inbox"
              count={unreadMessages}
              label={t('inbox')}
              active={isActive('/inbox')}
              Icon={MessageCircle}
            />
          )}
          <BellLink href="/notifications" count={unreadCount} label={t('notifications')} active={isActive('/notifications')} />
          <SettingsMenu />
        </div>

        {/* Mobile (<lg): tên trang hiện tại + chuông + hamburger.
            Chuông phải nằm ngoài drawer vì "Thông báo" không còn là tab trong danh sách trang. */}
        <div className="flex flex-1 items-center gap-2 lg:hidden">
          <span className="min-w-0 flex-1 truncate font-display text-doc font-bold text-white sm:opacity-0">
            {activeItem ? t(activeItem.key) : ''}
          </span>
          {CO_LIEN_LAC.has(role) && (
            <BellLink
              href="/inbox"
              count={unreadMessages}
              label={t('inbox')}
              active={isActive('/inbox')}
              onNavigate={() => setOpen(false)}
              Icon={MessageCircle}
            />
          )}
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
            className="grid h-11 w-11 shrink-0 cursor-pointer place-items-center rounded-full text-white/80 transition-colors hover:bg-white/10 hover:text-white"
          >
            {open ? <X size={20} strokeWidth={2} /> : <Menu size={20} strokeWidth={2} />}
          </button>
        </div>
      </div>

      {/* Mobile: drawer menu dọc — hiện đầy đủ mục, touch target lớn */}
      {open && (
        <div className="mt-2 lg:hidden">
          <div className="glass-strong animate-drawer rounded-[20px] p-2.5">
            {/* Người dùng + tuần */}
            <div className="flex items-center gap-3 rounded-2xl px-2.5 py-2">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-linear-to-b from-gold-soft to-gold font-display text-than font-bold text-navy">
                {initialsOf(displayName)}
              </span>
              <div className="min-w-0 flex-1">
                <div className="truncate text-noi-dung font-extrabold leading-tight text-navy">
                  {displayName}
                </div>
                <div className="text-nhan font-extrabold uppercase tracking-wide text-gold-text">
                  {tr(role)}
                </div>
              </div>
            </div>

            {/* Danh sách trang */}
            <nav className="mt-1.5 grid gap-0.5">
              {links.map(({href, key, Icon}, i) => {
                const active = isActive(href);
                return (
                  <Link
                    key={href}
                    href={{pathname: href, query: giuLai}}
                    onTouchStart={napKhiCham(href)}
                    onClick={() => setOpen(false)}
                    aria-current={active ? 'page' : undefined}
                    style={{'--i': i} as CSSProperties}
                    className={`animate-item flex items-center gap-3 rounded-[12px] px-3 py-2.5 text-noi-dung font-extrabold transition-colors ${
                      active
                        ? 'bg-white/70 text-navy shadow-[inset_0_1px_0_rgba(255,255,255,0.95),0_4px_12px_rgba(38,39,93,0.10)]'
                        : 'text-navy/70 hover:bg-white/50 hover:text-navy'
                    }`}
                  >
                    <NavIcon Icon={Icon} size={20} />
                    {t(key)}
                  </Link>
                );
              })}
            </nav>

            {/* Tiện ích: ngôn ngữ · đăng xuất (đã bỏ nút Hướng dẫn theo yêu cầu) */}
            {/* Ba nút tiện ích: lưới 3 cột + không ngắt chữ — ở 360px "Hướng dẫn"/"Đăng xuất" từng
                gãy hai dòng vì flex-wrap chia không đều (audit 04/09/2026). */}
            <div className="mt-2 grid grid-cols-3 gap-1 border-t border-navy/[0.08] pt-2">
              <MoHuongDan
                className="flex min-h-11 cursor-pointer items-center justify-center gap-1.5 whitespace-nowrap rounded-[12px] px-1 text-than font-extrabold text-navy/70 transition-colors hover:bg-white/50 hover:text-navy"
                onDone={() => setOpen(false)}
              />
              <LocaleToggle className="flex min-h-11 cursor-pointer items-center justify-center gap-1.5 whitespace-nowrap rounded-[12px] px-1 text-than font-extrabold text-navy/70 transition-colors hover:bg-white/50 hover:text-navy disabled:opacity-50" />
              <form action={signOut} className="contents">
                <button
                  type="submit"
                  className="flex min-h-11 w-full cursor-pointer items-center justify-center gap-1.5 whitespace-nowrap rounded-[12px] px-1 text-than font-extrabold text-navy/70 transition-colors hover:bg-white/50 hover:text-navy"
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
// Icon tròn ở cụm phải, có chấm số chưa đọc. Dùng cho cả Thông báo (chuông) và Liên lạc (phong bì).
//
// Vì sao "Liên lạc" là icon chứ không phải tab: một tab chữ tiếng Việt tốn ~110px, icon tốn ~40px.
// Ngân sách chỗ trên thanh nav chỉ còn khoảng hai tab (docs/NAV_IA.md), mà "Báo bài" và "Học bạ"
// cần hơn — chúng là danh sách phải quét mắt hằng ngày. Tin nhắn thì thứ người dùng cần biết chỉ
// là "có gì mới không", đúng thứ một chấm đỏ trả lời được. Cùng họ với chuông nên đặt cạnh chuông.
function BellLink({
  href,
  count,
  label,
  active,
  onNavigate,
  Icon = Bell,
}: {
  href: string;
  count: number;
  label: string;
  active: boolean;
  onNavigate?: () => void;
  Icon?: IconType;
}) {
  return (
    <Link
      href={href}
      onClick={onNavigate}
      aria-label={count > 0 ? `${label} (${count})` : label}
      title={label}
      aria-current={active ? 'page' : undefined}
      className={`relative grid h-11 w-11 shrink-0 place-items-center rounded-full transition-colors ${
        active ? 'bg-white text-navy' : 'text-white/70 hover:bg-white/10 hover:text-white'
      }`}
    >
      <Icon size={16} strokeWidth={2} />
      {count > 0 && (
        <span className="absolute -right-0.5 -top-0.5 grid h-[17px] min-w-[17px] place-items-center rounded-full bg-gold px-1 font-display text-chu-thich font-bold text-navy ring-2 ring-navy">
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
    'flex w-full cursor-pointer items-center gap-2 rounded-[12px] px-3 py-2 text-left text-than font-extrabold text-navy/75 transition-colors hover:bg-navy/[0.06] hover:text-navy';

  return (
    <div ref={boxRef} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={tc('settings')}
        title={tc('settings')}
        aria-expanded={open}
        aria-haspopup="menu"
        className={`grid h-11 w-11 cursor-pointer place-items-center rounded-full transition-colors ${
          open ? 'bg-white text-navy' : 'text-white/70 hover:bg-white/10 hover:text-white'
        }`}
      >
        <Settings size={16} strokeWidth={2} />
      </button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 top-[calc(100%+8px)] z-30 w-[188px] rounded-[16px] bg-white p-1.5 shadow-pop ring-1 ring-navy/10"
        >
          <MoHuongDan className={item} onDone={() => setOpen(false)} />
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

// MỞ LẠI HƯỚNG DẪN LẦN ĐẦU.
//
// Màn cuối của hướng dẫn hứa nguyên văn: "Bạn có thể xem lại hướng dẫn này bất cứ lúc nào ở nút
// Hướng dẫn trên góc phải". Nút ấy đã bị gỡ khỏi thanh nav ở đợt dọn chỗ, nhưng câu hứa thì ở
// lại — và IntroGuide vẫn nghe sự kiện 'va:open-intro' mà không còn ai phát nó. Một lời hứa treo
// lơ lửng, và người dùng không cãi được vì nó chỉ hiện ở màn cuối của lần đăng nhập đầu tiên.
//
// Rẻ nhất là sửa câu chữ. Nhưng ở đây trả lại nút thì đúng hơn: menu Cài đặt còn thừa chỗ, và
// người mới cần xem lại hướng dẫn hơn là cần đổi ngôn ngữ.
function MoHuongDan({className, onDone}: {className?: string; onDone?: () => void}) {
  const tc = useTranslations('common');
  return (
    <button
      type="button"
      role="menuitem"
      className={className}
      onClick={() => {
        window.dispatchEvent(new Event('va:open-intro'));
        onDone?.();
      }}
    >
      <BookOpenCheck size={16} strokeWidth={2} />
      {tc('guide')}
    </button>
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
        'inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-full px-3 text-chu-thich font-extrabold text-white/70 transition-colors hover:bg-white/10 hover:text-white disabled:opacity-50'
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

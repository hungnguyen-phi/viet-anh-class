'use client';

// TOUR HƯỚNG DẪN CHỈ TẬN NÚT (04/09/2026).
//
// Vì sao viết lại: hộp hướng dẫn cũ (IntroGuide) là bốn thẻ chữ chung chung — đọc xong vẫn không
// biết nút nào ở đâu. Chủ dự án muốn "chỉ rõ từng nút, ai biết đọc là hiểu, sau này không ai
// training thì tự mở ra". Nên: overlay tối cả màn, KHOÉT sáng đúng phần tử đang nói tới, thẻ giải
// thích neo cạnh nó, có Bỏ qua / Quay lại / Tiếp; phần tử đích vẫn bấm được (bước "thử bấm xem").
//
// Cơ chế: mỗi bước có data-hd; Tour tìm phần tử, cuộn vào tầm nhìn, đo bounding box, vẽ overlay
// bằng 4 tấm chắn quanh lỗ khoét (không dùng clip-path để khỏi vướng backdrop-filter của header),
// thẻ đặt trên/dưới phần tử tuỳ chỗ trống; ở màn hẹp (<640) thẻ dính đáy, trên thanh điều hướng
// dưới. Theo dõi resize/scroll bằng ResizeObserver + rAF để lỗ khoét bám phần tử.
//
// Trạng thái xem: localStorage `va:hd:<user>:<tour>:v<N>` (từng tour, từng phiên bản nội dung);
// `profiles.intro_seen` chỉ đánh dấu "đã xem lần đầu" để không tự bật lại (như trước).
import {useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState} from 'react';
import {createPortal} from 'react-dom';
import {useTranslations} from 'next-intl';
import {usePathname} from '@/i18n/navigation';
import {ArrowLeft, ArrowRight, Sparkles, CalendarDays, Target, ShieldCheck, GraduationCap, X, MousePointerClick} from 'lucide-react';
import {createClient} from '@/lib/supabase/client';
import {useFocusTrap} from '@/lib/useFocusTrap';
import type {Role} from '@/lib/auth';
import {PHIEN_BAN_TOUR, TOURS, tourChoTrang, tourTheoVai, trangCuaTour, type BuocTour, type TenTour} from './buoc';
import {LuongSo} from './LuongSo';
import {xoaCoMau} from './mau';

const ICON = {sparkles: Sparkles, calendar: CalendarDays, target: Target, shield: ShieldCheck, graduation: GraduationCap};
const LE = 8;      // khoảng hở quanh lỗ khoét
const CACH = 12;   // khoảng cách thẻ ↔ phần tử

type Hop = {top: number; left: number; width: number; height: number};
const CO_MO_SAU = 'va:hd:mo-sau';

function boLocale(pathname: string) {
  return pathname.replace(/^\/(vi|en)(?=\/|$)/, '') || '/';
}

/** Mở tour: `ten` cho trước (vd tập tạo mẫu) hoặc tour của trang đang đứng; chưa ở đúng trang
 *  thì sang trang đó rồi mở (cờ trong sessionStorage ghi TÊN tour). */
export function moHuongDan(role: Role, pathname: string, push: (href: string) => void, ten?: TenTour) {
  const muon = ten ?? tourChoTrang(pathname, role) ?? tourTheoVai(role);
  if (!muon) return;
  if (boLocale(pathname).startsWith(trangCuaTour(muon)) || (!ten && tourChoTrang(pathname, role))) {
    window.dispatchEvent(new CustomEvent('va:open-intro', {detail: muon}));
    return;
  }
  try { sessionStorage.setItem(CO_MO_SAU, muon); } catch { /* private mode */ }
  push(trangCuaTour(muon));
}

function khoaXem(userId: string, tour: TenTour) {
  return `va:hd:${userId}:${tour}:v${PHIEN_BAN_TOUR}`;
}

function docDaXem(userId: string, tour: TenTour) {
  try { return localStorage.getItem(khoaXem(userId, tour)) === '1'; } catch { return false; }
}
function ghiDaXem(userId: string, tour: TenTour) {
  try { localStorage.setItem(khoaXem(userId, tour), '1'); } catch { /* private mode */ }
}

function timPhanTu(hd: string): HTMLElement | null {
  // Ưu tiên phần tử ĐANG HIỆN (mobile/desktop có thể render hai bản cùng data-hd).
  // getClientRects() rỗng = display:none (kể cả phần tử fixed như thanh dưới bị lg:hidden).
  // '@…' = selector thô (tour tập làm chỉ vào nút TRONG thẻ mẫu: '@[data-mau] [data-hd="em-tick"]').
  const sel = hd.startsWith('@') ? hd.slice(1) : `[data-hd="${hd}"]`;
  let cands: HTMLElement[] = [];
  try { cands = Array.from(document.querySelectorAll<HTMLElement>(sel)); } catch { return null; }
  return cands.find((el) => el.getClientRects().length > 0) ?? null;
}

export function Tour({userId, role, introSeen}: {userId: string; role: Role; introSeen: boolean}) {
  const t = useTranslations('huongDan');
  const pathname = usePathname();
  const [supabase] = useState(() => createClient());

  const [tour, setTour] = useState<TenTour | null>(null);
  const [i, setI] = useState(0);
  const [hop, setHop] = useState<Hop | null>(null);
  const [thieu, setThieu] = useState(false);   // bước hiện tại không có phần tử → thẻ "chưa có gì"
  const [dangCho, setDangCho] = useState(false); // bước có `cho`: đang đợi phần tử hiện sau khi Lưu
  const iRef = useRef(0);
  const tourRef = useRef<TenTour | null>(null);
  iRef.current = i;
  tourRef.current = tour;
  const [dangLuu, setDangLuu] = useState(false); // bước `choDong`: đã bấm Lưu hộ, đang đợi hộp đóng
  const [loiHop, setLoiHop] = useState(false);   // hộp không đóng sau 12 s → máy chủ báo lỗi trong hộp
  useEffect(() => { setDangLuu(false); setLoiHop(false); }, [i, tour]);
  const [mounted, setMounted] = useState(false);
  const [hep, setHep] = useState(false);
  const theRef = useRef<HTMLDivElement>(null);
  const seenRef = useRef(introSeen);
  const dichRef = useRef<HTMLElement | null>(null);

  const buocs: BuocTour[] = useMemo(() => (tour ? TOURS[tour] : []), [tour]);
  const buoc = buocs[i];
  const tourTrang = tourChoTrang(pathname, role);

  useEffect(() => setMounted(true), []);
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 639px)');
    const cap = () => setHep(mq.matches);
    cap();
    mq.addEventListener('change', cap);
    return () => mq.removeEventListener('change', cap);
  }, []);

  // ── Mở tour ────────────────────────────────────────────────────────────────────────────
  const mo = useCallback((ten: TenTour) => {
    setTour(ten);
    setI(0);
  }, []);

  // Lần đầu đăng nhập: tự chạy tour của trang đang đứng (đúng vai). Chưa ở trang đó thì thôi —
  // nút "?" và menu Hướng dẫn vẫn mở được.
  useEffect(() => {
    if (introSeen || !mounted) return;
    const ten = tourTrang ?? tourTheoVai(role);
    if (ten && ten === tourTrang && !docDaXem(userId, ten)) mo(ten);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mounted, introSeen]);

  // Menu ☰ → "Hướng dẫn" và nút "?" phát sự kiện này. Đứng ở trang không có tour thì nút đã
  // chuyển trang trước và để lại cờ trong sessionStorage — tới nơi thì mở.
  useEffect(() => {
    const h = (e: Event) => {
      const chiDinh = (e as CustomEvent<TenTour | undefined>).detail;
      const ten = (chiDinh && TOURS[chiDinh] ? chiDinh : null) ?? tourTrang ?? tourTheoVai(role);
      if (ten) mo(ten);
    };
    window.addEventListener('va:open-intro', h);
    try {
      const co = sessionStorage.getItem(CO_MO_SAU);
      if (co) {
        const ten = (TOURS[co as TenTour] ? (co as TenTour) : null) ?? tourTrang;
        // Chỉ mở khi đã tới đúng trang của tour (cờ đặt trước lúc chuyển trang).
        if (ten && boLocale(pathname).startsWith(trangCuaTour(ten))) {
          sessionStorage.removeItem(CO_MO_SAU);
          mo(ten);
        }
      }
    } catch { /* private mode */ }
    return () => window.removeEventListener('va:open-intro', h);
  }, [tourTrang, role, mo, pathname]);

  // ── Kết thúc ───────────────────────────────────────────────────────────────────────────
  const ket = useCallback(async () => {
    if (tour) ghiDaXem(userId, tour);
    setTour(null);
    setHop(null);
    dichRef.current = null;
    xoaCoMau(); // tour tập làm bỏ dở: lần mở hộp sau không bị điền sẵn mẫu
    if (!seenRef.current) {
      const {error} = await supabase.from('profiles').update({intro_seen: true}).eq('id', userId);
      if (!error) seenRef.current = true;
    }
  }, [tour, userId, supabase]);

  // ── Đo phần tử đích ────────────────────────────────────────────────────────────────────
  // 05/09 (chủ dự án: "không mượt, đừng bám đuổi, nhẹ như game"): đo MỘT LẦN khi vào bước, khung
  // sáng và thẻ trượt tới chỗ mới bằng CSS transition; chỉ đo lại khi cuộn / đổi cỡ (có giãn cách)
  // hoặc phần tử đích đổi kích thước. Trước đây một vòng rAF đo mỗi khung hình → dựng lại cả cây
  // 60 lần/giây, khung sáng giật vì đánh nhau với transition.
  const doLai = useCallback(() => {
    const el = dichRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const moi = {top: r.top - LE, left: r.left - LE, width: r.width + LE * 2, height: r.height + LE * 2};
    setHop((cu) =>
      cu && Math.abs(cu.top - moi.top) < 0.5 && Math.abs(cu.left - moi.left) < 0.5 && Math.abs(cu.width - moi.width) < 0.5 && Math.abs(cu.height - moi.height) < 0.5
        ? cu
        : moi,
    );
  }, []);

  useLayoutEffect(() => {
    if (!tour || !buoc) return;
    // Thẻ đọc-trước: không spotlight.
    if (!buoc.hd) {
      dichRef.current = null;
      setHop(null);
      setThieu(false);
      return;
    }
    buoc.truoc?.();
    // Bỏ đích cũ ngay — không thì vòng rAF vẫn đo phần tử bước trước trong lúc chờ tìm.
    dichRef.current = null;
    let huy = false;
    let lan = 0;
    // Phần tử có thể xuất hiện muộn CHỈ khi bước này vừa mở popup/sheet (`truoc`) — khi ấy thử lại
    // vài nhịp. Bước thường thì quyết ngay: trang đã dựng xong trước khi tour chạy, thử lại chỉ
    // làm khung bước trước đứng lì ~1s rồi mới nhảy về giữa (chủ dự án thấy ở bước 9→10, 05/09).
    // Bước có `cho` (ngay sau một lần Lưu, trang đang dựng lại): bỏ khung cũ ngay, thẻ về giữa
    // với dòng "đang chờ…", rồi thăm dò mỗi 200 ms tới hạn.
    const nhip = buoc.cho ? 200 : 120;
    const toiDa = buoc.cho ? Math.ceil(buoc.cho / nhip) : buoc.truoc && buoc.khiThieu !== 'bo' ? 6 : 0;
    if (buoc.cho) { setHop(null); setThieu(false); setDangCho(true); }
    const tim = () => {
      if (huy) return;
      const el = timPhanTu(buoc.hd!) ?? (buoc.hdPhu ? timPhanTu(buoc.hdPhu) : null);
      if (!el) {
        if (lan++ < toiDa) { setTimeout(tim, nhip); return; }
        setDangCho(false);
        // Không có trên màn.
        if (buoc.khiThieu === 'bo') {
          setI((v) => Math.min(v + 1, buocs.length - 1));
        } else {
          dichRef.current = null;
          setHop(null);
          setThieu(true);
        }
        return;
      }
      setThieu(false);
      setDangCho(false);
      dichRef.current = el;
      // Cuộn TỨC THÌ tới phần tử rồi đo một lần — khung sáng tự trượt từ chỗ cũ sang chỗ mới bằng
      // CSS (cuộn mượt + đo giữa chừng là nguồn giật). Đo thêm một nhịp sau khi bố cục lắng.
      el.scrollIntoView({block: 'center', behavior: 'instant' as ScrollBehavior, inline: 'nearest'});
      doLai();
      setTimeout(doLai, 220);
    };
    tim();
    return () => { huy = true; };
  }, [tour, i, buoc, buocs.length, doLai]);

  // Đo lại KHI CẦN: cuộn / đổi cỡ (giãn 80 ms, passive) và khi phần tử đích đổi kích thước.
  useEffect(() => {
    if (!tour) return;
    let hen: ReturnType<typeof setTimeout> | null = null;
    const nhac = () => {
      if (hen) clearTimeout(hen);
      hen = setTimeout(doLai, 80);
    };
    window.addEventListener('scroll', nhac, {passive: true, capture: true});
    window.addEventListener('resize', nhac, {passive: true});
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(nhac) : null;
    const el = dichRef.current;
    if (ro && el) ro.observe(el);
    return () => {
      window.removeEventListener('scroll', nhac, {capture: true});
      window.removeEventListener('resize', nhac);
      ro?.disconnect();
      if (hen) clearTimeout(hen);
    };
    // hop đổi (tìm thấy phần tử mới) → gắn ResizeObserver vào đúng phần tử ấy.
  }, [tour, i, hop, doLai]);

  // Bước "thử bấm xem": bấm trúng phần tử đích (hoặc `bam` — vd khoanh cả form, chờ bấm nút Lưu)
  // → sang bước kế. `choDong`: sau cú bấm đợi hộp đóng (máy chủ ghi xong) rồi mới sang; hộp còn
  // đó và có role="alert" = lỗi → thẻ nói rõ, không nhảy bước.
  useEffect(() => {
    if (!tour || !buoc?.hanhDong || buoc.tuBam) return;
    const el = buoc.bam ? timPhanTu(buoc.bam) : dichRef.current;
    if (!el) return;
    // Effect này chạy lại MỖI KHUNG HÌNH (hop đo lại bằng rAF) nên không dùng cờ huỷ trong closure —
    // bộ đếm sẽ bị huỷ trước khi kịp chạy. Kiểm "vẫn còn ở bước này" bằng ref chỉ số bước.
    const iLuc = i;
    const conOBuoc = () => iRef.current === iLuc && tourRef.current === tour;
    const sang = () => { if (conOBuoc()) setI((v) => Math.min(v + 1, buocs.length - 1)); };
    const h = () => {
      if (!buoc.choDong) { setTimeout(sang, 250); return; }
      setDangLuu(true);
      setLoiHop(false);
      const dich = buoc.hd!;
      const t0 = Date.now();
      const doi = () => {
        if (!conOBuoc()) return;
        const hopEl = timPhanTu(dich);
        if (!hopEl) { setDangLuu(false); sang(); return; }
        const coLoi = hopEl.querySelector('[role="alert"]') && Date.now() - t0 > 600;
        if (coLoi || Date.now() - t0 > 12000) { setDangLuu(false); setLoiHop(true); return; }
        setTimeout(doi, 200);
      };
      setTimeout(doi, 300);
    };
    el.addEventListener('click', h, {once: true});
    return () => el.removeEventListener('click', h);
  }, [tour, i, buoc, buocs.length, hop]);

  // Phím: Esc = bỏ qua, ← → chuyển bước.
  useEffect(() => {
    if (!tour) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); void ket(); }
      else if (e.key === 'ArrowRight' && !buocs[i]?.batBuoc) setI((v) => Math.min(v + 1, buocs.length - 1));
      else if (e.key === 'ArrowLeft') setI((v) => Math.max(v - 1, 0));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [tour, buocs, i, ket]);

  useFocusTrap(!!tour && mounted, theRef);

  if (!mounted || !tour || !buoc) return null;

  const cuoi = i === buocs.length - 1;
  const docTruoc = !buoc.hd;
  // Tiếp: bước `tuBam` thì bấm hộ phần tử (mở hộp / Tiếp trong hộp / Lưu) rồi mới sang bước kế.
  // Không tìm thấy gì để bấm (thẻ "thiếu") thì chỉ sang bước.
  const tiep = () => {
    if (cuoi) { void ket(); return; }
    if (buoc.tuBam && !thieu) {
      const el = buoc.bam ? timPhanTu(buoc.bam) : dichRef.current;
      el?.click();
      if (buoc.choDong && el) {
        // Bấm Lưu xong: đợi hộp đóng (máy chủ ghi xong) rồi mới sang bước — hộp còn đó = lỗi.
        setDangLuu(true);
        setLoiHop(false);
        const dich = buoc.hd!;
        const t0 = Date.now();
        const doi = () => {
          const hop = timPhanTu(dich);
          if (!hop) { setDangLuu(false); setI((v) => v + 1); return; }
          // Máy chủ trả lỗi → hộp hiện dòng role="alert" ngay: báo luôn, khỏi đợi hết 12 s.
          const coLoi = hop.querySelector('[role="alert"]') && Date.now() - t0 > 600;
          if (coLoi || Date.now() - t0 > 12000) { setDangLuu(false); setLoiHop(true); return; }
          setTimeout(doi, 200);
        };
        setTimeout(doi, 300);
        return;
      }
    }
    setI((v) => v + 1);
  };
  const nhanTiep = cuoi ? t('xong') : dangLuu ? t('nut.dangLuu') : buoc.nhanTiep ? t(`nut.${buoc.nhanTiep}`) : t('tiep');
  // Thiếu phần tử vẫn nói đủ "đây là gì, cần điền gì" (05/09: chủ dự án thấy thẻ trống vô nghĩa),
  // chỉ thêm một dòng nhỏ giải thích vì sao chưa có nút.
  const tieuDe = t(`${tour}.${buoc.key}.tieuDe`);
  const noiDung = t(`${tour}.${buoc.key}.noiDung`);
  const Icon = buoc.icon ? ICON[buoc.icon] : Sparkles;

  // ── Vị trí thẻ ──────────────────────────────────────────────────────────────────────────
  let theStyle: React.CSSProperties = {};
  let muiTen: 'tren' | 'duoi' | null = null;
  if (!docTruoc && hop && !hep) {
    const vh = window.innerHeight, vw = window.innerWidth;
    const rongThe = 360;
    const CAO_THE = 300; // thẻ cao chừng này — dùng để biết còn chỗ không, tránh tràn khỏi màn
    const choDuoi = vh - (hop.top + hop.height) - CACH;
    const choTren = hop.top - CACH;
    const left = Math.max(12, Math.min(vw - rongThe - 12, hop.left + hop.width / 2 - rongThe / 2));
    if (choDuoi >= CAO_THE || (choDuoi >= 220 && choDuoi >= choTren)) {
      theStyle = {top: hop.top + hop.height + CACH, left, width: rongThe}; muiTen = 'tren';
    } else if (choTren >= 220) {
      theStyle = {bottom: vh - hop.top + CACH, left, width: rongThe}; muiTen = 'duoi';
    } else {
      // Lỗ khoét chiếm gần hết chiều cao (cả một form) → không đặt trên/dưới được: neo góc dưới
      // phải màn, đè lên mép hộp một chút còn hơn tràn ra ngoài (chủ dự án thấy tràn 05/09).
      theStyle = {right: 16, bottom: 16, width: rongThe}; muiTen = null;
    }
  }

  const overlay = hop && !docTruoc ? (
    <>
      {/* 4 tấm chắn quanh lỗ khoét — phần tử đích ở giữa vẫn bấm được; cũng trượt theo khung. */}
      <div className="fixed inset-x-0 top-0 bg-navy/60 transition-[height] duration-300 ease-out motion-reduce:transition-none" style={{height: Math.max(0, hop.top)}} onClick={() => void ket()} />
      <div className="fixed inset-x-0 bottom-0 bg-navy/60 transition-[top] duration-300 ease-out motion-reduce:transition-none" style={{top: hop.top + hop.height}} onClick={() => void ket()} />
      <div className="fixed left-0 bg-navy/60 transition-[top,height,width] duration-300 ease-out motion-reduce:transition-none" style={{top: hop.top, height: hop.height, width: Math.max(0, hop.left)}} onClick={() => void ket()} />
      <div className="fixed right-0 bg-navy/60 transition-[top,height,left] duration-300 ease-out motion-reduce:transition-none" style={{top: hop.top, height: hop.height, left: hop.left + hop.width}} onClick={() => void ket()} />
      {/* Viền vàng quanh lỗ khoét — không bắt chuột. Trượt tới chỗ mới (300 ms) + nhịp sáng nhẹ
          dẫn mắt như hướng dẫn trong game. */}
      <div
        data-tour-hop
        className="animate-hd-nhip pointer-events-none fixed rounded-[14px] ring-[3px] ring-gold transition-[top,left,width,height] duration-300 ease-out motion-reduce:transition-none"
        style={{top: hop.top, left: hop.left, width: hop.width, height: hop.height}}
      />
    </>
  ) : (
    <div className="fixed inset-0 bg-navy/60 backdrop-blur-[2px]" onClick={() => void ket()} />
  );

  const the = (
    <div
      ref={theRef}
      tabIndex={-1}
      data-tour-the
      data-tour-bam={buoc.hanhDong ? (buoc.bam ?? buoc.hd) : undefined}
      role="dialog"
      aria-modal="true"
      aria-labelledby="hd-tieu-de"
      onClick={(e) => e.stopPropagation()}
      style={docTruoc || hep || !hop ? undefined : theStyle}
      className={`fixed z-[61] flex flex-col gap-3 rounded-[16px] bg-white p-4 shadow-pop outline-none ring-1 ring-navy/10 transition-[top,left,bottom,right] duration-300 ease-out motion-reduce:transition-none ${
        docTruoc || !hop
          ? 'left-1/2 top-1/2 w-[min(440px,calc(100vw-32px))] -translate-x-1/2 -translate-y-1/2'
          : hep
            ? 'inset-x-3 bottom-[calc(3.5rem+env(safe-area-inset-bottom)+12px)]'
            : ''
      }`}
    >
      {muiTen && (
        <span
          aria-hidden
          className={`absolute left-1/2 h-3.5 w-3.5 -translate-x-1/2 rotate-45 bg-white ${muiTen === 'tren' ? '-top-[7px]' : '-bottom-[7px]'}`}
        />
      )}
      {/* Tiến độ + đóng */}
      <div className="flex items-center gap-2">
        <span data-tour-buoc className="text-nhan font-extrabold uppercase tracking-wide text-grey-mid">{t('buoc', {i: i + 1, n: buocs.length})}</span>
        <span className="flex flex-1 gap-1" aria-hidden>
          {buocs.map((_, k) => (
            <span key={k} className={`h-1 flex-1 rounded-full ${k <= i ? 'bg-gold' : 'bg-navy/10'}`} />
          ))}
        </span>
        <button
          type="button"
          onClick={() => void ket()}
          aria-label={t('boQua')}
          className="grid h-11 w-11 shrink-0 cursor-pointer place-items-center rounded-full text-grey-mid hover:bg-navy/5 hover:text-navy focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold"
        >
          <X size={16} strokeWidth={2.5} />
        </button>
      </div>

      {/* Nội dung — key theo bước để chữ mới hiện lên nhẹ (animate-rise), không nhảy khựng. */}
      <div key={`${tour}-${i}`} className={`animate-rise ${docTruoc ? 'flex flex-col items-center text-center' : 'flex items-start gap-3'}`} aria-live="polite">
        {docTruoc ? (
          <span className="grid h-14 w-14 place-items-center rounded-2xl bg-linear-to-b from-gold-soft to-gold text-navy">
            <Icon size={26} strokeWidth={2} />
          </span>
        ) : (
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-gold/25 text-navy">
            <MousePointerClick size={16} strokeWidth={2.5} />
          </span>
        )}
        <div className="min-w-0">
          <h2 id="hd-tieu-de" className={`font-display font-bold text-navy ${docTruoc ? 'mt-3 text-tieu-de' : 'text-doc'}`}>{tieuDe}</h2>
          <p className={`mt-1 text-noi-dung leading-relaxed text-txt ${docTruoc ? 'mx-auto max-w-[38ch]' : ''}`}>{noiDung}</p>
          {buoc.luong && docTruoc && <LuongSo />}
          {thieu && (
            <p className="mt-2 rounded-[12px] bg-navy/[0.05] px-2.5 py-1.5 text-chu-thich font-semibold text-grey-mid">{t(buoc.ghiChuThieu ?? 'chuaCoOChoNay')}</p>
          )}
          {loiHop && (
            <p role="alert" className="mt-2 rounded-[12px] bg-status-bad/[0.08] px-2.5 py-1.5 text-chu-thich font-bold text-status-bad">{t('hopBaoLoi')}</p>
          )}
          {dangCho && !thieu && (
            <p className="mt-2 inline-flex items-center gap-1.5 rounded-[12px] bg-gold/15 px-2.5 py-1.5 text-chu-thich font-semibold text-navy">
              <span className="h-2 w-2 animate-pulse rounded-full bg-gold-deep" aria-hidden />
              {t('dangCho')}
            </p>
          )}
          {buoc.hanhDong && !thieu && (
            <p className="mt-1.5 inline-flex items-center gap-1 rounded-full bg-gold/20 px-2 py-0.5 text-chu-thich font-extrabold text-navy">
              <MousePointerClick size={12} strokeWidth={2.5} />
              {dangLuu ? t('nut.dangLuu') : buoc.batBuoc ? t('bamNutSang') : t('thuBam')}
            </p>
          )}
        </div>
      </div>

      {/* Nút */}
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => void ket()}
          className="min-h-[44px] cursor-pointer px-2 text-than font-bold text-grey-mid hover:text-navy focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold"
        >
          {t('boQua')}
        </button>
        <div className="flex items-center gap-2">
          {i > 0 && (
            <button
              type="button"
              onClick={() => setI((v) => v - 1)}
              className="inline-flex min-h-[44px] cursor-pointer items-center gap-1 rounded-[12px] border-[1.5px] border-navy/15 px-3 text-than font-bold text-navy hover:border-navy focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold"
            >
              <ArrowLeft size={14} strokeWidth={2.5} />
              {t('quayLai')}
            </button>
          )}
          {/* Bước bắt buộc tự làm: KHÔNG có nút Tiếp — chỉ bấm đúng chỗ sáng mới đi tiếp (thiếu phần tử thì vẫn có Tiếp). */}
          {!(buoc.batBuoc && !thieu) && <button
            type="button"
            data-tour-tiep
            onClick={tiep}
            disabled={dangLuu}
            className="btn-gold inline-flex disabled:opacity-60 min-h-[44px] cursor-pointer items-center gap-1.5 rounded-[12px] px-4 font-display text-noi-dung font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy"
          >
            {nhanTiep}
            {!cuoi && <ArrowRight size={14} strokeWidth={2.5} />}
          </button>}
        </div>
      </div>
    </div>
  );

  return createPortal(
    <div className="fixed inset-0 z-[60]">
      {overlay}
      {the}
    </div>,
    document.body,
  );
}

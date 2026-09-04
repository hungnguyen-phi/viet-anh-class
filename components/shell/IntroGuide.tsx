'use client';

import {useEffect, useMemo, useRef, useState} from 'react';
import {createPortal} from 'react-dom';
import {useTranslations} from 'next-intl';
import {createClient} from '@/lib/supabase/client';
import {useFocusTrap} from '@/lib/useFocusTrap';
import type {Role} from '@/lib/auth';
import {
  Sparkles,
  Target,
  GraduationCap,
  Star,
  LineChart,
  Building2,
  ShieldCheck,
  PartyPopper,
  ArrowRight,
  ArrowLeft,
  type LucideIcon,
} from 'lucide-react';

type Step = {Icon: LucideIcon; title: string; bullets: string[]};
type T = ReturnType<typeof useTranslations<'common'>>;

// Nội dung onboarding — chuỗi nằm ở messages `common.intro.*` (audit 04/09: 39 chuỗi cứng làm bản
// EN lộ tiếng Việt). Mỗi vai: chào mừng → cách lớp làm việc → phần của vai → xong.
//
// XƯNG HÔ theo luật chốt 04/09: học sinh là "em"; app nói với mọi người lớn là "bạn". Bản cũ gọi
// học sinh là "bạn" và bảo giáo viên "bạn theo dõi việc mình làm mỗi ngày" (câu của học sinh).
function buildSteps(role: Role, t: T): Step[] {
  const em = role === 'student';
  const welcome: Step = {
    Icon: Sparkles,
    title: t('intro.chaoTitle'),
    bullets: [em ? t('intro.chaoEm') : t('intro.chaoNguoiLon'), t('intro.chaoNgonNgu')],
  };
  const dx: Step = {
    Icon: Target,
    title: t('intro.cachTitle'),
    bullets: em
      ? [t('intro.cach1'), t('intro.cach2Em'), t('intro.cach3Em'), t('intro.cach4Em'), t('intro.cach5Em')]
      : [t('intro.cach1'), t('intro.cach2NguoiLon'), t('intro.cach3NguoiLon'), t('intro.cach4NguoiLon')],
  };
  const icon: Record<Role, LucideIcon> = {
    teacher: GraduationCap,
    student: Star,
    parent: LineChart,
    principal: Building2,
    admin: ShieldCheck,
    pending: Sparkles,
  };
  const soGach: Record<Role, number> = {teacher: 4, student: 3, parent: 3, principal: 2, admin: 3, pending: 1};
  const vai = (role in icon ? role : 'pending') as Role;
  const roleStep: Step = {
    Icon: icon[vai],
    title: t(`intro.vai.${vai}.title`),
    bullets: Array.from({length: soGach[vai]}, (_, k) => t(`intro.vai.${vai}.b${k + 1}`)),
  };
  const done: Step = {Icon: PartyPopper, title: t('intro.xongTitle'), bullets: [t('intro.xong1')]};
  return [welcome, dx, roleStep, done];
}

export function IntroGuide({
  userId,
  role,
  introSeen,
}: {
  userId: string;
  role: Role;
  introSeen: boolean;
}) {
  const t = useTranslations('common');
  const [open, setOpen] = useState(false);
  const [i, setI] = useState(0);
  const [mounted, setMounted] = useState(false);
  const [supabase] = useState(() => createClient());
  const seenRef = useRef(introSeen);
  const cardRef = useRef<HTMLDivElement>(null);

  const steps = useMemo(() => buildSteps(role, t), [role, t]);

  useEffect(() => setMounted(true), []);
  // Lần đầu (chưa xem) → tự mở.
  useEffect(() => {
    if (!introSeen) setOpen(true);
  }, [introSeen]);
  // Nút "Hướng dẫn" trên nav phát sự kiện → mở lại (replay).
  useEffect(() => {
    const h = () => {
      setI(0);
      setOpen(true);
    };
    window.addEventListener('va:open-intro', h);
    return () => window.removeEventListener('va:open-intro', h);
  }, []);
  // Đóng bằng phím Esc (đánh dấu đã xem như nút "Bỏ qua").
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') void finish();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);
  // Bẫy focus trong modal onboarding.
  useFocusTrap(open && mounted, cardRef);
  // KHOÁ CUỘN NỀN khi hộp thoại mở. Không có nó thì lăn chuột trên hộp hướng dẫn làm trang phía
  // sau trôi đi — người mới lần đầu vào app vừa đọc vừa thấy nền chạy, và đóng hộp ra thì đang
  // đứng ở giữa trang chứ không phải chỗ mình bắt đầu.
  useEffect(() => {
    if (!open || !mounted) return;
    const cu = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = cu;
    };
  }, [open, mounted]);

  async function finish() {
    setOpen(false);
    if (!seenRef.current) {
      // Chỉ đánh dấu đã-xem khi ghi DB thành công, nếu không lần sau vẫn hiện lại (đúng ý).
      const {error} = await supabase.from('profiles').update({intro_seen: true}).eq('id', userId);
      if (!error) seenRef.current = true;
    }
  }

  if (!open || !mounted) return null;
  const step = steps[i];
  const last = i === steps.length - 1;

  return createPortal(
    <div
      className="animate-fade fixed inset-0 z-50 flex items-center justify-center bg-navy/30 p-5 backdrop-blur-[10px]"
      onClick={finish}
    >
      <div
        ref={cardRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby="intro-title"
        className="w-[460px] max-w-full rounded-[26px] bg-white p-7 shadow-pop outline-none ring-1 ring-navy/10"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Chấm tiến trình */}
        <div className="flex justify-center gap-1.5" aria-label={t('intro.buoc', {i: i + 1, n: steps.length})}>
          {steps.map((_, idx) => (
            <span
              key={idx}
              className={`h-1.5 rounded-full transition-all ${
                idx === i ? 'w-6 bg-gold' : idx < i ? 'w-1.5 bg-gold/50' : 'w-1.5 bg-navy/15'
              }`}
            />
          ))}
        </div>

        <div className="mt-5 flex flex-col items-center text-center">
          <span className="grid h-16 w-16 place-items-center rounded-2xl bg-linear-to-b from-gold-soft to-gold text-navy shadow-[var(--shadow-gold)]">
            <step.Icon size={30} strokeWidth={2} />
          </span>
          <h2 id="intro-title" className="mt-4 font-display text-[22px] font-bold text-navy">{step.title}</h2>
          <ul className="mt-3 space-y-2 text-left">
            {step.bullets.map((b, idx) => (
              <li key={idx} className="flex gap-2.5 text-[13.5px] leading-relaxed text-txt">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-gold" />
                <span>{b}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="mt-6 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={finish}
            className="min-h-[44px] cursor-pointer px-2 text-[13px] font-bold text-grey-mid transition-colors hover:text-navy"
          >
            {t('intro.nutBo')}
          </button>
          <div className="flex items-center gap-2">
            {i > 0 && (
              <button
                type="button"
                onClick={() => setI((v) => v - 1)}
                className="inline-flex h-11 cursor-pointer items-center gap-1.5 rounded-xl border-[1.5px] border-navy/15 px-3.5 text-[13px] font-bold text-navy transition-colors hover:border-navy"
              >
                <ArrowLeft size={15} strokeWidth={2.5} />
                {t('intro.nutQuayLai')}
              </button>
            )}
            <button
              type="button"
              onClick={() => (last ? finish() : setI((v) => v + 1))}
              className="btn-gold inline-flex h-11 cursor-pointer items-center gap-1.5 rounded-xl px-5 font-display text-[13.5px] font-bold"
            >
              {last ? t('intro.nutBatDau') : t('intro.nutTiep')}
              {!last && <ArrowRight size={15} strokeWidth={2.5} />}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}

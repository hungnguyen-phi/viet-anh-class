'use client';

import {useEffect, useMemo, useRef, useState} from 'react';
import {createPortal} from 'react-dom';
import {useLocale} from 'next-intl';
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

// Nội dung onboarding song ngữ. Mỗi vai trò: chào mừng → 4DX → phần của vai trò → xong.
function buildSteps(role: Role, locale: string): Step[] {
  const vi = locale !== 'en';
  const welcome: Step = {
    Icon: Sparkles,
    title: vi ? 'Chào mừng đến Việt Anh Class!' : 'Welcome to Viet Anh Class!',
    bullets: vi
      ? [
          'Ứng dụng giúp mỗi lớp lãnh đạo việc học tập và rèn luyện theo khung 4DX.',
          'Song ngữ Việt–Anh: đổi ngôn ngữ ở nút EN/VI góc trên bên phải.',
        ]
      : [
          'An app to help each class lead its learning and growth with the 4DX framework.',
          'Bilingual: switch language with the EN/VI button at the top right.',
        ],
  };
  const dx: Step = {
    Icon: Target,
    title: vi ? '4DX là gì?' : 'What is 4DX?',
    bullets: vi
      ? [
          'WIG — mục tiêu cực kỳ quan trọng, theo 4 lĩnh vực: Kiến thức, Kỹ năng, Tiếng Anh, Thể chất (có WIG năm và WIG tuần).',
          'Lead measure — hành vi dẫn dắt hằng ngày/tuần để đạt WIG (vd buổi tutor, hành vi văn hoá).',
          'Scoreboard — donut % + nhãn Đúng tiến độ / Giữa nhịp / Chậm tiến độ.',
          'Họp WIG — mỗi tuần ghi chiêm nghiệm, cam kết, việc tuần sau.',
        ]
      : [
          'WIG — Wildly Important Goals across 4 areas: Knowledge, Skills, English, Physical (yearly + weekly WIGs).',
          'Lead measures — the daily/weekly behaviors that drive the WIG (e.g. tutor sessions, culture behaviors).',
          'Scoreboard — a % donut with On track / Mid / Behind labels.',
          'WIG meeting — each week record reflection, commitments, next actions.',
        ],
  };
  const roleStep: Record<Role, Step> = {
    teacher: {
      Icon: GraduationCap,
      title: vi ? 'Bạn là Giáo viên chủ nhiệm' : "You're a Homeroom Teacher",
      bullets: vi
        ? [
            'Trang lớp: bảng điểm, thứ hạng thi đua, donut WIG 4 lĩnh vực.',
            'Điểm danh: chọn nhanh cả lớp rồi chỉnh vài em, lưu realtime.',
            'WIG 3 bước: ① Tạo WIG năm → ② Tạo WIG tuần → ③ Thêm Lead measure; bấm "Ghi +" để cộng tiến độ.',
            'Danh sách: bật "Trưởng điểm danh" cho 1 học sinh điểm danh thay (chỉ hôm nay).',
          ]
        : [
            'Class page: scoreboard, competition rank, 4-area WIG donuts.',
            'Attendance: tick the whole class fast, adjust a few, saves in realtime.',
            'WIG in 3 steps: ① yearly WIG → ② weekly WIG → ③ add lead measures; press "Log +" to add progress.',
            'Roster: set an "Attendance leader" so a student can mark attendance (today only).',
          ],
    },
    student: {
      Icon: Star,
      title: vi ? 'Bạn là Học sinh' : "You're a Student",
      bullets: vi
        ? [
            'Bảng thành tích của em: cảm xúc hôm nay, WIG năm/tuần, tick lead measure hằng ngày.',
            'Chọn cảm xúc mỗi ngày ở ô "Hôm nay em thế nào?".',
            'Nếu được giao "Trưởng điểm danh": điểm danh giúp lớp (chỉ hôm nay).',
          ]
        : [
            'My board: today\'s mood, yearly/weekly WIGs, daily lead-measure ticks.',
            'Pick your mood each day in "How are you today?".',
            'If you\'re the "Attendance leader": mark attendance for the class (today only).',
          ],
    },
    parent: {
      Icon: LineChart,
      title: vi ? 'Bạn là Phụ huynh' : "You're a Parent",
      bullets: vi
        ? [
            'Vào Báo cáo: chỉ xem dữ liệu con mình — điểm danh + tiến độ WIG theo tuần.',
            'Chọn tuần để xem kết quả từng lĩnh vực và chiêm nghiệm của con.',
            'Bạn không xem được dữ liệu của học sinh khác.',
          ]
        : [
            'Open Report: only your child\'s data — attendance + weekly WIG progress.',
            'Pick a week to see per-area results and your child\'s reflection.',
            'You cannot see other students\' data.',
          ],
    },
    principal: {
      Icon: Building2,
      title: vi ? 'Bạn là Ban giám hiệu' : "You're School Leadership",
      bullets: vi
        ? [
            'Báo cáo cơ sở: các lớp trong cơ sở mình — điểm thi đua + điểm danh hôm nay.',
            'Bạn không xem được cơ sở khác.',
          ]
        : [
            'Campus report: classes in your campus — competition score + today\'s attendance.',
            'You cannot see other campuses.',
          ],
    },
    admin: {
      Icon: ShieldCheck,
      title: vi ? 'Bạn là Quản trị viên' : "You're an Administrator",
      bullets: vi
        ? [
            'Tạo cơ sở, tạo lớp, phân công GVCN.',
            'Mời người dùng mới (chọn vai trò + lớp) — tự gán khi họ đăng nhập lần đầu.',
            'Đổi vai trò, vô hiệu, hoặc xoá người dùng; mời phụ huynh và gán con.',
          ]
        : [
            'Create campuses, classes, and assign homeroom teachers.',
            'Invite new users (pick role + class) — auto-assigned on first login.',
            'Change roles, disable, or delete users; invite parents and link children.',
          ],
    },
    pending: {
      Icon: Sparkles,
      title: vi ? 'Tài khoản đang chờ cấp quyền' : 'Account pending access',
      bullets: vi
        ? ['Liên hệ quản trị viên của trường để được gán vai trò.']
        : ['Contact your school administrator to be assigned a role.'],
    },
  };
  const done: Step = {
    Icon: PartyPopper,
    title: vi ? 'Sẵn sàng rồi!' : "You're all set!",
    bullets: vi
      ? ['Bạn có thể xem lại hướng dẫn này bất cứ lúc nào ở nút "Hướng dẫn" trên góc phải.']
      : ['You can replay this guide anytime from the "Guide" button at the top right.'],
  };
  return [welcome, dx, roleStep[role] ?? roleStep.pending, done];
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
  const locale = useLocale();
  const [open, setOpen] = useState(false);
  const [i, setI] = useState(0);
  const [mounted, setMounted] = useState(false);
  const [supabase] = useState(() => createClient());
  const seenRef = useRef(introSeen);
  const cardRef = useRef<HTMLDivElement>(null);

  const steps = useMemo(() => buildSteps(role, locale), [role, locale]);
  const vi = locale !== 'en';

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
      role="dialog"
      aria-modal="true"
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
        <div className="flex justify-center gap-1.5">
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
            className="cursor-pointer px-2 py-1 text-[13px] font-bold text-grey-mid transition-colors hover:text-navy"
          >
            {vi ? 'Bỏ qua' : 'Skip'}
          </button>
          <div className="flex items-center gap-2">
            {i > 0 && (
              <button
                type="button"
                onClick={() => setI((v) => v - 1)}
                className="inline-flex h-11 cursor-pointer items-center gap-1.5 rounded-xl border-[1.5px] border-navy/15 px-3.5 text-[13px] font-bold text-navy transition-colors hover:border-navy"
              >
                <ArrowLeft size={15} strokeWidth={2.5} />
                {vi ? 'Quay lại' : 'Back'}
              </button>
            )}
            <button
              type="button"
              onClick={() => (last ? finish() : setI((v) => v + 1))}
              className="btn-gold inline-flex h-11 cursor-pointer items-center gap-1.5 rounded-xl px-5 font-display text-[13.5px] font-bold"
            >
              {last ? (vi ? 'Bắt đầu' : 'Get started') : vi ? 'Tiếp tục' : 'Continue'}
              {!last && <ArrowRight size={15} strokeWidth={2.5} />}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}

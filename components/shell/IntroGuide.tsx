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

// Nội dung onboarding song ngữ. Mỗi vai trò: chào mừng → cách lớp làm việc → phần của vai trò → xong.
//
// VIẾT LẠI 13/08/2026. Bản cũ sai hai chuyện, và cả hai đều nằm ở thứ đầu tiên người mới đọc:
//
//   · Nó chỉ đường tới hai cái nút KHÔNG CÓ THẬT ở chỗ nó nói — "nút EN/VI góc trên bên phải" và
//     'nút "Hướng dẫn" trên góc phải'. Góc phải chỉ có chuông và bánh răng; cả hai thứ ấy nằm
//     TRONG menu bánh răng. Người mới lần đầu vào app đi tìm và không thấy.
//     (Bản cũ còn bảo giáo viên bấm "Ghi +" để cộng tiến độ — nút ấy đã bỏ từ 0073, nay các em
//     tự tick.)
//   · Nó là trang thuyết trình tư vấn đặt nhầm chỗ: "lãnh đạo việc học tập theo khung 4DX",
//     "WIG", "Lead measure", "Scoreboard", "buổi tutor", "hành vi văn hoá" — cho học sinh lớp 6.
//     Thuật ngữ nào giữ lại thì phải giải thích ngay bằng tiếng Việt thường.
//
// Xưng hô: chỉ "bạn", thống nhất với toàn bộ màn hình học sinh (chủ dự án chốt 13/08/2026).
function buildSteps(role: Role, locale: string): Step[] {
  const vi = locale !== 'en';
  const welcome: Step = {
    Icon: Sparkles,
    title: vi ? 'Chào mừng đến Việt Anh Class!' : 'Welcome to Viet Anh Class!',
    bullets: vi
      ? [
          'Đây là chỗ cả lớp cùng theo dõi mục tiêu của năm, và bạn theo dõi việc mình làm mỗi ngày.',
          'Muốn đọc bằng tiếng Anh: bấm hình bánh răng ở góc trên bên phải, chọn "Ngôn ngữ".',
        ]
      : [
          'This is where your class tracks its goals for the year, and you track what you do each day.',
          'To read in Vietnamese: press the gear icon at the top right and pick "Language".',
        ],
  };
  const dx: Step = {
    Icon: Target,
    title: vi ? 'Lớp mình làm việc thế nào?' : 'How your class works',
    bullets: vi
      ? [
          'Mục tiêu — điều quan trọng nhất lớp muốn đạt trong năm, ở 4 mảng: Kiến thức, Kỹ năng lãnh đạo, Phẩm chất, Sức khoẻ thể chất.',
          'Việc làm đều — việc nhỏ bạn làm hằng ngày để đi tới mục tiêu, ví dụ làm bài tập mỗi tối. Làm xong thì tick vào ô của ngày hôm đó.',
          'Bảng tiến độ — vòng tròn phần trăm cho biết bạn đang đi đúng nhịp, giữa nhịp hay chậm so với kế hoạch.',
          'Họp với bạn — mỗi tuần em ngồi với bạn cùng nhóm nhìn lại tuần vừa rồi, rút ra điều gì, rồi hứa việc tuần tới.',
        ]
      : [
          'Goals (WIGs) — the most important things your class wants to reach this year, in 4 domains: Knowledge, Leadership skills, Character, Physical Well-being.',
          'Daily habits — the small things you do every day to get there, like homework each evening. Tick the box for the day once you have done it.',
          'Progress ring — a percentage that tells you whether you are on track, mid-pace, or behind.',
          'Class meeting — each week the class looks back at the numbers, says what it learned, and promises what comes next.',
        ],
  };
  const roleStep: Record<Role, Step> = {
    teacher: {
      Icon: GraduationCap,
      title: vi ? 'Bạn là Giáo viên chủ nhiệm' : "You're a Homeroom Teacher",
      bullets: vi
        ? [
            'Trang lớp: bảng điểm, thứ hạng thi đua, vòng tròn mục tiêu 4 lĩnh vực.',
            'Điểm danh: chọn nhanh cả lớp rồi chỉnh vài em, lưu realtime.',
            'Mục tiêu 3 bước: ① Tạo mục tiêu năm → ② Cam kết tuần → ③ Thêm việc để các em tick. Tiến độ do chính các em tick mà thành, giáo viên không cộng tay.',
            'Danh sách: bật "Trưởng điểm danh" cho 1 học sinh điểm danh thay (chỉ hôm nay).',
          ]
        : [
            'Class page: scoreboard, competition rank, 4-area WIG donuts.',
            'Attendance: tick the whole class fast, adjust a few, saves in realtime.',
            'WIG in 3 steps: ① yearly goal → ② weekly goal → ③ add the work students tick. Progress comes from their own ticks — teachers do not add it by hand.',
            'Roster: set an "Attendance leader" so a student can mark attendance (today only).',
          ],
    },
    student: {
      Icon: Star,
      title: vi ? 'Bạn là Học sinh' : "You're a Student",
      bullets: vi
        ? [
            'Mở "Bảng điểm của tôi" là thấy đủ: cảm xúc hôm nay, mục tiêu của bạn, và những việc cần tick.',
            'Mỗi ngày chọn một mặt cười ở ô "Hôm nay bạn thế nào?" — đó cũng chính là điểm danh của bạn.',
            'Nếu được giao "Trưởng điểm danh": bạn điểm danh giúp cả lớp (chỉ trong hôm nay).',
          ]
        : [
            'Open "My board" to find everything: today\'s mood, your goals, and the work to tick.',
            'Pick a face each day in "How are you today?" — that is also your attendance.',
            'If you\'re the "Attendance leader": mark attendance for the class (today only).',
          ],
    },
    parent: {
      Icon: LineChart,
      title: vi ? 'Bạn là Phụ huynh' : "You're a Parent",
      bullets: vi
        ? [
            'Vào Báo cáo: chỉ xem dữ liệu con mình — điểm danh + tiến độ mục tiêu theo tuần.',
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
      ? ['Muốn xem lại hướng dẫn này: bấm hình bánh răng ở góc trên bên phải, chọn "Hướng dẫn".']
      : ['To replay this guide: press the gear icon at the top right and pick "Guide".'],
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

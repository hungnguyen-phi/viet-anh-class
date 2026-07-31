'use client';

import {useEffect, useMemo, useRef, useState, type RefObject} from 'react';
import {createPortal} from 'react-dom';
import {useTranslations} from 'next-intl';
import {useRouter} from '@/i18n/navigation';
import {Clock, Pencil, Loader2, WifiOff} from 'lucide-react';
import {checkinMood} from '@/app/[locale]/(dashboard)/student/actions';
import {useFocusTrap} from '@/lib/useFocusTrap';
import type {Database} from '@/lib/database.types';

export type MoodKey = Database['public']['Enums']['mood_level'];

// Mặt cảm xúc — màu = tín hiệu trạng thái (PRD §6.1). Vẽ bằng SVG path (không emoji).
const FACE = 'M12 2a10 10 0 1 0 0 20 10 10 0 1 0 0-20';
const MOODS: {key: MoodKey; bg: string; fg: string; paths: string[]}[] = [
  {key: 'great', bg: '#1e8a5a', fg: '#ffffff', paths: ['M18 13a6 6 0 0 1-6 5 6 6 0 0 1-6-5h12Z', 'M9 9h.01', 'M15 9h.01']},
  {key: 'good', bg: '#7bb662', fg: '#12351f', paths: ['M8 14s1.5 2 4 2 4-2 4-2', 'M9 9h.01', 'M15 9h.01']},
  {key: 'ok', bg: '#f9dd0e', fg: '#26275d', paths: ['M8 15h8', 'M9 9h.01', 'M15 9h.01']},
  {key: 'low', bg: '#e08a00', fg: '#ffffff', paths: ['M16 16s-1.5-2-4-2-4 2-4 2', 'M9 9h.01', 'M15 9h.01']},
  {key: 'bad', bg: '#e0483a', fg: '#ffffff', paths: ['M16 16s-1.5-2-4-2-4 2-4 2', 'M7.5 8 10 9', 'm14 9 2.5-1', 'M9 10h.01', 'M15 10h.01']},
];
// Thứ tự hiển thị trái→phải: rất buồn (đỏ) → tuyệt vời (xanh).
const DISPLAY: MoodKey[] = ['bad', 'low', 'ok', 'good', 'great'];

function Face({paths, size}: {paths: string[]; size: number}) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d={FACE} />
      {paths.map((d, i) => (
        <path key={i} d={d} />
      ))}
    </svg>
  );
}

// Đồng hồ HH:MM (giờ máy) — thông tin nhẹ, cập nhật mỗi phút. Dùng chung popup Sửa + lớp chặn.
function useClock() {
  const [now, setNow] = useState('');
  useEffect(() => {
    const tick = () =>
      setNow(new Intl.DateTimeFormat('vi-VN', {hour: '2-digit', minute: '2-digit', hour12: false}).format(new Date()));
    tick();
    const id = setInterval(tick, 30_000);
    return () => clearInterval(id);
  }, []);
  return now;
}

// Thẻ chọn cảm xúc — DÙNG CHUNG cho popup "Sửa" và lớp chặn bắt buộc check-in.
// Giữ nguyên toàn bộ class/style cũ để không đổi giao diện.
function MoodCard({
  draft,
  onPick,
  onSend,
  saving,
  err,
  now,
  required,
  cardRef,
}: {
  draft: MoodKey | null;
  onPick: (k: MoodKey) => void;
  onSend: () => void;
  saving: boolean;
  err: string | null;
  now: string;
  required?: boolean;
  cardRef: RefObject<HTMLDivElement | null>;
}) {
  const t = useTranslations('student');
  const byKey = useMemo(() => new Map(MOODS.map((m) => [m.key, m])), []);
  return (
    <div
      ref={cardRef}
      tabIndex={-1}
      role="dialog"
      aria-modal="true"
      aria-labelledby="mood-title"
      className="w-[440px] max-w-full rounded-[26px] bg-white p-6 pb-5 shadow-pop outline-none ring-1 ring-navy/10"
      onClick={(e) => e.stopPropagation()}
    >
      <div id="mood-title" className="text-center font-display text-[21px] font-bold text-navy">{t('mood')}</div>
      <div className="mt-1.5 flex items-center justify-center gap-1.5 text-[14px] font-extrabold text-navy">
        <Clock size={14} strokeWidth={2.5} />
        {now}
      </div>
      {required && (
        <div className="mt-2 text-center text-[12.5px] font-bold text-gold-text">{t('moodRequired')}</div>
      )}
      <div className="mt-4 flex justify-center gap-2.5">
        {DISPLAY.map((k) => {
          const m = byKey.get(k)!;
          const active = draft === k;
          return (
            <button
              key={k}
              type="button"
              title={t(`levels.${k}`)}
              aria-label={t(`levels.${k}`)}
              onClick={() => onPick(k)}
              className="grid h-[70px] w-[60px] cursor-pointer place-items-center rounded-[18px] transition-all"
              style={{
                background: m.bg,
                color: m.fg,
                opacity: draft === null || active ? 1 : 0.4,
                transform: active ? 'scale(1.12)' : 'scale(1)',
                boxShadow: active
                  ? '0 0 0 3px #26275d, 0 8px 20px rgba(38,39,93,0.3)'
                  : '0 4px 12px rgba(38,39,93,0.18)',
              }}
            >
              <Face paths={m.paths} size={30} />
            </button>
          );
        })}
      </div>
      {draft && (
        <div className="mt-3 text-center text-sm font-bold text-navy">{t(`levels.${draft}`)}</div>
      )}
      {err && (
        <div className="mt-3 flex items-center justify-center gap-1.5 rounded-[12px] border border-status-bad/30 bg-status-bad/[0.08] px-3 py-2 text-center text-[12.5px] font-bold text-status-bad">
          <WifiOff size={14} strokeWidth={2.5} className="shrink-0" />
          {err}
        </div>
      )}
      <button
        type="button"
        onClick={onSend}
        disabled={!draft || saving}
        className="btn-gold mx-auto mt-4 flex h-11 cursor-pointer items-center gap-2 rounded-xl px-8 font-display text-[14px] font-bold disabled:opacity-45"
      >
        {saving && <Loader2 size={15} className="animate-spin" />}
        {draft ? t('moodSend') : t('moodPickFirst')}
      </button>
    </div>
  );
}

// ============================================================
// Lớp CHẶN — bắt buộc check-in mới dùng tiếp.
// Chỉ được render khi: chính em đó CHƯA check-in hôm nay VÀ đang ở trong mạng trường
// (ngoài mạng trường thì student_checkin() trả 'blocked' → chặn sẽ khoá cứng em ở nhà,
//  nên StudentScoreboard không render lớp này, cho xem read-only).
//
// KHÔNG dùng portal như popup "Sửa": portal cần `document` nên chỉ chạy sau khi hydrate
// → trễ ~1s mới hiện. Ở đây render thẳng trong cây server (đặt NGOÀI hero vì hero có
// backdrop-filter, vốn tạo containing block làm hỏng position:fixed) → có ngay trong HTML
// đầu tiên. Không đóng được: không bắt Esc, không bắt click nền.
// ============================================================
export function MoodGate() {
  const t = useTranslations('student');
  const router = useRouter();
  const now = useClock();
  const [draft, setDraft] = useState<MoodKey | null>(null);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  useFocusTrap(true, cardRef);

  async function send() {
    if (!draft || saving) return;
    setSaving(true);
    setErr(null);
    const res = await checkinMood(draft);
    setSaving(false);
    if (res.ok) {
      // Server render lại → mood đã có → lớp chặn tự biến mất.
      router.refresh();
    } else if (res.blocked) {
      setErr(t('moodBlocked'));
    } else if (res.noClass) {
      setErr(t('moodNoClass'));
    } else {
      setErr(t('moodError'));
    }
  }

  return (
    <div className="animate-fade fixed inset-0 z-50 flex items-center justify-center bg-navy/25 p-5 backdrop-blur-[10px]">
      <MoodCard
        draft={draft}
        onPick={setDraft}
        onSend={send}
        saving={saving}
        err={err}
        now={now}
        required
        cardRef={cardRef}
      />
    </div>
  );
}

export function MoodCheckin({
  initialMood,
  canEdit,
  gated = false,
}: {
  initialMood: MoodKey | null;
  canEdit: boolean;
  // true = <MoodGate> đang lo việc check-in lần đầu → đừng tự mở popup nữa (tránh 2 lớp phủ).
  gated?: boolean;
}) {
  const t = useTranslations('student');
  const router = useRouter();
  const [mood, setMood] = useState<MoodKey | null>(initialMood);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<MoodKey | null>(initialMood);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const now = useClock();
  // Portal cần document → chỉ bật sau khi mount (tránh lệch SSR).
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  // Đóng popup → xoá thông báo lỗi cũ (mở lại không thấy lỗi thừa).
  useEffect(() => {
    if (!open) setErr(null);
  }, [open]);
  // Bẫy focus trong popup: đưa focus vào khi mở, giữ Tab, trả focus khi đóng.
  const cardRef = useRef<HTMLDivElement>(null);
  useFocusTrap(open && canEdit && mounted, cardRef);

  const byKey = useMemo(() => new Map(MOODS.map((m) => [m.key, m])), []);

  // Tự mở popup lần đầu trong ngày nếu học sinh chưa check-in — TRỪ khi <MoodGate> đã chặn.
  useEffect(() => {
    if (!gated && canEdit && initialMood === null) setOpen(true);
  }, [gated, canEdit, initialMood]);

  // Đóng bằng phím Esc khi popup mở (popup "Sửa" là tự nguyện nên vẫn cho thoát).
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  async function send() {
    if (!draft || saving) return;
    setSaving(true);
    setErr(null);
    // Check-in = cảm xúc + điểm danh, có cổng IP mạng trường (kiểm ở server).
    const res = await checkinMood(draft);
    setSaving(false);
    if (res.ok) {
      setMood(draft);
      setOpen(false);
      router.refresh();
    } else if (res.blocked) {
      setErr(t('moodBlocked'));
    } else if (res.noClass) {
      setErr(t('moodNoClass'));
    } else {
      setErr(t('moodError'));
    }
  }

  return (
    <>
      {/* Inline trong hero */}
      <div className="flex flex-col justify-center gap-2.5">
        <div className="flex items-center gap-2">
          <span className="whitespace-nowrap text-[13px] font-extrabold text-gold-text">
            {t('mood')}
          </span>
          <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-navy/[0.07] px-2.5 py-1 text-[11px] font-extrabold text-navy">
            <Clock size={11} strokeWidth={2.5} />
            {now}
          </span>
          {canEdit && (
            <button
              type="button"
              onClick={() => {
                setDraft(mood);
                setOpen(true);
              }}
              className="inline-flex cursor-pointer items-center gap-1 rounded-full border-[1.5px] border-navy/20 bg-white/50 px-3 py-[5px] text-[11.5px] font-extrabold text-navy transition-colors hover:border-navy hover:bg-white"
            >
              <Pencil size={11} strokeWidth={2.5} />
              {t('moodEdit')}
            </button>
          )}
        </div>
        <div className="flex items-center justify-center gap-2.5">
          {DISPLAY.map((k) => {
            const m = byKey.get(k)!;
            const active = mood === k;
            return (
              <button
                key={k}
                type="button"
                title={t(`levels.${k}`)}
                aria-label={t(`levels.${k}`)}
                onClick={() => {
                  if (!canEdit) return;
                  setDraft(mood);
                  setOpen(true);
                }}
                className={`grid h-11 w-11 place-items-center rounded-full transition-all ${
                  canEdit ? 'cursor-pointer' : 'cursor-default'
                }`}
                style={{
                  background: m.bg,
                  color: m.fg,
                  opacity: active ? 1 : 0.4,
                  boxShadow: active ? '0 0 0 2.5px #26275d' : 'none',
                }}
              >
                <Face paths={m.paths} size={24} />
              </button>
            );
          })}
        </div>
      </div>

      {/* Popup chọn cảm xúc — portal ra body để phủ full màn (thoát overflow/backdrop-filter của hero) */}
      {open &&
        canEdit &&
        mounted &&
        createPortal(
          <div
            className="animate-fade fixed inset-0 z-50 flex items-center justify-center bg-navy/25 p-5 backdrop-blur-[10px]"
            onClick={() => setOpen(false)}
          >
            <MoodCard
              draft={draft}
              onPick={setDraft}
              onSend={send}
              saving={saving}
              err={err}
              now={now}
              cardRef={cardRef}
            />
          </div>,
          document.body,
        )}
    </>
  );
}

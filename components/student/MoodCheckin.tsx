'use client';

import {useEffect, useMemo, useState} from 'react';
import {createPortal} from 'react-dom';
import {useTranslations} from 'next-intl';
import {useRouter} from '@/i18n/navigation';
import {Clock, Pencil, Loader2} from 'lucide-react';
import {createClient} from '@/lib/supabase/client';
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

export function MoodCheckin({
  initialMood,
  canEdit,
}: {
  initialMood: MoodKey | null;
  canEdit: boolean;
}) {
  const t = useTranslations('student');
  const router = useRouter();
  const [mood, setMood] = useState<MoodKey | null>(initialMood);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<MoodKey | null>(initialMood);
  const [saving, setSaving] = useState(false);
  const [supabase] = useState(() => createClient());
  const [now, setNow] = useState('');
  // Portal cần document → chỉ bật sau khi mount (tránh lệch SSR).
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // Đồng hồ HH:MM (giờ máy) — thông tin nhẹ, cập nhật mỗi phút.
  useEffect(() => {
    const tick = () =>
      setNow(new Intl.DateTimeFormat('vi-VN', {hour: '2-digit', minute: '2-digit', hour12: false}).format(new Date()));
    tick();
    const id = setInterval(tick, 30_000);
    return () => clearInterval(id);
  }, []);

  // Tự mở popup lần đầu trong ngày nếu học sinh chưa check-in.
  useEffect(() => {
    if (canEdit && initialMood === null) setOpen(true);
  }, [canEdit, initialMood]);

  const byKey = useMemo(() => new Map(MOODS.map((m) => [m.key, m])), []);

  async function send() {
    if (!draft || saving) return;
    setSaving(true);
    const {error} = await supabase.rpc('set_my_mood', {p_mood: draft});
    setSaving(false);
    if (!error) {
      setMood(draft);
      setOpen(false);
      router.refresh();
    }
  }

  return (
    <>
      {/* Inline trong hero */}
      <div className="flex flex-col justify-center gap-2.5">
        <div className="flex items-center gap-2">
          <span className="whitespace-nowrap text-[13px] font-extrabold text-gold-deep">
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
          <div className="animate-fade fixed inset-0 z-50 flex items-center justify-center bg-navy/25 p-5 backdrop-blur-[10px]">
          <div className="w-[440px] max-w-full rounded-[26px] bg-white/55 p-6 pb-5 shadow-pop ring-1 ring-white/75 backdrop-blur-[36px]">
            <div className="text-center font-display text-[21px] font-bold text-navy">{t('mood')}</div>
            <div className="mt-1.5 flex items-center justify-center gap-1.5 text-[14px] font-extrabold text-navy">
              <Clock size={14} strokeWidth={2.5} />
              {now}
            </div>
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
                    onClick={() => setDraft(k)}
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
            <button
              type="button"
              onClick={send}
              disabled={!draft || saving}
              className="btn-gold mx-auto mt-4 flex h-10 cursor-pointer items-center gap-2 rounded-xl px-8 font-display text-[14px] font-bold disabled:opacity-45"
            >
              {saving && <Loader2 size={15} className="animate-spin" />}
              {draft ? t('moodSend') : t('moodPickFirst')}
            </button>
          </div>
        </div>,
          document.body,
        )}
    </>
  );
}

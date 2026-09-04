'use client';

import {useEffect, useMemo, useRef, useState, type RefObject} from 'react';
import {createPortal} from 'react-dom';
import {useTranslations} from 'next-intl';
import {useRouter} from '@/i18n/navigation';
import {Clock, Pencil, Loader2, WifiOff} from 'lucide-react';
import {checkinMood} from '@/app/[locale]/(dashboard)/student/mood-actions';
import {useFocusTrap} from '@/lib/useFocusTrap';
import type {Database} from '@/lib/database.types';

export type MoodKey = Database['public']['Enums']['mood_level'];

// Mặt cảm xúc — màu = tín hiệu trạng thái (PRD §6.1). Vẽ bằng SVG path (không emoji).
const FACE = 'M12 2a10 10 0 1 0 0 20 10 10 0 1 0 0-20';
// 6 CẢM XÚC CỦA PRD V3 (9.2) + 5 mức thang cũ. Bộ CHỌN chỉ đưa ra 6 loại mới; 5 khoá cũ giữ
// lại để lịch sử check-in trước 18/08/2026 vẫn hiện đúng mặt — dịch "low" thành "mệt" là bịa
// lại cảm xúc trẻ đã bấm.
const MOODS: {key: MoodKey; bg: string; fg: string; paths: string[]}[] = [
  {key: 'happy', bg: '#1e8a5a', fg: '#ffffff', paths: ['M8 14s1.5 2 4 2 4-2 4-2', 'M9 9h.01', 'M15 9h.01']},
  {key: 'okay', bg: '#f9dd0e', fg: '#26275d', paths: ['M8 15h8', 'M9 9h.01', 'M15 9h.01']},
  {key: 'sad', bg: '#6b7bb8', fg: '#ffffff', paths: ['M16 16s-1.5-2-4-2-4 2-4 2', 'M9 9h.01', 'M15 9h.01']},
  {key: 'tired', bg: '#8d8d99', fg: '#ffffff', paths: ['M8 15h8', 'M8 9.5h2', 'M14 9.5h2']},
  {key: 'worried', bg: '#e08a00', fg: '#ffffff', paths: ['M16 16s-1.5-2-4-2-4 2-4 2', 'M8 7.5c.8-.8 2-.8 2.6 0', 'M13.4 7.5c.8-.8 2-.8 2.6 0', 'M9 10h.01', 'M15 10h.01']},
  {key: 'angry', bg: '#e0483a', fg: '#ffffff', paths: ['M16 16s-1.5-2-4-2-4 2-4 2', 'M7.5 8 10 9', 'm14 9 2.5-1', 'M9 10h.01', 'M15 10h.01']},
  // ── thang 5 mức cũ, chỉ để đọc lịch sử ──
  {key: 'great', bg: '#1e8a5a', fg: '#ffffff', paths: ['M18 13a6 6 0 0 1-6 5 6 6 0 0 1-6-5h12Z', 'M9 9h.01', 'M15 9h.01']},
  {key: 'good', bg: '#7bb662', fg: '#12351f', paths: ['M8 14s1.5 2 4 2 4-2 4-2', 'M9 9h.01', 'M15 9h.01']},
  {key: 'ok', bg: '#f9dd0e', fg: '#26275d', paths: ['M8 15h8', 'M9 9h.01', 'M15 9h.01']},
  {key: 'low', bg: '#e08a00', fg: '#ffffff', paths: ['M16 16s-1.5-2-4-2-4 2-4 2', 'M9 9h.01', 'M15 9h.01']},
  {key: 'bad', bg: '#e0483a', fg: '#ffffff', paths: ['M16 16s-1.5-2-4-2-4 2-4 2', 'M7.5 8 10 9', 'm14 9 2.5-1', 'M9 10h.01', 'M15 10h.01']},
];
// Thứ tự Ô CHỌN trái→phải: khó chịu (đỏ) → vui (xanh) — đúng nhịp bộ cũ.
const DISPLAY: MoodKey[] = ['angry', 'worried', 'tired', 'sad', 'okay', 'happy'];

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
  const byKey = useMemo(() => new Map(MOODS.map((m) => [m.key, m])), []);  return (
    <div
      ref={cardRef}
      tabIndex={-1}
      role="dialog"
      aria-modal="true"
      aria-labelledby="mood-title"
      className="w-[440px] max-w-full rounded-[20px] bg-white p-6 pb-5 shadow-pop outline-none ring-1 ring-navy/10"
      onClick={(e) => e.stopPropagation()}
    >
      <div id="mood-title" className="text-center font-display text-dau font-bold text-navy">{t('mood')}</div>
      <div className="mt-1.5 flex items-center justify-center gap-1.5 text-noi-dung font-extrabold text-navy">
        <Clock size={14} strokeWidth={2.5} />
        {now}
      </div>
      {required && (
        <div className="mt-2 text-center text-than font-bold text-gold-text">{t('moodRequired')}</div>
      )}
      <div className="mt-4 flex justify-center gap-1.5">
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
              className="grid h-[70px] w-[52px] shrink-0 cursor-pointer place-items-center rounded-[20px] transition-all"
              style={{
                background: m.bg,
                color: m.fg,
                opacity: draft === null || active ? 1 : 0.4,
                transform: active ? 'scale(1.12)' : 'scale(1)',
                boxShadow: active
                  ? '0 0 0 3px var(--color-navy), 0 8px 20px rgba(38,39,93,0.3)'
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
        <div className="mt-3 flex items-center justify-center gap-1.5 rounded-[12px] border border-status-bad/30 bg-status-bad/[0.08] px-3 py-2 text-center text-than font-bold text-status-bad">
          <WifiOff size={14} strokeWidth={2.5} className="shrink-0" />
          {err}
        </div>
      )}
      <button
        type="button"
        onClick={onSend}
        disabled={!draft || saving}
        className="btn-gold mx-auto mt-4 flex h-11 cursor-pointer items-center gap-2 rounded-[12px] px-8 font-display text-noi-dung font-bold disabled:opacity-45"
      >
        {saving && <Loader2 size={16} className="animate-spin" />}
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

export type CuaSo = {
  /** Mốc thời gian (ISO) của cửa sổ hôm nay, tính ở server theo giờ Việt Nam. */
  moLuc: string;
  hetDungGio: string;
  hetMuon: string;
  chieuMo: string;
  chieuDong: string;
};

export function MoodCheckin({
  initialMood,
  initialMoodChieu = null,
  canEdit,
  gated = false,
  gioBam = null,
  gioBamChieu = null,
  cuaSo = null,
}: {
  initialMood: MoodKey | null;
  /** Cảm xúc buổi CHIỀU hôm nay — buổi chiều là một lượt check-in riêng, không đè lên buổi sáng. */
  initialMoodChieu?: MoodKey | null;
  canEdit: boolean;
  // true = <MoodGate> đang lo việc check-in lần đầu → đừng tự mở popup nữa (tránh 2 lớp phủ).
  gated?: boolean;
  /** Giờ bạn đã bấm buổi sáng (ISO), để hiện ngay dưới icon. */
  gioBam?: string | null;
  /** Giờ bạn đã bấm buổi chiều (ISO). */
  gioBamChieu?: string | null;
  /** Cửa sổ check-in của cơ sở. null = chưa cấu hình → giữ nguyên hành vi cũ (bấm lúc nào cũng được). */
  cuaSo?: CuaSo | null;
}) {
  const t = useTranslations('student');
  const router = useRouter();
  const [moodSang, setMoodSang] = useState<MoodKey | null>(initialMood);
  const [moodChieu, setMoodChieu] = useState<MoodKey | null>(initialMoodChieu);
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

  // CỬA SỔ THỜI GIAN.
  //
  // `now` chỉ nhích mỗi 30 giây nên vừa đủ để mở/đóng cửa đúng phút, và cố ý KHÔNG đếm từng giây:
  // một đồng hồ đếm ngược chạy giật trên màn hình của trẻ con là thứ gây căng thẳng chứ không giúp
  // gì. Server mới là nơi quyết định thật (hàm student_checkin cũng kiểm lại cửa sổ) — chỗ này chỉ
  // để không mời em bấm một cái nút chắc chắn sẽ bị từ chối.
  const [tick, setTick] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setTick(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);
  // BUỔI NÀO ĐANG MỞ — TỰ TÍNH, KHÔNG NHẬN TỪ NGOÀI.
  //
  // Trước 13/08/2026 chỗ này nhận một prop `buoi` mặc định `'sang'`, mà nơi gọi duy nhất
  // (StudentScoreboard) lại không bao giờ truyền. Hệ quả: chỉ cửa sổ SÁNG được xét, nên từ 8h
  // sáng trở đi mọi ngày mặt cười đều bấm không ăn, trong khi chính màn hình lại hứa "chiều từ
  // 16h00" và hàm student_checkin dưới CSDL vẫn nhận buổi chiều. Cả tính năng check-in chiều
  // chết lặng suốt thời gian đó. Nay buổi được suy ra từ chính cửa sổ: qua giờ mở buổi chiều
  // thì đang là buổi chiều, còn lại là buổi sáng.
  const trangThaiCua = useMemo(() => {
    if (!cuaSo) return {mo: true, muon: false, khoaCamXuc: false, buoi: 'sang' as const};
    const t0 = tick;
    const g = (s: string) => new Date(s).getTime();
    if (t0 >= g(cuaSo.chieuMo)) {
      // Buổi chiều không có khái niệm "muộn": nó không thay điểm danh đầu giờ.
      return {mo: t0 <= g(cuaSo.chieuDong), muon: false, khoaCamXuc: false, buoi: 'chieu' as const};
    }
    const mo = t0 >= g(cuaSo.moLuc) && t0 <= g(cuaSo.hetMuon);
    return {
      mo,
      muon: t0 > g(cuaSo.hetDungGio),
      khoaCamXuc: t0 > g(cuaSo.hetDungGio),
      buoi: 'sang' as const,
    };
  }, [cuaSo, tick]);

  const buoi = trangThaiCua.buoi;
  const mood = buoi === 'chieu' ? moodChieu : moodSang;
  const setMood = buoi === 'chieu' ? setMoodChieu : setMoodSang;

  // Sửa được khi: là chính bạn, cửa còn mở, VÀ chưa quá giờ khoá cảm xúc.
  // Đã bấm rồi mà chưa tới giờ khoá thì vẫn đổi được — bấm nhầm mặt cười là chuyện thường.
  const suaDuoc = canEdit && trangThaiCua.mo && !(mood !== null && trangThaiCua.khoaCamXuc);

  const gioBamVN = useMemo(() => {
    const iso = buoi === 'chieu' ? gioBamChieu : gioBam;
    if (!iso) return null;
    return new Intl.DateTimeFormat('vi-VN', {
      timeZone: 'Asia/Ho_Chi_Minh',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(new Date(iso));
  }, [gioBam, gioBamChieu, buoi]);

  // GIỜ MỞ CỬA, LẤY TỪ CẤU HÌNH CƠ SỞ — không viết cứng trong câu chữ.
  //
  // Câu cũ ghi cứng "Sáng nhận từ 6h30 đến 8h00, chiều từ 16h00": trường đổi giờ vào lớp trong
  // bảng campuses là câu này nói sai ngay, mà không ai biết. Và nó bỏ lửng giờ ĐÓNG buổi chiều
  // nên bạn nào mở app lúc 17h30 đọc câu ấy vẫn tưởng mình bấm được.
  const gioCua = useMemo(() => {
    if (!cuaSo) return null;
    const f = (s: string) =>
      new Intl.DateTimeFormat('vi-VN', {
        timeZone: 'Asia/Ho_Chi_Minh',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      }).format(new Date(s));
    return {
      sangMo: f(cuaSo.moLuc),
      sangDong: f(cuaSo.hetMuon),
      chieuMo: f(cuaSo.chieuMo),
      chieuDong: f(cuaSo.chieuDong),
    };
  }, [cuaSo]);

  const cauDongCua = gioCua
    ? t('moodClosedAt', {
        sang1: gioCua.sangMo,
        sang2: gioCua.sangDong,
        chieu1: gioCua.chieuMo,
        chieu2: gioCua.chieuDong,
      })
    : t('moodClosed');



  // Tự mở popup lần đầu trong BUỔI nếu học sinh chưa check-in — TRỪ khi <MoodGate> đã chặn.
  // Theo `mood` của buổi đang mở, không theo prop buổi sáng: qua 16h mà sáng đã bấm rồi thì
  // buổi chiều vẫn phải tự mở ra hỏi.
  useEffect(() => {
    if (!gated && suaDuoc && mood === null) {
      setDraft(null);
      setOpen(true);
    }
  }, [gated, suaDuoc, mood]);

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
    const res = await checkinMood(draft, buoi);
    setSaving(false);
    if (res.ok) {
      setMood(draft);
      setOpen(false);
      router.refresh();
    } else if (res.blocked) {
      setErr(t('moodBlocked'));
    } else if (res.noClass) {
      setErr(t('moodNoClass'));
    } else if (res.closed) {
      // Không phải lỗi: em bấm sớm quá hoặc muộn quá. Nói giờ nào bấm được, đừng nói "đã xảy ra lỗi".
      setErr(cauDongCua);
    } else {
      setErr(t('moodError'));
    }
  }

  return (
    <>
      {/* Inline trong hero */}
      <div className="flex flex-col justify-center gap-2.5">
        <div className="flex items-center gap-2">
          <span className="whitespace-nowrap text-than font-extrabold text-gold-text">
            {t('mood')}
          </span>
          <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-navy/[0.07] px-2.5 py-1 text-chu-thich font-extrabold text-navy">
            <Clock size={12} strokeWidth={2.5} />
            {now}
          </span>
          {suaDuoc && (
            <button
              type="button"
              onClick={() => {
                setDraft(mood);
                setOpen(true);
              }}
              className="inline-flex min-h-11 cursor-pointer items-center gap-1 rounded-full border-[1.5px] border-navy/20 bg-white/50 px-3 text-chu-thich font-extrabold text-navy transition-colors hover:border-navy hover:bg-white"
            >
              <Pencil size={12} strokeWidth={2.5} />
              {t('moodEdit')}
            </button>
          )}
        </div>
        <div className="flex items-center justify-center gap-1.5">
          {DISPLAY.map((k) => {
            const m = byKey.get(k)!;
            const active = mood === k;
            return (
              <button
                key={k}
                type="button"
                title={suaDuoc ? t(`levels.${k}`) : `${t(`levels.${k}`)} — ${cauDongCua}`}
                aria-label={t(`levels.${k}`)}
                // Ngoài giờ / đã khoá: nút THẬT SỰ tắt (audit 04/09/2026 — trước đây bấm được mà
                // không trả lời gì). Mặt đã chọn vẫn hiện rõ để em biết mình đã bấm gì.
                disabled={!suaDuoc}
                onClick={() => {
                  if (!suaDuoc) return;
                  setDraft(mood);
                  setOpen(true);
                }}
                className={`grid h-11 w-11 shrink-0 place-items-center rounded-full transition-all ${
                  suaDuoc ? 'cursor-pointer' : 'cursor-not-allowed'
                }`}
                style={{
                  background: m.bg,
                  color: m.fg,
                  opacity: active ? 1 : suaDuoc ? 0.4 : 0.25,
                  boxShadow: active ? '0 0 0 2.5px var(--color-navy)' : 'none',
                }}
              >
                <Face paths={m.paths} size={24} />
              </button>
            );
          })}
        </div>
        {/* GIỜ BẤM, ngay dưới icon.
            Trước đây màn hình chỉ hiện mặt cười, không nói em bấm lúc nào — mà từ khi check-in
            thay điểm danh thì giờ bấm CHÍNH LÀ bằng chứng em có mặt. Em phải nhìn thấy nó, và
            giáo viên hỏi lại thì em có cái để chỉ. */}
        {gioBamVN && (
          <div className="flex items-center justify-center gap-1.5 text-chu-thich font-bold">
            <Clock size={12} strokeWidth={2.5} className="text-grey-mid" />
            <span className="text-grey-mid">{t('moodAt', {time: gioBamVN})}</span>
            {trangThaiCua.muon && (
              <span className="rounded-full bg-warn/[0.16] px-2 py-0.5 text-chu-thich font-extrabold text-navy">
                {t('moodLate')}
              </span>
            )}
          </div>
        )}
        {/* Cửa đã đóng và em chưa bấm: nói giờ, đừng để một hàng icon bấm không ăn. */}
        {!trangThaiCua.mo && mood === null && (
          <p className="text-center text-chu-thich font-semibold italic text-grey-mid">
            {cauDongCua}
          </p>
        )}
        {/* Đã bấm và đã khoá: nói rõ vì sao không sửa được nữa. */}
        {mood !== null && trangThaiCua.khoaCamXuc && canEdit && (
          <p className="text-center text-chu-thich font-semibold italic text-grey-mid">
            {t('moodLocked')}
          </p>
        )}

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

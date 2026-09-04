'use client';

import {useActionState, useState} from 'react';
import {useTranslations} from 'next-intl';
import {AlertCircle, CheckCircle2, ChevronDown, Users} from 'lucide-react';
import {SubmitButton} from '@/components/ui/SubmitButton';
import {btnGold, btnGhost} from '@/components/ui/Field';
import {luuPdr, ghiNhanPdr, type PdrState} from '@/app/[locale]/(dashboard)/student/pdr-actions';

// ════════════════════════════════════════════════════════════════════════════
// HỌP PDR VỚI BUDDY — 6 câu hỏi, một chữ ký (PRD v3 6.2.7)
// ════════════════════════════════════════════════════════════════════════════
//
// Khối này đứng ở cột họp trên màn của em. Mỗi tuần một biên bản; em ghi 6 câu, bấm Ghi nhận là
// biên bản đóng (RLS 0146 không cho sửa nữa — Ghi nhận là chữ ký, và KPI chỉ đếm buổi đã ký).
// Câu 6 sinh cam kết tuần tới, bắt buộc chọn một WIG đã duyệt của chính em.
//
// Giáo viên mở trang của em thấy đúng biên bản này ở dạng đọc; form chỉ hiện với chính em.

export type PdrMeeting = {
  id: string;
  week_label: string;
  q1_plan: string | null;
  q2_result: string | null;
  q3_obstacle: string | null;
  q4_overcome: string | null;
  q5_better_way: string | null;
  q6_commitment: string | null;
  acknowledged_at: string | null;
};

export type WigDaDuyet = {id: string; title: string};

const CAU = ['q1_plan', 'q2_result', 'q3_obstacle', 'q4_overcome', 'q5_better_way', 'q6_commitment'] as const;

export function HopPdr({
  laChinhEm,
  tenBuddy,
  lich,
  bienBan,
  wigDaDuyet,
  weekLabel,
  weekStart,
  laTuanNay = true,
  moGhi = true,
  khoangNgay = null,
  tuanSau = null,
  loai = 'buddy',
}: {
  laChinhEm: boolean;
  /** buddy: tên các buddy GVCN đã ghép (rỗng = chưa ghép); coach: tên GVCN. */
  tenBuddy: string[];
  /** buddy: 'T5 · 15:30'; coach: 'ngày N hằng tháng'; null = chưa cài lịch. */
  lich: string | null;
  bienBan: PdrMeeting | null;
  wigDaDuyet: WigDaDuyet[];
  weekLabel: string;
  /**
   * Thứ Hai của tuần biên bản (chuỗi 'YYYY-MM-DD'). Khối này ĐI THEO THANH TUẦN — tuần nào biên
   * bản đó (chủ dự án 24/08/2026: "theo form theo tuần, tuần nào form đó là được"). Trước đây nó
   * ghim cứng vào tuần hiện tại, nên lùi về W34 thì cam kết đổi sang 17/08 mà khu họp vẫn đứng ở
   * W35 — hai nửa màn hình nói hai tuần khác nhau.
   */
  weekStart: string;
  /** Tuần đang mở có phải tuần hiện tại không — quyết định chữ trên chip ("Tuần này"/"Tuần đã qua"). */
  laTuanNay?: boolean;
  /** Tuần này còn ghi được không (tuần này + tuần trước). Tuần cũ hơn: chỉ đọc. */
  moGhi?: boolean;
  /** Khoảng ngày của tuần đang họp ('18/08–24/08') — "W34-2026" trần là mã máy, em không đọc ra. */
  khoangNgay?: string | null;
  /** Nhãn tuần SAU ('W35-2026') — để nói rõ cam kết ở câu 6 là chốt cho tuần nào. */
  tuanSau?: string | null;
  /** Cùng một biên bản 6 câu cho cả hai nhịp PDR của v3 (buddy tuần / GVCN tháng). */
  loai?: 'buddy' | 'coach';
}) {
  const t = useTranslations('pdr');
  const [luuState, luuAction] = useActionState<PdrState, FormData>(luuPdr, {ok: false});
  const [kyState, kyAction] = useActionState<PdrState, FormData>(ghiNhanPdr, {ok: false});
  const daKy = Boolean(bienBan?.acknowledged_at);
  // Biên bản đã ký thì gấp lại còn một dòng — tuần nào cũng bày đủ 6 câu đã đóng là chiếm nửa cột.
  const [moXem, setMoXem] = useState(false);

  const khungChu =
    'w-full rounded-[12px] border-[1.5px] border-navy/15 bg-white px-2.5 py-2 text-than font-semibold text-navy outline-none focus:border-navy';

  return (
    <section className="glass flex flex-col gap-3 rounded-[16px] p-4">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <h2 className="inline-flex items-center gap-1.5 font-display text-doc font-bold text-navy">
          <Users size={16} strokeWidth={2} className="text-gold-deep" />
          {t(loai === 'coach' ? 'titleCoach' : 'title')}
        </h2>
        {/* Chữ tuần đứng trước, mã tuần + khoảng ngày theo sau — em không giải mã "W34-2026"
            (19/08/2026). Từ 24/08/2026 khối đi theo thanh tuần, nên chữ này nói đúng tuần ĐANG
            MỞ chứ không còn đóng cứng "Tuần này". */}
        <span className="font-display text-than font-bold text-navy">
          {t(laTuanNay ? 'thisWeek' : 'tuanDaQua')}
        </span>
        <span className="rounded-full bg-navy/[0.06] px-2 py-0.5 text-chu-thich font-extrabold tabular-nums text-grey-mid">
          {weekLabel}
          {khoangNgay && ` · ${khoangNgay}`}
        </span>
        {daKy && (
          <span className="inline-flex items-center gap-1 rounded-full bg-success/[0.12] px-2 py-0.5 text-chu-thich font-extrabold text-success-dark">
            <CheckCircle2 size={12} strokeWidth={2.5} />
            {t('acked')}
          </span>
        )}
      </div>

      {tenBuddy.length === 0 && loai === 'buddy' ? (
        <p className="text-than font-semibold italic text-grey-mid">{t('noBuddy')}</p>
      ) : (
        <p className="text-than font-semibold text-grey-mid">
          <span className="font-extrabold text-navy">{tenBuddy.join(' · ')}</span>
          {lich && <> · {lich}</>}
        </p>
      )}

      {/* NHỊP CỦA BUỔI HỌP, nói một lần cho rõ: nhìn lại tuần VỪA QUA, chốt cam kết cho tuần
          SAU. Trước đây em phải tự suy từ 6 câu hỏi — "họp PDR tuần này hay tuần sau, cho tuần
          nào?" là câu chủ dự án hỏi nguyên văn (19/08/2026). Chỉ hiện khi biên bản còn mở:
          đã ký rồi thì dòng dạy nhịp chỉ còn là tiếng ồn. */}
      {!daKy && moGhi && (loai === 'coach' || tenBuddy.length > 0) && (
        <p className="rounded-[12px] bg-navy/[0.04] px-2.5 py-1.5 text-chu-thich font-semibold leading-relaxed text-grey-mid">
          {tuanSau ? t('nhip', {tuanSau}) : t('nhipKhongTuan')}
        </p>
      )}

      {/* ĐÃ KÝ → tóm tắt gấp; bấm mới mở đủ 6 câu. */}
      {daKy && bienBan && (
        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={() => setMoXem((v) => !v)}
            className="inline-flex min-h-[24px] cursor-pointer items-center gap-1 self-start text-chu-thich font-extrabold text-navy underline"
          >
            <ChevronDown size={12} strokeWidth={2.5} className={moXem ? 'rotate-180' : ''} />
            {moXem ? t('collapse') : t('expand')}
          </button>
          {moXem && (
            <dl className="flex flex-col gap-1.5">
              {CAU.map((c, i) => (
                <div key={c} className="rounded-[12px] bg-navy/[0.04] px-2.5 py-1.5">
                  <dt className="text-nhan font-extrabold uppercase text-grey-mid">{t(`q${i + 1}`)}</dt>
                  <dd className="text-than font-semibold text-navy">{bienBan[c] || '—'}</dd>
                </div>
              ))}
            </dl>
          )}
        </div>
      )}

      {/* TUẦN CŨ HƠN TUẦN TRƯỚC: chỉ đọc. Câu 6 sinh cam kết cho tuần KẾ TIẾP tuần biên bản —
          mở biên bản tháng trước rồi hứa cho một tuần đã đi qua là lời hứa không ai giữ được, và
          máy chủ cũng chặn. Nói thẳng ra thay vì bày một cái form gửi lên là báo lỗi. */}
      {!daKy && laChinhEm && tenBuddy.length > 0 && !moGhi && (
        <p className="rounded-[12px] bg-navy/[0.04] px-2.5 py-1.5 text-chu-thich font-semibold leading-relaxed text-grey-mid">
          {t('chiTuanNong')}
        </p>
      )}

      {/* CHƯA KÝ + là chính em (và đã có buddy) → form 6 câu. */}
      {!daKy && laChinhEm && tenBuddy.length > 0 && moGhi && (
        <form action={luuAction} className="flex flex-col gap-2">
          <input type="hidden" name="type" value={loai} />
          {/* Tuần của biên bản đi theo thanh tuần; máy chủ kiểm lại (ô hidden sửa được). */}
          <input type="hidden" name="week_start" value={weekStart} />
          {luuState.error && (
            <p className="inline-flex items-start gap-1.5 rounded-[12px] bg-status-bad/[0.08] px-2.5 py-2 text-chu-thich font-bold text-status-bad">
              <AlertCircle size={14} strokeWidth={2.5} className="mt-px shrink-0" />
              {luuState.error}
            </p>
          )}
          {luuState.ok && luuState.message && (
            <p className="inline-flex items-start gap-1.5 rounded-[12px] bg-success/[0.10] px-2.5 py-2 text-chu-thich font-bold text-success-dark">
              <CheckCircle2 size={14} strokeWidth={2.5} className="mt-px shrink-0" />
              {luuState.message}
            </p>
          )}
          {CAU.map((c, i) => (
            <label key={c} className="flex flex-col gap-1">
              <span className="text-nhan font-extrabold uppercase tracking-wide text-grey-mid">
                {i + 1}. {t(`q${i + 1}`)}
              </span>
              <textarea
                name={c}
                rows={c === 'q6_commitment' ? 2 : 1}
                maxLength={600}
                defaultValue={bienBan?.[c] ?? ''}
                className={`${khungChu} ${luuState.fieldError === c ? '!border-status-bad' : ''}`}
              />
              {/* Câu 2 chốt luôn Thắng/Thua cho cam kết tuần trước (PRD v3) — tuỳ chọn;
                  không bấm thì phòng họp lớp chấm như cũ. */}
              {c === 'q2_result' && (
                <span className="flex items-center gap-2">
                  {(['win', 'lose'] as const).map((v) => (
                    <label
                      key={v}
                      className={`inline-flex min-h-[28px] cursor-pointer items-center gap-1.5 rounded-full border-[1.5px] px-2.5 text-chu-thich font-extrabold ${
                        v === 'win'
                          ? 'border-success/40 text-success-dark'
                          : 'border-status-bad/40 text-status-bad'
                      }`}
                    >
                      <input type="radio" name="q2_verdict" value={v} className="accent-current" />
                      {t(v === 'win' ? 'q2Win' : 'q2Lose')}
                    </label>
                  ))}
                </span>
              )}
            </label>
          ))}
          {/* Câu 6 phải chỉ vào một WIG đã duyệt của em — cam kết không mục tiêu là lạc hướng. */}
          <label className="flex flex-col gap-1">
            <span className="text-nhan font-extrabold uppercase tracking-wide text-grey-mid">
              {t('linkWig')}
            </span>
            <select
              name="wig_id"
              defaultValue=""
              className={`${khungChu} h-11 cursor-pointer ${luuState.fieldError === 'wig_id' ? '!border-status-bad' : ''}`}
            >
              <option value="">{t('pickWig')}</option>
              {wigDaDuyet.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.title}
                </option>
              ))}
            </select>
          </label>
          <div className="flex flex-wrap items-center gap-2">
            <SubmitButton className={btnGold} wrapClass="contents">
              {t('save')}
            </SubmitButton>
          </div>
        </form>
      )}

      {/* Lưu rồi mới ký được — nút ở NGOÀI form 6 câu (form lồng form là HTML hỏng). */}
      {!daKy && bienBan && (
        <form action={kyAction} className="flex flex-col gap-1.5 border-t border-navy/[0.06] pt-2.5">
          {kyState.error && (
            <p className="text-chu-thich font-bold text-status-bad">{kyState.error}</p>
          )}
          <input type="hidden" name="meeting_id" value={bienBan.id} />
          <SubmitButton className={btnGhost} wrapClass="contents">
            <CheckCircle2 size={14} strokeWidth={2.5} />
            {t('ackBtn')}
          </SubmitButton>
        </form>
      )}
    </section>
  );
}

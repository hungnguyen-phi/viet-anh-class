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
}: {
  laChinhEm: boolean;
  /** Tên các buddy GVCN đã ghép (1 hoặc 2 người); rỗng = chưa ghép. */
  tenBuddy: string[];
  /** 'T5 · 15:30' — lịch cố định hằng tuần GVCN cài; null = chưa cài. */
  lich: string | null;
  bienBan: PdrMeeting | null;
  wigDaDuyet: WigDaDuyet[];
  weekLabel: string;
}) {
  const t = useTranslations('pdr');
  const [luuState, luuAction] = useActionState<PdrState, FormData>(luuPdr, {ok: false});
  const [kyState, kyAction] = useActionState<PdrState, FormData>(ghiNhanPdr, {ok: false});
  const daKy = Boolean(bienBan?.acknowledged_at);
  // Biên bản đã ký thì gấp lại còn một dòng — tuần nào cũng bày đủ 6 câu đã đóng là chiếm nửa cột.
  const [moXem, setMoXem] = useState(false);

  const khungChu =
    'w-full rounded-[10px] border-[1.5px] border-navy/15 bg-white px-2.5 py-2 text-[12.5px] font-semibold text-navy outline-none focus:border-navy';

  return (
    <section className="glass flex flex-col gap-3 rounded-[16px] p-4">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <h2 className="inline-flex items-center gap-1.5 font-display text-[15px] font-bold text-navy">
          <Users size={15} strokeWidth={2.2} className="text-gold-deep" />
          {t('title')}
        </h2>
        <span className="text-[11.5px] font-bold text-grey-mid">{weekLabel}</span>
        {daKy && (
          <span className="inline-flex items-center gap-1 rounded-full bg-success/[0.12] px-2 py-0.5 text-[10.5px] font-extrabold text-success-dark">
            <CheckCircle2 size={11} strokeWidth={2.5} />
            {t('acked')}
          </span>
        )}
      </div>

      {tenBuddy.length === 0 ? (
        <p className="text-[12.5px] font-semibold italic text-grey-mid">{t('noBuddy')}</p>
      ) : (
        <p className="text-[12.5px] font-semibold text-grey-mid">
          <span className="font-extrabold text-navy">{tenBuddy.join(' · ')}</span>
          {lich && <> · {lich}</>}
        </p>
      )}

      {/* ĐÃ KÝ → tóm tắt gấp; bấm mới mở đủ 6 câu. */}
      {daKy && bienBan && (
        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={() => setMoXem((v) => !v)}
            className="inline-flex min-h-[24px] cursor-pointer items-center gap-1 self-start text-[12px] font-extrabold text-navy underline"
          >
            <ChevronDown size={12} strokeWidth={2.5} className={moXem ? 'rotate-180' : ''} />
            {moXem ? t('collapse') : t('expand')}
          </button>
          {moXem && (
            <dl className="flex flex-col gap-1.5">
              {CAU.map((c, i) => (
                <div key={c} className="rounded-[10px] bg-navy/[0.04] px-2.5 py-1.5">
                  <dt className="text-[10.5px] font-extrabold uppercase text-grey-mid">{t(`q${i + 1}`)}</dt>
                  <dd className="text-[12.5px] font-semibold text-navy">{bienBan[c] || '—'}</dd>
                </div>
              ))}
            </dl>
          )}
        </div>
      )}

      {/* CHƯA KÝ + là chính em (và đã có buddy) → form 6 câu. */}
      {!daKy && laChinhEm && tenBuddy.length > 0 && (
        <form action={luuAction} className="flex flex-col gap-2">
          {luuState.error && (
            <p className="inline-flex items-start gap-1.5 rounded-[10px] bg-status-bad/[0.08] px-2.5 py-2 text-[12px] font-bold text-status-bad">
              <AlertCircle size={13} strokeWidth={2.5} className="mt-px shrink-0" />
              {luuState.error}
            </p>
          )}
          {luuState.ok && luuState.message && (
            <p className="inline-flex items-start gap-1.5 rounded-[10px] bg-success/[0.10] px-2.5 py-2 text-[12px] font-bold text-success-dark">
              <CheckCircle2 size={13} strokeWidth={2.5} className="mt-px shrink-0" />
              {luuState.message}
            </p>
          )}
          {CAU.map((c, i) => (
            <label key={c} className="flex flex-col gap-1">
              <span className="text-[11px] font-extrabold uppercase tracking-wide text-grey-mid">
                {i + 1}. {t(`q${i + 1}`)}
              </span>
              <textarea
                name={c}
                rows={c === 'q6_commitment' ? 2 : 1}
                maxLength={600}
                defaultValue={bienBan?.[c] ?? ''}
                className={`${khungChu} ${luuState.fieldError === c ? '!border-status-bad' : ''}`}
              />
            </label>
          ))}
          {/* Câu 6 phải chỉ vào một WIG đã duyệt của em — cam kết không mục tiêu là lạc hướng. */}
          <label className="flex flex-col gap-1">
            <span className="text-[11px] font-extrabold uppercase tracking-wide text-grey-mid">
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
            <p className="text-[12px] font-bold text-status-bad">{kyState.error}</p>
          )}
          <input type="hidden" name="meeting_id" value={bienBan.id} />
          <SubmitButton className={btnGhost} wrapClass="contents">
            <CheckCircle2 size={13} strokeWidth={2.5} />
            {t('ackBtn')}
          </SubmitButton>
        </form>
      )}
    </section>
  );
}

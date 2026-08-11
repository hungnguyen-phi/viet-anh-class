'use client';

import {useActionState, useState} from 'react';
import {useTranslations} from 'next-intl';
import {AlertCircle, Check, CheckCircle2, Target} from 'lucide-react';
import {SubmitButton} from '@/components/ui/SubmitButton';
import {Field, ctlWithBorder, inputCls, selectCls, btnGold, labelCls} from '@/components/ui/Field';
import {luuMucTieuCuaEm, duyetMucTieu, danhDauDaDat, type MucTieuState} from '@/app/[locale]/(dashboard)/student/actions';

// ════════════════════════════════════════════════════════════════════════════
// MỤC TIÊU CỦA CON — bốn bước có dẫn dắt
// ════════════════════════════════════════════════════════════════════════════
//
// Đây là thứ thay cho khối "GVCN đặt WIG năm cho từng em" đã xoá ở 0100. Khác biệt không nằm ở
// giao diện mà ở việc AI CẦM BÚT: bản cũ cho cô một ô số đã điền sẵn `mục tiêu lớp ÷ sĩ số`; bản
// này hỏi CHÍNH EM bốn câu, và câu đầu tiên là "con đang ở đâu".
//
// Bốn bước bám đúng công thức của Leader in Me — "từ X đến Y, trước ngày nào" — và bước ba là hai
// tính chất bắt buộc của một lead measure trong 4DX (dự báo được · tự làm được), viết lại thành
// câu một đứa trẻ hiểu.
//
// Cô mở đúng form này để gõ hộ khi em vắng hoặc chưa có máy; khi ấy app ghi `set_by='teacher'` và
// màn của em hiện rõ "cô đặt giúp con". Xem docs/MO_HINH_WIG.md §4 — van an toàn phải LỘ RA.

export type MucTieuCuaEm = {
  id: string;
  kind: string;
  status: string;
  set_by: string | null;
  measure_by: string;
  title: string;
  baseline: number | null;
  target_value: number;
  unit: string;
  area: string;
  end_date: string;
  achieved_at: string | null;
  source_wig_id: string | null;
  viec: {title: string; target_value: number; active_weekdays: number[] | null} | null;
};

export type WigLop = {id: string; area: string; title: string};

const DOW = [1, 2, 3, 4, 5, 6, 7];

export function MucTieuCuaCon({
  studentId,
  classId,
  mucTieu,
  wigLop,
  laChinhEm,
  canManage,
  dayShort,
}: {
  studentId: string;
  classId: string;
  mucTieu: MucTieuCuaEm[];
  wigLop: WigLop[];
  laChinhEm: boolean;
  canManage: boolean;
  dayShort: string[];
}) {
  const t = useTranslations('goal');
  const [state, formAction] = useActionState<MucTieuState, FormData>(luuMucTieuCuaEm, {ok: false});
  const hocTap = mucTieu.find((m) => m.kind === 'academic') ?? null;
  const [moForm, setMoForm] = useState(!hocTap);
  const [thu, setThu] = useState<number[]>(hocTap?.viec?.active_weekdays ?? [1, 3, 5]);

  const err = (f: string) => (state.fieldError === f ? state.error : null);
  const doiThu = (d: number) =>
    setThu((p) => (p.includes(d) ? p.filter((x) => x !== d) : [...p, d].sort((a, b) => a - b)));

  // Ai cũng ĐỌC được khối này (phụ huynh, BGH), nhưng chỉ chính em và nhân sự mới GHI.
  const canGhi = laChinhEm || canManage;

  return (
    <section className="glass rounded-[20px] p-[18px]">
      <div className="mb-3 flex flex-wrap items-baseline gap-2">
        <h2 className="flex items-center gap-2 font-display text-[16px] font-bold text-navy">
          <Target size={16} strokeWidth={2.5} />
          {t('title')}
        </h2>
        <span className="text-[11.5px] font-semibold text-grey-mid">{t('hint')}</span>
      </div>

      {state.error && !state.fieldError && (
        <p className="mb-3 inline-flex items-start gap-1.5 rounded-[10px] bg-status-bad/[0.08] px-2.5 py-2 text-[12px] font-bold text-status-bad">
          <AlertCircle size={13} strokeWidth={2.5} className="mt-px shrink-0" />
          {state.error}
        </p>
      )}
      {state.ok && state.message && (
        <p className="mb-3 inline-flex items-start gap-1.5 rounded-[10px] bg-success/[0.10] px-2.5 py-2 text-[12px] font-bold text-success-dark">
          <CheckCircle2 size={13} strokeWidth={2.5} className="mt-px shrink-0" />
          {state.message}
        </p>
      )}

      {/* ── MỤC TIÊU ĐANG CÓ ─────────────────────────────────────────────────────────────── */}
      {hocTap && !moForm && (
        <div className="flex flex-col gap-2.5 rounded-[14px] border-[1.5px] border-navy/10 p-3.5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[13.5px] font-extrabold text-navy">{hocTap.title}</span>
            {hocTap.status === 'sent' && (
              <span className="rounded-full bg-gold/25 px-2 py-0.5 text-[10.5px] font-extrabold text-gold-text">
                {t('waiting')}
              </span>
            )}
            {/* Van an toàn phải lộ ra: em phải biết mục tiêu này không do mình đặt. */}
            {hocTap.set_by === 'teacher' && (
              <span className="rounded-full bg-navy/[0.07] px-2 py-0.5 text-[10.5px] font-extrabold text-grey-mid">
                {t('setByTeacher')}
              </span>
            )}
          </div>
          <p className="text-[12.5px] font-semibold tabular-nums text-grey-mid">
            {t('fromTo', {
              from: hocTap.baseline ?? 0,
              to: hocTap.target_value,
              unit: hocTap.unit,
              due: hocTap.end_date,
            })}
          </p>
          {hocTap.viec && (
            <p className="text-[12.5px] font-semibold text-navy">
              {t('myWork', {title: hocTap.viec.title, n: hocTap.viec.target_value})}
            </p>
          )}

          {/* ĐÍCH GHI NHẬN NGOÀI — không vẽ vạch phần trăm, chỉ có đạt hay chưa (0101). */}
          {hocTap.measure_by === 'manual' && (
            <form action={danhDauDaDat} className="flex flex-wrap items-center gap-2">
              <input type="hidden" name="wig_id" value={hocTap.id} />
              <input type="hidden" name="student_id" value={studentId} />
              <span className="text-[12px] font-bold text-grey-mid">{t('outsideApp')}</span>
              {hocTap.achieved_at ? (
                <>
                  <span className="inline-flex items-center gap-1 rounded-full bg-success/15 px-2.5 py-1 text-[11.5px] font-extrabold text-success-dark">
                    <Check size={12} strokeWidth={3} />
                    {t('achieved')}
                  </span>
                  {canGhi && (
                    <>
                      <input type="hidden" name="bo" value="1" />
                      <SubmitButton className="text-[11.5px] font-extrabold text-navy underline" wrapClass="contents">
                        {t('undoAchieved')}
                      </SubmitButton>
                    </>
                  )}
                </>
              ) : canGhi ? (
                <SubmitButton className={btnGold} wrapClass="contents">
                  {t('markAchieved')}
                </SubmitButton>
              ) : (
                <span className="text-[11.5px] font-bold text-grey-mid">{t('notYet')}</span>
              )}
            </form>
          )}

          <div className="flex flex-wrap gap-2">
            {canGhi && (
              <button
                type="button"
                onClick={() => setMoForm(true)}
                className="cursor-pointer text-[12px] font-extrabold text-navy underline"
              >
                {t('edit')}
              </button>
            )}
            {/* Cô duyệt — duyệt xong em mới tick được. */}
            {canManage && hocTap.status === 'sent' && (
              <form action={duyetMucTieu}>
                <input type="hidden" name="wig_id" value={hocTap.id} />
                <input type="hidden" name="student_id" value={studentId} />
                <SubmitButton className={btnGold} wrapClass="contents">
                  {t('approve')}
                </SubmitButton>
              </form>
            )}
          </div>
        </div>
      )}

      {/* ── BỐN BƯỚC ─────────────────────────────────────────────────────────────────────── */}
      {canGhi && moForm && (
        <form action={formAction} className="flex flex-col gap-3.5">
          <input type="hidden" name="student_id" value={studentId} />
          <input type="hidden" name="class_id" value={classId} />
          <input type="hidden" name="kind" value="academic" />
          {thu.map((d) => (
            <input key={d} type="hidden" name="viec_days" value={d} />
          ))}

          {/* ① Con đang ở đâu — câu này đứng đầu vì cả mô hình xoay quanh nó: mục tiêu của em là
              KHOẢNG CÁCH CỦA CHÍNH EM, không phải mẩu cắt từ con số của lớp. */}
          <div className="rounded-[14px] border-[1.5px] border-navy/10 p-3">
            <p className={labelCls}>{t('step1')}</p>
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-[2fr_1fr]">
              <Field label={t('joinBattle')} htmlFor="mt-source" className="col-span-2 sm:col-span-1">
                <select id="mt-source" name="source_wig_id" defaultValue={hocTap?.source_wig_id ?? ''} className={selectCls}>
                  <option value="">{t('noBattle')}</option>
                  {wigLop.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.title}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label={t('now')} htmlFor="mt-baseline" error={err('baseline')}>
                <input
                  id="mt-baseline"
                  name="baseline"
                  type="number"
                  step="any"
                  min="0"
                  inputMode="decimal"
                  defaultValue={hocTap?.baseline ?? ''}
                  placeholder="0"
                  className={ctlWithBorder(state.fieldError === 'baseline')}
                />
              </Field>
            </div>
          </div>

          {/* ② Con muốn tới đâu, trước khi nào — công thức "từ X đến Y trước ngày" của canon. */}
          <div className="rounded-[14px] border-[1.5px] border-navy/10 p-3">
            <p className={labelCls}>{t('step2')}</p>
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-[2fr_1fr_1fr_1.2fr]">
              <Field label={t('what')} htmlFor="mt-title" error={err('title')} className="col-span-2 sm:col-span-1">
                <input
                  id="mt-title"
                  name="title"
                  defaultValue={hocTap?.title ?? ''}
                  placeholder={t('whatPlaceholder')}
                  className={ctlWithBorder(state.fieldError === 'title')}
                />
              </Field>
              <Field label={t('to')} htmlFor="mt-target" error={err('target_value')}>
                <input
                  id="mt-target"
                  name="target_value"
                  type="number"
                  step="any"
                  min="0.01"
                  inputMode="decimal"
                  defaultValue={hocTap?.target_value ?? ''}
                  className={ctlWithBorder(state.fieldError === 'target_value')}
                />
              </Field>
              <Field label={t('unit')} htmlFor="mt-unit" error={err('unit')}>
                <input
                  id="mt-unit"
                  name="unit"
                  defaultValue={hocTap?.unit ?? ''}
                  placeholder={t('unitPlaceholder')}
                  className={ctlWithBorder(state.fieldError === 'unit')}
                />
              </Field>
              <Field label={t('due')} htmlFor="mt-due" error={err('due_on')} className="col-span-2 sm:col-span-1">
                <input
                  id="mt-due"
                  name="due_on"
                  type="date"
                  defaultValue={hocTap?.end_date ?? ''}
                  className={ctlWithBorder(state.fieldError === 'due_on')}
                />
              </Field>
            </div>
            <select name="area" defaultValue={hocTap?.area ?? 'knowledge'} className="sr-only" tabIndex={-1} aria-hidden>
              <option value="knowledge">knowledge</option>
            </select>
          </div>

          {/* ③ Mỗi tuần con làm gì — hai tính chất bắt buộc của lead measure, nói bằng lời trẻ hiểu.
              Bỏ trống được: khi ấy đây là đích ghi nhận ngoài, cô và trò tự theo dõi (0101). */}
          <div className="rounded-[14px] border-[1.5px] border-navy/10 p-3">
            <p className={labelCls}>{t('step3')}</p>
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-[2fr_1fr]">
              <Field label={t('workTitle')} htmlFor="mt-viec" className="col-span-2 sm:col-span-1">
                <input
                  id="mt-viec"
                  name="viec_title"
                  defaultValue={hocTap?.viec?.title ?? ''}
                  placeholder={t('workPlaceholder')}
                  className={inputCls}
                />
              </Field>
              <Field label={t('timesPerWeek')} htmlFor="mt-viec-n" error={err('viec_target')}>
                <input
                  id="mt-viec-n"
                  name="viec_target"
                  type="number"
                  step="1"
                  min="1"
                  inputMode="numeric"
                  defaultValue={hocTap?.viec?.target_value ?? 3}
                  className={ctlWithBorder(state.fieldError === 'viec_target')}
                />
              </Field>
            </div>
            <div className="mt-2">
              <span className={labelCls}>{t('weekdays')}</span>
              <div className="flex flex-wrap gap-1.5">
                {DOW.map((d, i) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => doiThu(d)}
                    aria-pressed={thu.includes(d)}
                    className={`grid h-9 w-11 cursor-pointer select-none place-items-center rounded-[10px] border-[1.5px] text-[11.5px] font-extrabold transition-all ${
                      thu.includes(d)
                        ? 'border-transparent bg-gold text-navy'
                        : 'border-navy/15 bg-white text-navy/60 hover:border-navy'
                    }`}
                  >
                    {dayShort[i]}
                  </button>
                ))}
              </div>
            </div>
            <p className="mt-2 text-[11px] font-semibold italic leading-relaxed text-grey-mid">
              {t('leadRule')}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <SubmitButton className={btnGold} wrapClass="contents">
              {laChinhEm ? t('send') : t('saveForStudent')}
            </SubmitButton>
            {hocTap && (
              <button
                type="button"
                onClick={() => setMoForm(false)}
                className="cursor-pointer text-[12px] font-extrabold text-grey-mid underline"
              >
                {t('cancel')}
              </button>
            )}
          </div>
        </form>
      )}

      {!hocTap && !canGhi && <p className="text-[12.5px] italic text-grey-mid">{t('none')}</p>}
    </section>
  );
}

'use client';

import {useActionState, useEffect, useRef, useState, type KeyboardEvent} from 'react';
import {useTranslations} from 'next-intl';
import {CheckCircle2, AlertCircle, Plus, Trash2, Target} from 'lucide-react';
import {SubmitButton} from '@/components/ui/SubmitButton';
import {saveStudentMeeting} from '@/app/[locale]/(dashboard)/student/actions';

// Ô nhập to hơn bản cũ (py-2.5 -> py-3, text-sm -> 14.5px) cho dễ điền, theo yêu cầu 2026-07-27.
const inputCls =
  'w-full rounded-[10px] border-[1.5px] border-navy/15 bg-white px-3 py-3 text-[14.5px] font-semibold text-navy outline-none transition-all focus:border-navy';
const taCls = `${inputCls} min-h-[84px] resize-y leading-[1.5]`;
const labelSpanCls = 'mb-1 block text-[10px] font-extrabold uppercase tracking-wide text-grey-mid';

export type PlanArea = {value: string; label: string; unit: string | null};
type Row = {area: string; title: string; target: string; unit: string};

// Form biên bản họp WIG cá nhân. Ba phần TÁCH BẠCH:
//   1. Chiêm nghiệm tuần qua  — văn xuôi
//   2. Cam kết                — văn xuôi
//   3. Kế hoạch tuần sau      — CÓ CẤU TRÚC, và app sinh WIG tuần + lead measure thật từ đây
// Trước đây phần 3 cũng là ô chữ nên không tạo ra gì; GVCN phải sang /wig tạo lại bằng tay, mà chỗ
// đó lại tạo bằng giá trị cứng (target 5, 1 việc/lĩnh vực, tên mặc định) → không khớp cam kết.
export function StudentMeetingForm({
  studentId,
  classId,
  defaultWeek,
  weekOptions,
  planAreas,
  nextWeekLabel,
}: {
  studentId: string;
  classId: string;
  defaultWeek: string;
  // Nhãn tuần để CHỌN, thay ô nhập text tự do (gõ sai định dạng là WIG không khớp tuần nào).
  weekOptions: string[];
  // Chỉ những lĩnh vực đã có WIG NĂM — vì WIG tuần bắt buộc có parent_wig_id trỏ về WIG năm.
  planAreas: PlanArea[];
  nextWeekLabel: string;
}) {
  const t = useTranslations('student');
  const [state, formAction] = useActionState(saveStudentMeeting, {ok: false});
  const formRef = useRef<HTMLFormElement>(null);

  const [week, setWeek] = useState(defaultWeek);
  const [results, setResults] = useState('');
  const [commitments, setCommitments] = useState('');
  const [rows, setRows] = useState<Row[]>([]);

  useEffect(() => {
    if (state.ok) {
      setResults('');
      setCommitments('');
      setRows([]);
    }
  }, [state]);

  const err = (field: string) => (state.fieldError === field ? state.error : null);
  const errBorder = (base: string, field: string) =>
    state.fieldError === field
      ? base.replace('border-navy/15', 'border-status-bad').replace('focus:border-navy', 'focus:border-status-bad')
      : base;

  // Ctrl/⌘+Enter gửi nhanh — nhưng KHÔNG khi con trỏ đang ở trong bảng kế hoạch (dễ gửi non).
  const onKeyDown = (e: KeyboardEvent<HTMLFormElement>) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      formRef.current?.requestSubmit();
    }
  };

  function addRow() {
    const a = planAreas[0];
    if (!a) return;
    setRows((r) => [...r, {area: a.value, title: '', target: '5', unit: a.unit ?? 'lần'}]);
  }
  function setRow(i: number, patch: Partial<Row>) {
    setRows((r) => r.map((x, j) => (j === i ? {...x, ...patch} : x)));
  }

  // Chỉ gửi dòng đã điền tên + mục tiêu hợp lệ; server kiểm lại lần nữa.
  const planPayload = JSON.stringify(
    rows
      .filter((r) => r.title.trim() && Number(r.target) > 0)
      .map((r) => ({area: r.area, title: r.title.trim(), target: Number(r.target), unit: r.unit.trim()})),
  );

  return (
    <form
      ref={formRef}
      action={formAction}
      onKeyDown={onKeyDown}
      className="glass flex flex-col gap-4 rounded-[20px] p-5"
      noValidate
    >
      <input type="hidden" name="student_id" value={studentId} />
      <input type="hidden" name="class_id" value={classId} />
      <input type="hidden" name="plan" value={planPayload} />
      <p className="text-xs italic text-grey-mid">{t('meetingHint')}</p>

      {/* Chỉ còn ô tuần: ô chọn "Bạn đồng hành" đã bỏ (12/08/2026) — Buddy là con sư tử AI, không
          phải bạn cùng lớp để cô chọn. Xem ghi chú ở StudentMeetings. */}
      <div className="grid gap-3">
        <label className="block">
          <span className={labelSpanCls}>{t('week')}</span>
          <select
            name="week_label"
            value={week}
            onChange={(e) => setWeek(e.target.value)}
            aria-invalid={state.fieldError === 'week_label'}
            className={`${errBorder(inputCls, 'week_label')} cursor-pointer`}
          >
            {weekOptions.map((w, i) => (
              <option key={w} value={w}>
                {i === 0 ? `${w} — ${t('weekThis')}` : w}
              </option>
            ))}
          </select>
          {err('week_label') && <FieldError msg={err('week_label')!} />}
        </label>
      </div>

      <label className="block">
        <span className={labelSpanCls}>{t('reflection')}</span>
        <textarea
          name="results"
          value={results}
          onChange={(e) => setResults(e.target.value)}
          aria-invalid={state.fieldError === 'results'}
          className={errBorder(taCls, 'results')}
        />
        {err('results') && <FieldError msg={err('results')!} />}
      </label>

      <label className="block">
        <span className={labelSpanCls}>{t('commitments')}</span>
        <textarea
          name="commitments"
          value={commitments}
          onChange={(e) => setCommitments(e.target.value)}
          className={taCls}
        />
      </label>

      {/* ===== Kế hoạch tuần sau — phần sinh dữ liệu thật ===== */}
      <div className="rounded-[14px] border-[1.5px] border-gold/40 bg-gold/[0.06] p-3.5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 text-[11px] font-extrabold uppercase tracking-[0.04em] text-gold-text">
            <Target size={13} strokeWidth={2.5} />
            {t('planTitle', {week: nextWeekLabel})}
          </span>
        </div>
        <p className="mt-1 text-[11.5px] font-semibold italic text-grey-mid">{t('planHint')}</p>

        {planAreas.length === 0 ? (
          <p className="mt-2.5 rounded-[10px] bg-white/70 px-3 py-2 text-[12.5px] font-bold text-status-bad">
            {t('planNoYearWig')}
          </p>
        ) : (
          <>
            {rows.length > 0 && (
              <div className="mt-2.5 flex flex-col gap-2">
                {rows.map((r, i) => (
                  <div key={i} className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)_84px_92px_auto]">
                    <select
                      value={r.area}
                      onChange={(e) => {
                        const a = planAreas.find((x) => x.value === e.target.value);
                        setRow(i, {area: e.target.value, unit: a?.unit ?? r.unit});
                      }}
                      aria-label={t('planArea')}
                      className={`${inputCls} cursor-pointer`}
                    >
                      {planAreas.map((a) => (
                        <option key={a.value} value={a.value}>
                          {a.label}
                        </option>
                      ))}
                    </select>
                    <input
                      value={r.title}
                      onChange={(e) => setRow(i, {title: e.target.value})}
                      placeholder={t('planTitlePlaceholder')}
                      aria-label={t('planWork')}
                      className={inputCls}
                    />
                    <input
                      type="number"
                      min={1}
                      value={r.target}
                      onChange={(e) => setRow(i, {target: e.target.value})}
                      aria-label={t('planTarget')}
                      className={inputCls}
                    />
                    <input
                      value={r.unit}
                      onChange={(e) => setRow(i, {unit: e.target.value})}
                      placeholder={t('planUnit')}
                      aria-label={t('planUnit')}
                      className={inputCls}
                    />
                    <button
                      type="button"
                      onClick={() => setRows((x) => x.filter((_, j) => j !== i))}
                      aria-label={t('planRemove')}
                      className="grid h-[46px] w-[46px] cursor-pointer place-items-center rounded-[10px] border-[1.5px] border-status-bad/30 bg-status-bad/[0.08] text-status-bad transition-all hover:bg-status-bad/[0.16]"
                    >
                      <Trash2 size={15} strokeWidth={2.2} />
                    </button>
                  </div>
                ))}
              </div>
            )}
            <button
              type="button"
              onClick={addRow}
              className="mt-2.5 inline-flex h-10 cursor-pointer items-center gap-1.5 rounded-[10px] border-[1.5px] border-navy/20 bg-white/70 px-3 text-[12.5px] font-extrabold text-navy transition-colors hover:border-navy"
            >
              <Plus size={14} strokeWidth={2.5} />
              {t('planAdd')}
            </button>
          </>
        )}
      </div>

      {state.error && !state.fieldError && (
        <p className="inline-flex items-center gap-1.5 text-[13px] font-bold text-status-bad">
          <AlertCircle size={14} strokeWidth={2.5} />
          {state.error}
        </p>
      )}
      {state.ok && state.message && (
        <p className="inline-flex items-center gap-1.5 text-[13px] font-bold text-success-dark">
          <CheckCircle2 size={14} strokeWidth={2.5} />
          {state.message}
        </p>
      )}

      <div className="flex items-center gap-3">
        <SubmitButton
          className="btn-gold h-11 cursor-pointer self-start rounded-xl px-[18px] font-display text-[13.5px] font-bold"
          wrapClass="contents"
        >
          {t('saveMeeting')}
        </SubmitButton>
        <span className="text-[11px] font-semibold text-grey-mid">Ctrl/⌘ + Enter</span>
      </div>
    </form>
  );
}

function FieldError({msg}: {msg: string}) {
  return (
    <p className="mt-1 inline-flex items-center gap-1 text-[12px] font-bold text-status-bad">
      <AlertCircle size={12} strokeWidth={2.5} />
      {msg}
    </p>
  );
}

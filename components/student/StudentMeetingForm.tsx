'use client';

import {useActionState, useEffect, useRef, useState, type KeyboardEvent} from 'react';
import {useTranslations} from 'next-intl';
import {CheckCircle2, AlertCircle} from 'lucide-react';
import {SubmitButton} from '@/components/ui/SubmitButton';
import {saveStudentMeeting} from '@/app/[locale]/(dashboard)/student/actions';
import type {Classmate} from './StudentMeetings';

const inputCls =
  'w-full rounded-[10px] border-[1.5px] border-navy/15 bg-white px-3 py-2.5 text-sm font-semibold text-navy outline-none transition-all focus:border-navy';
const taCls = `${inputCls} min-h-[60px] resize-y`;
const labelSpanCls = 'mb-1 block text-[10px] font-extrabold uppercase tracking-wide text-grey-mid';

// Form biên bản họp WIG cá nhân — validation INLINE (useActionState): lỗi hiện cạnh field,
// giữ nguyên nội dung đã gõ, báo thành công ngay, gửi nhanh bằng Ctrl/⌘+Enter.
export function StudentMeetingForm({
  studentId,
  classId,
  defaultWeek,
  classmates,
}: {
  studentId: string;
  classId: string;
  defaultWeek: string;
  classmates: Classmate[];
}) {
  const t = useTranslations('student');
  const [state, formAction] = useActionState(saveStudentMeeting, {ok: false});
  const formRef = useRef<HTMLFormElement>(null);

  // Input controlled → không bị React reset khi submit; giữ nội dung khi có lỗi.
  const [week, setWeek] = useState(defaultWeek);
  const [buddyId, setBuddyId] = useState('');
  const [results, setResults] = useState('');
  const [commitments, setCommitments] = useState('');
  const [nextActions, setNextActions] = useState('');

  // Lưu thành công → xoá nội dung (giữ nhãn tuần cho tiện nhập tiếp).
  useEffect(() => {
    if (state.ok) {
      setResults('');
      setCommitments('');
      setNextActions('');
    }
  }, [state]);

  const err = (field: string) => (state.fieldError === field ? state.error : null);
  // Field lỗi → đổi viền sang đỏ (giữ nguyên phần còn lại của inputCls/taCls).
  const errBorder = (base: string, field: string) =>
    state.fieldError === field
      ? base.replace('border-navy/15', 'border-status-bad').replace('focus:border-navy', 'focus:border-status-bad')
      : base;

  // Ctrl/⌘+Enter gửi nhanh (form nhiều textarea).
  const onKeyDown = (e: KeyboardEvent<HTMLFormElement>) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      formRef.current?.requestSubmit();
    }
  };

  return (
    <form
      ref={formRef}
      action={formAction}
      onKeyDown={onKeyDown}
      className="glass flex flex-col gap-3 rounded-[20px] p-5"
      noValidate
    >
      <input type="hidden" name="student_id" value={studentId} />
      <input type="hidden" name="class_id" value={classId} />
      <p className="text-xs italic text-grey-mid">{t('meetingHint')}</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className={labelSpanCls}>{t('week')}</span>
          <input
            name="week_label"
            value={week}
            onChange={(e) => setWeek(e.target.value)}
            aria-invalid={state.fieldError === 'week_label'}
            className={errBorder(inputCls, 'week_label')}
          />
          {err('week_label') && <FieldError msg={err('week_label')!} />}
        </label>
        <label className="block">
          <span className={labelSpanCls}>{t('buddy')}</span>
          <select
            name="buddy_id"
            value={buddyId}
            onChange={(e) => setBuddyId(e.target.value)}
            className={`${inputCls} cursor-pointer`}
          >
            <option value="">{t('noBuddy')}</option>
            {classmates.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
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
      <label className="block">
        <span className={labelSpanCls}>{t('nextActions')}</span>
        <textarea
          name="next_actions"
          value={nextActions}
          onChange={(e) => setNextActions(e.target.value)}
          className={taCls}
        />
      </label>

      {/* Lỗi chung (không gắn field cụ thể) */}
      {state.error && !state.fieldError && (
        <p className="inline-flex items-center gap-1.5 text-[13px] font-bold text-status-bad">
          <AlertCircle size={14} strokeWidth={2.5} />
          {state.error}
        </p>
      )}
      {/* Báo thành công inline */}
      {state.ok && state.message && (
        <p className="inline-flex items-center gap-1.5 text-[13px] font-bold text-success">
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

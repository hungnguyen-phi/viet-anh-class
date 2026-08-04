'use client';

import {useActionState, useEffect, useRef, useState, type KeyboardEvent} from 'react';
import {useTranslations} from 'next-intl';
import {CheckCircle2, AlertCircle} from 'lucide-react';
import {SubmitButton} from '@/components/ui/SubmitButton';
import {saveMeeting} from './actions';

const fieldLabelCls = 'mb-1 block text-[10px] font-extrabold uppercase tracking-wide text-grey-mid';
const inputBase =
  'rounded-[10px] border-[1.5px] bg-white px-3 py-2.5 text-sm font-semibold text-navy outline-none transition-all';

// Form biên bản họp WIG — validation INLINE (useActionState): lỗi hiện cạnh field,
// giữ nguyên nội dung đã gõ, báo thành công ngay, gửi nhanh bằng Ctrl/⌘+Enter.
export function MeetingForm({
  classId,
  defaultWeek,
  weekStart,
}: {
  classId: string;
  defaultWeek: string;
  // Thứ Hai của tuần đang họp — KHOÁ THẬT của biên bản (0080). Ô "Tuần" bên dưới vẫn cho sửa vì
  // nó là thứ con người đọc, nhưng sửa nó không còn làm biên bản lạc khỏi tuần nữa.
  weekStart?: string;
}) {
  const t = useTranslations('meeting');
  const [state, formAction] = useActionState(saveMeeting, {ok: false});
  const formRef = useRef<HTMLFormElement>(null);

  // Input controlled → không bị React reset khi submit; giữ nội dung khi có lỗi.
  const [week, setWeek] = useState(defaultWeek);
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
  const borderFor = (field: string) =>
    state.fieldError === field ? 'border-status-bad focus:border-status-bad' : 'border-navy/15 focus:border-navy';

  // Ctrl/⌘+Enter gửi nhanh (form nhiều textarea).
  const onKeyDown = (e: KeyboardEvent<HTMLFormElement>) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      formRef.current?.requestSubmit();
    }
  };

  return (
    <form ref={formRef} action={formAction} onKeyDown={onKeyDown} className="flex flex-col gap-3" noValidate>
      <input type="hidden" name="class_id" value={classId} />
      <input type="hidden" name="week_start" value={weekStart ?? ''} />

      <div>
        <label className={fieldLabelCls} htmlFor="mtg-week">
          {t('week')}
        </label>
        <input
          id="mtg-week"
          name="week_label"
          value={week}
          onChange={(e) => setWeek(e.target.value)}
          aria-invalid={state.fieldError === 'week_label'}
          className={`${inputBase} w-[200px] max-w-full ${borderFor('week_label')}`}
        />
        {err('week_label') && <FieldError msg={err('week_label')!} />}
      </div>

      <div>
        <label className={fieldLabelCls} htmlFor="mtg-results">
          {t('reflection')}
        </label>
        <textarea
          id="mtg-results"
          name="results"
          value={results}
          onChange={(e) => setResults(e.target.value)}
          aria-invalid={state.fieldError === 'results'}
          className={`${inputBase} w-full min-h-[64px] resize-y ${borderFor('results')}`}
        />
        {err('results') && <FieldError msg={err('results')!} />}
      </div>

      <div>
        <label className={fieldLabelCls} htmlFor="mtg-commitments">
          {t('commitments')}
        </label>
        <textarea
          id="mtg-commitments"
          name="commitments"
          value={commitments}
          onChange={(e) => setCommitments(e.target.value)}
          className={`${inputBase} w-full min-h-[64px] resize-y border-navy/15 focus:border-navy`}
        />
      </div>

      <div>
        <label className={fieldLabelCls} htmlFor="mtg-next">
          {t('nextActions')}
        </label>
        <textarea
          id="mtg-next"
          name="next_actions"
          value={nextActions}
          onChange={(e) => setNextActions(e.target.value)}
          className={`${inputBase} w-full min-h-[64px] resize-y border-navy/15 focus:border-navy`}
        />
      </div>

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
          className="btn-gold inline-flex h-11 cursor-pointer items-center self-start rounded-[12px] px-[18px] font-display text-sm font-bold"
          wrapClass="contents"
        >
          {t('save')}
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

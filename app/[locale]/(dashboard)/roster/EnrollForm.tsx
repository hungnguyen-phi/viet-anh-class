'use client';

import {useActionState, useEffect, useState, type KeyboardEvent} from 'react';
import {useTranslations} from 'next-intl';
import {CheckCircle2, AlertCircle} from 'lucide-react';
import {SubmitButton} from '@/components/ui/SubmitButton';
import {enrollStudent} from './actions';

// Form ghi danh học sinh — validation INLINE (useActionState): lỗi hiện cạnh field,
// giữ nguyên email đã gõ, báo thành công ngay, gửi nhanh bằng Ctrl/⌘+Enter.
export function EnrollForm({classId}: {classId: string}) {
  const t = useTranslations('roster');
  const [state, formAction] = useActionState(enrollStudent, {ok: false});

  // Input controlled → không bị React reset khi submit; giữ nội dung khi có lỗi.
  const [email, setEmail] = useState('');

  // Ghi danh thành công → xoá ô email cho lần nhập tiếp theo.
  useEffect(() => {
    if (state.ok) setEmail('');
  }, [state]);

  // Ctrl/⌘+Enter gửi nhanh.
  const onKeyDown = (e: KeyboardEvent<HTMLFormElement>) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      (e.currentTarget as HTMLFormElement).requestSubmit();
    }
  };

  const borderCls =
    state.fieldError === 'email'
      ? 'border-status-bad focus:border-status-bad'
      : 'border-navy/15 focus:border-navy';

  return (
    <form
      action={formAction}
      onKeyDown={onKeyDown}
      className="glass flex flex-wrap items-end gap-2 rounded-[16px] p-3"
      noValidate
    >
      <input type="hidden" name="class_id" value={classId} />
      <div className="min-w-[220px] flex-1">
        <label
          className="mb-1 block text-[10px] font-extrabold uppercase tracking-wide text-grey-mid"
          htmlFor="enroll-email"
        >
          {t('enrollLabel')}
        </label>
        <input
          id="enroll-email"
          name="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="hs01@student.truongvietanh.com"
          aria-invalid={state.fieldError === 'email'}
          className={`w-full rounded-[10px] border-[1.5px] bg-white px-3 py-2 text-sm font-semibold text-navy outline-none ${borderCls}`}
        />
        {state.fieldError === 'email' && state.error && (
          <p className="mt-1 inline-flex items-center gap-1 text-[12px] font-bold text-status-bad">
            <AlertCircle size={12} strokeWidth={2.5} />
            {state.error}
          </p>
        )}
      </div>
      <SubmitButton className="btn-gold h-11 cursor-pointer rounded-[10px] px-4 text-sm font-extrabold" wrapClass="contents">
        + {t('enroll')}
      </SubmitButton>

      {/* Lỗi chung (không gắn field cụ thể) */}
      {state.error && !state.fieldError && (
        <p className="inline-flex basis-full items-center gap-1.5 text-[13px] font-bold text-status-bad">
          <AlertCircle size={14} strokeWidth={2.5} />
          {state.error}
        </p>
      )}
      {/* Báo thành công inline */}
      {state.ok && state.message && (
        <p className="inline-flex basis-full items-center gap-1.5 text-[13px] font-bold text-success">
          <CheckCircle2 size={14} strokeWidth={2.5} />
          {state.message}
        </p>
      )}
    </form>
  );
}

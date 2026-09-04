'use client';

import {useActionState, useEffect, useRef, useState, type KeyboardEvent} from 'react';
import {useTranslations} from 'next-intl';
import {CheckCircle2, AlertCircle} from 'lucide-react';
import {SubmitButton} from '@/components/ui/SubmitButton';
import {inviteParent} from './actions';

type Student = {id: string; full_name: string | null; email: string};

// Lớp copy nguyên từ admin/page.tsx (goldBtn, email input, student select) — tách phần màu viền để tô đỏ.
const goldBtn =
  'btn-gold inline-flex h-11 cursor-pointer items-center self-start whitespace-nowrap rounded-[12px] px-3.5 text-than font-extrabold transition-all';
const emailBase =
  'min-w-[160px] flex-1 rounded-[12px] border-[1.5px] bg-white px-3 py-2 text-sm font-semibold text-navy outline-none transition-all';
const studentCls =
  'w-[170px] cursor-pointer rounded-[12px] border-[1.5px] border-navy/15 bg-white px-3 py-2 text-sm font-semibold text-navy outline-none transition-all focus:border-navy';

// Mời phụ huynh — validation INLINE (useActionState): lỗi cạnh field, giữ email, báo thành công ngay.
export function ParentForm({students}: {students: Student[]}) {
  const t = useTranslations('admin');
  const [state, formAction] = useActionState(inviteParent, {ok: false});
  const formRef = useRef<HTMLFormElement>(null);

  const [email, setEmail] = useState('');
  const [studentId, setStudentId] = useState('');

  // Mời xong → xoá email (giữ học sinh nếu cần mời thêm phụ huynh khác cho cùng con).
  useEffect(() => {
    if (state.ok) setEmail('');
  }, [state]);

  const borderFor = (field: string) =>
    state.fieldError === field ? 'border-status-bad focus:border-status-bad' : 'border-navy/15 focus:border-navy';

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
      className="flex flex-wrap items-center gap-2"
      noValidate
    >
      <input
        name="email"
        type="email"
        placeholder={t('email')} aria-label={t('email')}
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        aria-invalid={state.fieldError === 'email'}
        className={`${emailBase} ${borderFor('email')}`}
      />
      <select
        name="student_id"
                aria-label={t('selectUser')}
        value={studentId}
        onChange={(e) => setStudentId(e.target.value)}
        className={studentCls}
      >
        <option value="" disabled>
          {t('student')}
        </option>
        {students.map((s) => (
          <option key={s.id} value={s.id}>
            {s.full_name ?? s.email}
          </option>
        ))}
      </select>
      <SubmitButton className={goldBtn} wrapClass="contents">
        {t('invite')}
      </SubmitButton>

      {/* Lỗi field (email) — chiếm trọn dòng dưới hàng input */}
      {state.error && state.fieldError && (
        <p className="w-full inline-flex items-center gap-1 text-chu-thich font-bold text-status-bad">
          <AlertCircle size={12} strokeWidth={2.5} />
          {state.error}
        </p>
      )}
      {/* Lỗi chung (thiếu học sinh / server / DB) */}
      {state.error && !state.fieldError && (
        <p className="w-full inline-flex items-center gap-1.5 text-than font-bold text-status-bad">
          <AlertCircle size={14} strokeWidth={2.5} />
          {state.error}
        </p>
      )}
      {/* Báo thành công */}
      {state.ok && state.message && (
        <p className="w-full inline-flex items-center gap-1.5 text-than font-bold text-success-dark">
          <CheckCircle2 size={14} strokeWidth={2.5} />
          {state.message}
        </p>
      )}
    </form>
  );
}

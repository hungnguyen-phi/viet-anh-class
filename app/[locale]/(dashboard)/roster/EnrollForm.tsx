'use client';

import {useActionState, useEffect, useState, type KeyboardEvent} from 'react';
import {useTranslations} from 'next-intl';
import {CheckCircle2, AlertCircle} from 'lucide-react';
import {SubmitButton} from '@/components/ui/SubmitButton';
import {enrollStudent} from './actions';

const EMPTY = {
  email: '',
  full_name: '',
  student_code: '',
  date_of_birth: '',
  parent_phone: '',
  note: '',
};

// Form ghi danh học sinh — validation INLINE (useActionState): lỗi hiện cạnh field,
// giữ nguyên nội dung đã gõ, báo thành công ngay, gửi nhanh bằng Ctrl/⌘+Enter.
//
// Vì sao có 6 trường chứ không chỉ email: ban giám hiệu phản ánh "chỉ có tên học sinh và mail…
// có thể ghi thêm các thông tin khác". Với một ô email thì không phân biệt được hai em trùng
// tên, và tệ hơn là em chưa đăng nhập lần đầu thì không hiện dòng nào trong danh sách. Nay điền
// được ngay lúc ghi danh, kể cả khi em chưa có tài khoản (lưu theo email — xem migration 0058).
//
// Chỉ EMAIL bắt buộc. Năm trường còn lại điền tới đâu thì tới, bổ sung sau vẫn được.
export function EnrollForm({classId}: {classId: string}) {
  const t = useTranslations('roster');
  const [state, formAction] = useActionState(enrollStudent, {ok: false});

  // Input controlled → không bị React reset khi submit; giữ nội dung khi có lỗi.
  const [v, setV] = useState(EMPTY);
  const set = (k: keyof typeof EMPTY) => (e: {target: {value: string}}) =>
    setV((p) => ({...p, [k]: e.target.value}));

  // Ghi danh thành công → xoá sạch form cho em tiếp theo.
  useEffect(() => {
    if (state.ok) setV(EMPTY);
  }, [state]);

  // Ctrl/⌘+Enter gửi nhanh.
  const onKeyDown = (e: KeyboardEvent<HTMLFormElement>) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      (e.currentTarget as HTMLFormElement).requestSubmit();
    }
  };

  const lbl = 'mb-1 block text-[10px] font-extrabold uppercase tracking-wide text-grey-mid';
  const inp =
    'w-full rounded-[10px] border-[1.5px] bg-white px-3 py-2 text-sm font-semibold text-navy outline-none';
  const emailBorder =
    state.fieldError === 'email'
      ? 'border-status-bad focus:border-status-bad'
      : 'border-navy/15 focus:border-navy';
  const plain = 'border-navy/15 focus:border-navy';

  return (
    <form action={formAction} onKeyDown={onKeyDown} className="glass rounded-[16px] p-3" noValidate>
      <input type="hidden" name="class_id" value={classId} />

      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <label className={lbl} htmlFor="enroll-email">
            {t('enrollLabel')} *
          </label>
          <input
            id="enroll-email"
            name="email"
            type="email"
            value={v.email}
            onChange={set('email')}
            placeholder="hs01@student.truongvietanh.com"
            aria-invalid={state.fieldError === 'email'}
            className={`${inp} ${emailBorder}`}
          />
          {state.fieldError === 'email' && state.error && (
            <p className="mt-1 inline-flex items-center gap-1 text-[12px] font-bold text-status-bad">
              <AlertCircle size={12} strokeWidth={2.5} />
              {state.error}
            </p>
          )}
        </div>

        <div>
          <label className={lbl} htmlFor="enroll-name">
            Họ và tên
          </label>
          <input
            id="enroll-name"
            name="full_name"
            value={v.full_name}
            onChange={set('full_name')}
            placeholder="Nguyễn Văn An"
            className={`${inp} ${plain}`}
          />
        </div>

        <div>
          <label className={lbl} htmlFor="enroll-code">
            Mã học sinh
          </label>
          <input
            id="enroll-code"
            name="student_code"
            value={v.student_code}
            onChange={set('student_code')}
            placeholder="VA2026-0157"
            className={`${inp} ${plain}`}
          />
        </div>

        <div>
          <label className={lbl} htmlFor="enroll-dob">
            Ngày sinh
          </label>
          <input
            id="enroll-dob"
            name="date_of_birth"
            type="date"
            value={v.date_of_birth}
            onChange={set('date_of_birth')}
            className={`${inp} ${plain}`}
          />
        </div>

        <div>
          <label className={lbl} htmlFor="enroll-phone">
            SĐT phụ huynh
          </label>
          <input
            id="enroll-phone"
            name="parent_phone"
            type="tel"
            inputMode="tel"
            value={v.parent_phone}
            onChange={set('parent_phone')}
            placeholder="09xx xxx xxx"
            className={`${inp} ${plain}`}
          />
        </div>

        <div className="lg:col-span-2">
          <label className={lbl} htmlFor="enroll-note">
            Ghi chú
          </label>
          <input
            id="enroll-note"
            name="note"
            value={v.note}
            onChange={set('note')}
            placeholder="vd: dị ứng hải sản"
            className={`${inp} ${plain}`}
          />
        </div>

        <div className="flex items-end">
          <SubmitButton
            className="btn-gold h-11 w-full cursor-pointer rounded-[10px] px-4 text-sm font-extrabold"
            wrapClass="contents"
          >
            + {t('enroll')}
          </SubmitButton>
        </div>
      </div>

      <p className="mt-2 text-[11px] italic text-grey-mid">
        Chỉ email là bắt buộc. Điền thêm được tới đâu thì tới — em chưa có tài khoản vẫn ghi danh
        được và sẽ hiện ngay trong danh sách với nhãn “chưa đăng nhập”.
      </p>

      {/* Lỗi chung (không gắn field cụ thể) */}
      {state.error && !state.fieldError && (
        <p className="mt-2 inline-flex items-center gap-1.5 text-[13px] font-bold text-status-bad">
          <AlertCircle size={14} strokeWidth={2.5} />
          {state.error}
        </p>
      )}
      {/* Báo thành công inline */}
      {state.ok && state.message && (
        <p className="mt-2 inline-flex items-center gap-1.5 text-[13px] font-bold text-success">
          <CheckCircle2 size={14} strokeWidth={2.5} />
          {state.message}
        </p>
      )}
    </form>
  );
}

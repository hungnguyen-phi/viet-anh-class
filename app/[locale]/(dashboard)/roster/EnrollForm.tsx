'use client';

import {useActionState, useEffect, useRef, useState, type KeyboardEvent} from 'react';
import {useTranslations} from 'next-intl';
import {CheckCircle2, AlertCircle} from 'lucide-react';
import {SubmitButton} from '@/components/ui/SubmitButton';
import {enrollStudent} from './actions';

const EMPTY = {
  email: '',
  full_name: '',
  student_code: '',
  dob_day: '',
  dob_month: '',
  dob_year: '',
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

  // Ba ô ngày sinh: gõ đủ số thì tự nhảy sang ô kế — nhập 30 em một lượt không phải bấm chuột.
  const oThang = useRef<HTMLInputElement>(null);
  const oNam = useRef<HTMLInputElement>(null);

  // Chỉ nhận chữ số. Dán/gõ cả "25/11/2013" vào ô Ngày thì tự chia ra ba ô — dán từ danh sách
  // Excel là việc giáo viên làm nhiều nhất, không nên bắt họ tách tay.
  const onNgay = (e: {target: {value: string}}) => {
    const so = e.target.value.replace(/\D/g, '');
    if (so.length > 2) {
      setV((p) => ({...p, dob_day: so.slice(0, 2), dob_month: so.slice(2, 4), dob_year: so.slice(4, 8)}));
      oNam.current?.focus();
      return;
    }
    setV((p) => ({...p, dob_day: so}));
    if (so.length === 2) oThang.current?.focus();
  };
  const onThang = (e: {target: {value: string}}) => {
    const so = e.target.value.replace(/\D/g, '').slice(0, 2);
    setV((p) => ({...p, dob_month: so}));
    if (so.length === 2) oNam.current?.focus();
  };
  const onNam = (e: {target: {value: string}}) =>
    setV((p) => ({...p, dob_year: e.target.value.replace(/\D/g, '').slice(0, 4)}));

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
  // Tách phần KHÔNG có chiều rộng ra riêng: ba ô ngày sinh tự đặt chiều rộng, không được dính
  // w-full (hai lớp width cùng độ ưu tiên thì thứ tự thắng thua phụ thuộc thứ tự trong file CSS).
  const inpBase =
    'rounded-[10px] border-[1.5px] bg-white py-2 text-sm font-semibold text-navy outline-none';
  const inp = `w-full px-3 ${inpBase}`;
  const inpDob = `px-2 ${inpBase}`;
  const emailBorder =
    state.fieldError === 'email'
      ? 'border-status-bad focus:border-status-bad'
      : 'border-navy/15 focus:border-navy';
  const plain = 'border-navy/15 focus:border-navy';
  const dobBorder =
    state.fieldError === 'date_of_birth'
      ? 'border-status-bad focus:border-status-bad'
      : 'border-navy/15 focus:border-navy';

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

        {/* Ngày sinh: BA ô rời, không dùng <input type="date"> — ô đó hiện thứ tự theo ngôn ngữ
            của trình duyệt (máy tiếng Anh ra mm/dd/yyyy), nên 09/03 dễ bị nhập thành mùng 3
            tháng 9. Ba ô có nhãn thì không nhầm được, ở bất kỳ máy nào. */}
        <div role="group" aria-labelledby="enroll-dob-label">
          <span className={lbl} id="enroll-dob-label">
            Ngày sinh
          </span>
          <div className="flex items-center gap-1.5">
            <input
              id="enroll-dob-day"
              name="dob_day"
              aria-label="Ngày sinh — ngày"
              aria-invalid={state.fieldError === 'date_of_birth'}
              inputMode="numeric"
              maxLength={2}
              placeholder="Ngày"
              value={v.dob_day}
              onChange={onNgay}
              className={`${inpDob} ${dobBorder} w-20 flex-none text-center`}
            />
            <span aria-hidden className="text-sm font-bold text-grey-soft">
              /
            </span>
            <input
              id="enroll-dob-month"
              name="dob_month"
              ref={oThang}
              aria-label="Ngày sinh — tháng"
              aria-invalid={state.fieldError === 'date_of_birth'}
              inputMode="numeric"
              maxLength={2}
              placeholder="Tháng"
              value={v.dob_month}
              onChange={onThang}
              className={`${inpDob} ${dobBorder} w-20 flex-none text-center`}
            />
            <span aria-hidden className="text-sm font-bold text-grey-soft">
              /
            </span>
            <input
              id="enroll-dob-year"
              name="dob_year"
              ref={oNam}
              aria-label="Ngày sinh — năm"
              aria-invalid={state.fieldError === 'date_of_birth'}
              inputMode="numeric"
              maxLength={4}
              placeholder="Năm"
              value={v.dob_year}
              onChange={onNam}
              className={`${inpDob} ${dobBorder} min-w-0 flex-1 text-center`}
            />
          </div>
          {state.fieldError === 'date_of_birth' && state.error && (
            <p className="mt-1 inline-flex items-center gap-1 text-[12px] font-bold text-status-bad">
              <AlertCircle size={12} strokeWidth={2.5} />
              {state.error}
            </p>
          )}
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
        <p className="mt-2 inline-flex items-center gap-1.5 text-[13px] font-bold text-success-dark">
          <CheckCircle2 size={14} strokeWidth={2.5} />
          {state.message}
        </p>
      )}
    </form>
  );
}

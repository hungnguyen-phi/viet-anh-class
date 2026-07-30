'use client';

import {useActionState, useEffect, useState, type KeyboardEvent} from 'react';
import {CheckCircle2, AlertCircle} from 'lucide-react';
import {SubmitButton} from '@/components/ui/SubmitButton';
import {Field, ctlWithBorder, btnGold} from '@/components/ui/Field';
import {createSubject} from '@/app/[locale]/(dashboard)/subjects/actions';

const EMPTY = {code: '', name: '', short_name: '', sort_order: '', is_scored: true};

// Thêm môn vào danh mục.
//
// PHẠM VI KHÔNG CHO CHỌN, CỐ Ý: quản trị viên luôn tạo môn DÙNG CHUNG (campus_id NULL), hiệu
// trưởng luôn tạo môn RIÊNG của cơ sở mình. Đó là đúng hai policy của bảng subjects, nên một ô
// chọn "phạm vi" chỉ có thể sinh ra lựa chọn bị RLS chặn im lặng. Thay vì ô chọn, màn hình nói
// thẳng ra người dùng đang tạo loại môn nào.
//
// useActionState (không redirect) vì lỗi hay gặp nhất ở đây là TRÙNG TÊN — trigger subject_guard
// ném câu tiếng Việt "Môn ... đã có trong danh mục dùng chung..." và người dùng cần đọc câu đó
// ngay cạnh ô vừa gõ, còn nguyên những gì đã nhập.
export function SubjectCreateForm({
  scope,
  campusName,
}: {
  scope: 'chung' | 'rieng';
  campusName?: string | null;
}) {
  const [state, formAction] = useActionState(createSubject, {ok: false});

  // Input controlled → React không reset khi submit; giữ nội dung khi có lỗi.
  const [v, setV] = useState(EMPTY);
  const set = (k: 'code' | 'name' | 'short_name' | 'sort_order') => (e: {target: {value: string}}) =>
    setV((p) => ({...p, [k]: e.target.value}));

  useEffect(() => {
    if (state.ok) setV(EMPTY);
  }, [state]);

  // Ctrl/⌘+Enter gửi nhanh (form nhiều ô).
  const onKeyDown = (e: KeyboardEvent<HTMLFormElement>) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      (e.currentTarget as HTMLFormElement).requestSubmit();
    }
  };

  return (
    <form action={formAction} onKeyDown={onKeyDown} className="glass rounded-[16px] p-3" noValidate>
      <div className="mb-2 font-display text-[15px] font-bold text-navy">
        {scope === 'chung'
          ? 'Thêm môn dùng chung cho cả trường'
          : `Thêm môn riêng của cơ sở${campusName ? ` ${campusName}` : ''}`}
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-[1fr_2fr_1fr_1fr]">
        <Field
          label="Mã môn *"
          htmlFor="subject-code"
          error={state.fieldError === 'code' ? state.error : null}
          hint={state.fieldError === 'code' ? undefined : 'IN HOA, không dấu'}
        >
          <input
            id="subject-code"
            name="code"
            value={v.code}
            onChange={set('code')}
            placeholder="TOAN"
            maxLength={12}
            aria-invalid={state.fieldError === 'code'}
            className={ctlWithBorder(state.fieldError === 'code')}
          />
        </Field>

        <Field
          label="Tên môn *"
          htmlFor="subject-name"
          error={state.fieldError === 'name' ? state.error : null}
        >
          <input
            id="subject-name"
            name="name"
            value={v.name}
            onChange={set('name')}
            placeholder="Ngữ văn"
            maxLength={80}
            aria-invalid={state.fieldError === 'name'}
            className={ctlWithBorder(state.fieldError === 'name')}
          />
        </Field>

        <Field
          label="Mã ngắn"
          htmlFor="subject-short"
          error={state.fieldError === 'short_name' ? state.error : null}
          hint={state.fieldError === 'short_name' ? undefined : 'hiện trong ô TKB'}
        >
          <input
            id="subject-short"
            name="short_name"
            value={v.short_name}
            onChange={set('short_name')}
            placeholder="Văn"
            maxLength={16}
            aria-invalid={state.fieldError === 'short_name'}
            className={ctlWithBorder(state.fieldError === 'short_name')}
          />
        </Field>

        <Field
          label="Thứ tự"
          htmlFor="subject-order"
          error={state.fieldError === 'sort_order' ? state.error : null}
          hint={state.fieldError === 'sort_order' ? undefined : 'nhỏ hiện trước'}
        >
          <input
            id="subject-order"
            name="sort_order"
            inputMode="numeric"
            value={v.sort_order}
            onChange={set('sort_order')}
            placeholder="500"
            aria-invalid={state.fieldError === 'sort_order'}
            className={ctlWithBorder(state.fieldError === 'sort_order')}
          />
        </Field>
      </div>

      <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2">
        {/* Nhãn bọc luôn ô tick → bấm vào chữ cũng ăn, và không cần htmlFor rời. */}
        <label className="inline-flex cursor-pointer items-center gap-2 text-[12.5px] font-bold text-navy">
          <input
            type="checkbox"
            name="is_scored"
            checked={v.is_scored}
            onChange={(e) => setV((p) => ({...p, is_scored: e.target.checked}))}
            className="h-4 w-4 accent-navy"
          />
          Chấm bằng điểm số
        </label>
        <SubmitButton className={btnGold} wrapClass="contents">
          + Thêm môn
        </SubmitButton>
      </div>

      <p className="mt-2 text-[11px] italic text-grey-mid">
        Bỏ tick “chấm bằng điểm số” cho môn đánh giá bằng nhận xét (Thể chất, Âm nhạc, Mĩ thuật,
        Trải nghiệm…). Mã môn là mã MÁY đọc, không đổi về sau — tên hiển thị thì sửa lúc nào cũng
        được.
        {scope === 'rieng' &&
          ' Môn riêng chỉ các lớp của cơ sở bạn chọn được; nếu trùng tên với môn dùng chung thì hệ thống sẽ báo và bạn hãy dùng môn chung.'}
      </p>

      {state.error && !state.fieldError && (
        <p className="mt-2 inline-flex items-center gap-1.5 text-[13px] font-bold text-status-bad">
          <AlertCircle size={14} strokeWidth={2.5} />
          {state.error}
        </p>
      )}
      {state.ok && state.message && (
        <p className="mt-2 inline-flex items-center gap-1.5 text-[13px] font-bold text-success">
          <CheckCircle2 size={14} strokeWidth={2.5} />
          {state.message}
        </p>
      )}
    </form>
  );
}

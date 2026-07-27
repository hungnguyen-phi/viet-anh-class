'use client';

import {useActionState, useEffect, useRef, useState, type KeyboardEvent} from 'react';
import {useTranslations} from 'next-intl';
import {CheckCircle2, AlertCircle} from 'lucide-react';
import {SubmitButton} from '@/components/ui/SubmitButton';
import {PeriodPicker} from '@/components/wig/PeriodPicker';
import type {PeriodOption} from '@/lib/dates';
import {createYearWig} from './actions';

const fieldLabel = 'mb-1 block text-[10px] font-extrabold uppercase tracking-wide text-grey-mid';
// Base gốc của fieldInput, tách phần màu viền để đổi sang đỏ khi lỗi (giữ style y hệt page).
const fieldInputBase =
  'w-full rounded-[10px] border-[1.5px] bg-white px-3 py-2 text-sm font-semibold text-navy outline-none transition-all';
const goldBtn = 'btn-gold cursor-pointer rounded-[12px] px-4 h-11 text-sm font-extrabold';

// Form tạo WIG năm — validation INLINE (useActionState): lỗi hiện cạnh field,
// giữ nguyên nội dung đã gõ, báo thành công ngay, gửi nhanh bằng Ctrl/⌘+Enter.
export function WigCreateForm({
  classId,
  areas,
  periods,
}: {
  classId: string;
  areas: {value: string; label: string}[];
  // Danh sách năm học để CHỌN (tính ở server để không lệch hydrate) — thay 3 ô
  // "Nhãn kỳ / Bắt đầu / Kết thúc" nhập tay.
  periods: PeriodOption[];
}) {
  const t = useTranslations('wig');
  const [state, formAction] = useActionState(createYearWig, {ok: false});
  const formRef = useRef<HTMLFormElement>(null);

  // Input controlled → không bị React reset khi submit; giữ nội dung khi có lỗi.
  const [area, setArea] = useState('');
  const [target, setTarget] = useState('');
  const [unit, setUnit] = useState('');

  // Tạo thành công → xoá các ô (giữ kỳ đang chọn cho tiện tạo WIG lĩnh vực khác cùng năm học).
  useEffect(() => {
    if (state.ok) {
      setArea('');
      setTarget('');
      setUnit('');
    }
  }, [state]);

  const err = (field: string) => (state.fieldError === field ? state.error : null);
  const borderFor = (field: string) =>
    state.fieldError === field ? 'border-status-bad focus:border-status-bad' : 'border-navy/15 focus:border-navy';

  // Ctrl/⌘+Enter gửi nhanh (form nhiều field).
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
      className="grid gap-2.5 [grid-template-columns:repeat(auto-fit,minmax(180px,1fr))]"
      noValidate
    >
      <input type="hidden" name="class_id" value={classId} />
      <input type="hidden" name="period" value="year" />
      <div>
        <label className={fieldLabel} htmlFor="wig-area">
          {t('area')}
        </label>
        <select
          id="wig-area"
          name="area"
          value={area}
          onChange={(e) => setArea(e.target.value)}
          aria-invalid={state.fieldError === 'area'}
          className={`${fieldInputBase} cursor-pointer ${borderFor('area')}`}
        >
          <option value="" disabled>
            — {t('area')} —
          </option>
          {areas.map((a) => (
            <option key={a.value} value={a.value}>
              {a.label}
            </option>
          ))}
        </select>
        {err('area') && <FieldError msg={err('area')!} />}
      </div>
      <div>
        <label className={fieldLabel} htmlFor="wig-target">
          {t('target')}
        </label>
        <input
          id="wig-target"
          name="target_value"
          type="number"
          step="any"
          value={target}
          onChange={(e) => setTarget(e.target.value)}
          placeholder={t('target')}
          aria-invalid={state.fieldError === 'target_value'}
          className={`${fieldInputBase} ${borderFor('target_value')}`}
        />
        {err('target_value') && <FieldError msg={err('target_value')!} />}
      </div>
      <div>
        <label className={fieldLabel} htmlFor="wig-unit">
          {t('unit')}
        </label>
        <input
          id="wig-unit"
          name="unit"
          value={unit}
          onChange={(e) => setUnit(e.target.value)}
          placeholder={t('unit')}
          aria-invalid={state.fieldError === 'unit'}
          className={`${fieldInputBase} ${borderFor('unit')}`}
        />
        {err('unit') && <FieldError msg={err('unit')!} />}
      </div>
      {/* 1 select thay 3 ô (nhãn kỳ + ngày đầu + ngày cuối) — chọn năm học là app tự khớp hết */}
      <PeriodPicker options={periods} label={t('schoolYear')} />
      {(err('start_date') || err('end_date')) && (
        <FieldError msg={err('start_date') ?? err('end_date')!} />
      )}
      <div className="flex items-end">
        <SubmitButton className={goldBtn} wrapClass="contents">
          + {t('createYear')}
        </SubmitButton>
      </div>

      {/* Lỗi chung (không gắn field cụ thể) */}
      {state.error && !state.fieldError && (
        <p className="col-span-full inline-flex items-center gap-1.5 text-[13px] font-bold text-status-bad">
          <AlertCircle size={14} strokeWidth={2.5} />
          {state.error}
        </p>
      )}
      {/* Báo thành công inline */}
      {state.ok && state.message && (
        <p className="col-span-full inline-flex items-center gap-1.5 text-[13px] font-bold text-success">
          <CheckCircle2 size={14} strokeWidth={2.5} />
          {state.message}
        </p>
      )}
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

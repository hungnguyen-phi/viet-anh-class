'use client';

import {useActionState, useEffect, useRef, useState, type KeyboardEvent} from 'react';
import {useTranslations} from 'next-intl';
import {CheckCircle2, AlertCircle} from 'lucide-react';
import {SubmitButton} from '@/components/ui/SubmitButton';
import {Field, ctlWithBorder, btnGold} from '@/components/ui/Field';
import {PeriodPicker} from '@/components/wig/PeriodPicker';
import type {PeriodOption} from '@/lib/dates';
import {createYearWig} from './actions';

// Form tạo WIG năm.
//
// Dựng lại 2026-07-27 sau audit. Ba thay đổi về bản chất, không phải trang trí:
//
//  1. THÊM Ô "TÊN MỤC TIÊU". Trước đây một WIG chỉ gồm lĩnh vực + con số + đơn vị, nên trên màn
//     hình nó hiện ra là "Tuần 31 — 0/5 lần" và không ai đọc được 5 lần đó là 5 lần GÌ.
//  2. THÊM Ô "TỪ (hiện tại)". 4DX phát biểu mục tiêu là "Từ X lên Y trước [hạn]". App vốn chỉ có
//     Y; thiếu X thì không thấy được đã tiến bao xa so với lúc bắt đầu.
//  3. MỖI Ô CÓ NHÃN THẬT nằm ngoài ô. Trước đây placeholder kiêm luôn nhãn — nó biến mất ngay khi
//     gõ chữ đầu tiên, và khi ô bị bóp hẹp thì chính nó bị cắt cụt.
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
  const [title, setTitle] = useState('');
  const [area, setArea] = useState('');
  const [baseline, setBaseline] = useState('');
  const [target, setTarget] = useState('');
  const [unit, setUnit] = useState('');

  // Tạo thành công → xoá các ô (giữ kỳ đang chọn cho tiện tạo WIG lĩnh vực khác cùng năm học).
  useEffect(() => {
    if (state.ok) {
      setTitle('');
      setArea('');
      setBaseline('');
      setTarget('');
      setUnit('');
    }
  }, [state]);

  const err = (field: string) => (state.fieldError === field ? state.error : null);

  // Ctrl/⌘+Enter gửi nhanh (form nhiều field).
  const onKeyDown = (e: KeyboardEvent<HTMLFormElement>) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      formRef.current?.requestSubmit();
    }
  };

  return (
    <form ref={formRef} action={formAction} onKeyDown={onKeyDown} className="flex flex-col gap-3" noValidate>
      <input type="hidden" name="class_id" value={classId} />
      <input type="hidden" name="period" value="year" />

      {/* Tên chiếm trọn bề ngang: đây là thứ người ta đọc đầu tiên trên mọi màn hình sau này,
          và câu mục tiêu tiếng Việt thường dài hơn một ô hẹp chứa nổi. */}
      <Field
        label={t('wigTitle')}
        htmlFor="wig-title"
        error={err('title')}
        hint={t('wigTitleHint')}
      >
        <input
          id="wig-title"
          name="title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={t('wigTitlePlaceholder')}
          aria-invalid={state.fieldError === 'title'}
          className={ctlWithBorder(state.fieldError === 'title')}
        />
      </Field>

      {/* Lĩnh vực rộng hơn (nhãn "Tiếng Anh"/"Thể chất" + mũi tên select); hai ô số hẹp hơn;
          đơn vị đủ chỗ cho "buổi luyện nói" — chuỗi dài nhất đang có trên production. */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-[1.5fr_1fr_1fr_1.3fr]">
        <Field label={t('area')} htmlFor="wig-area" error={err('area')} className="col-span-2 sm:col-span-1">
          <select
            id="wig-area"
            name="area"
            value={area}
            onChange={(e) => setArea(e.target.value)}
            aria-invalid={state.fieldError === 'area'}
            className={`${ctlWithBorder(state.fieldError === 'area')} cursor-pointer`}
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
        </Field>

        <Field label={t('baseline')} htmlFor="wig-baseline" error={err('baseline')}>
          <input
            id="wig-baseline"
            name="baseline"
            type="number"
            step="any"
            inputMode="decimal"
            value={baseline}
            onChange={(e) => setBaseline(e.target.value)}
            placeholder="0"
            aria-invalid={state.fieldError === 'baseline'}
            className={ctlWithBorder(state.fieldError === 'baseline')}
          />
        </Field>

        <Field label={t('targetTo')} htmlFor="wig-target" error={err('target_value')}>
          <input
            id="wig-target"
            name="target_value"
            type="number"
            step="any"
            inputMode="decimal"
            value={target}
            onChange={(e) => setTarget(e.target.value)}
            aria-invalid={state.fieldError === 'target_value'}
            className={ctlWithBorder(state.fieldError === 'target_value')}
          />
        </Field>

        <Field
          label={t('unit')}
          htmlFor="wig-unit"
          error={err('unit')}
          className="col-span-2 sm:col-span-1"
        >
          <input
            id="wig-unit"
            name="unit"
            value={unit}
            onChange={(e) => setUnit(e.target.value)}
            placeholder={t('unitPlaceholder')}
            aria-invalid={state.fieldError === 'unit'}
            className={ctlWithBorder(state.fieldError === 'unit')}
          />
        </Field>
      </div>

      {/* 1 select thay 3 ô (nhãn kỳ + ngày đầu + ngày cuối) — chọn năm học là app tự khớp hết */}
      <div className="sm:max-w-[320px]">
        <PeriodPicker options={periods} label={t('schoolYear')} />
      </div>
      {(err('start_date') || err('end_date')) && (
        <p className="inline-flex items-center gap-1 text-[12px] font-bold text-status-bad">
          <AlertCircle size={12} strokeWidth={2.5} />
          {err('start_date') ?? err('end_date')}
        </p>
      )}

      {/* Nút hành động ĐỨNG RIÊNG MỘT DÒNG, canh phải. Nhét chung hàng với ô chọn kỳ thì nó bị
          kéo lệch theo dòng ghi chú ngày bên dưới ô đó — đúng kiểu lệch trước đây. */}
      <div className="flex flex-wrap items-center justify-end gap-2">
        {state.error && !state.fieldError && (
          <p className="mr-auto inline-flex items-center gap-1.5 text-[13px] font-bold text-status-bad">
            <AlertCircle size={14} strokeWidth={2.5} />
            {state.error}
          </p>
        )}
        {state.ok && state.message && (
          <p className="mr-auto inline-flex items-center gap-1.5 text-[13px] font-bold text-success">
            <CheckCircle2 size={14} strokeWidth={2.5} />
            {state.message}
          </p>
        )}
        <SubmitButton className={btnGold} wrapClass="contents">
          + {t('createYear')}
        </SubmitButton>
      </div>
    </form>
  );
}

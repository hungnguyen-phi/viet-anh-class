'use client';

import {useState} from 'react';
import {useTranslations} from 'next-intl';
import {selectCls, labelCls} from '@/components/ui/Field';
import type {PeriodOption} from '@/lib/dates';

// Chọn KỲ thay vì gõ nhãn kỳ. Một select duy nhất thay 3 ô (nhãn kỳ + ngày bắt đầu + ngày kết
// thúc): chọn kỳ là app tự biết nhãn và tự khớp ngày đầu/cuối.
//
// Vì sao cần: trên production cột period_label đang lẫn cả '2026' và '2026-2027' — hệ quả của ô
// text tự do. Gõ lệch nhãn thì WIG không khớp kỳ nào, còn gõ lệch ngày thì % tiến độ và dự báo
// on/off-track tính sai.
//
// Vẫn phát ra đúng 3 field cũ (period_label / start_date / end_date) nên server action không đổi.
export function PeriodPicker({
  options,
  defaultIndex = 0,
  label,
}: {
  options: PeriodOption[];
  defaultIndex?: number;
  label: string;
}) {
  const t = useTranslations('wig');
  const [i, setI] = useState(Math.min(defaultIndex, Math.max(0, options.length - 1)));
  const cur = options[i];

  return (
    <div className="min-w-0">
      <label className={labelCls}>{label}</label>
      {/* selectCls: cùng chiều cao ctl-h với ô nhập và nút → đứng cùng hàng là thẳng */}
      <select value={i} onChange={(e) => setI(Number(e.target.value))} className={selectCls}>
        {options.map((o, idx) => (
          <option key={o.label} value={idx}>
            {o.label}
            {idx === Math.min(defaultIndex, options.length - 1) ? ` — ${t('periodCurrent')}` : ''}
          </option>
        ))}
      </select>
      {cur && (
        <>
          <input type="hidden" name="period_label" value={cur.label} />
          <input type="hidden" name="start_date" value={cur.start} />
          <input type="hidden" name="end_date" value={cur.end} />
          <p className="mt-1 text-[11px] font-semibold text-grey-mid">
            {cur.start} → {cur.end}
          </p>
        </>
      )}
    </div>
  );
}

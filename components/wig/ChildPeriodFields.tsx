'use client';

import {useState} from 'react';
import type {PeriodOption} from '@/lib/dates';

// Cụm field kỳ cho form tạo WIG CON (tuần/tháng) trên /wig.
// Thay 3 ô nhập tay (nhãn kỳ + ngày đầu + ngày cuối) bằng 1 select danh sách tuần/tháng thật.
// Đổi loại kỳ thì danh sách đổi theo và nhảy về kỳ hiện tại.
export function ChildPeriodFields({
  weekOpts,
  monthOpts,
  weekDefault,
  monthDefault,
  allowMonth,
  inputCls,
  weekLabel,
  monthLabel,
  currentTag,
}: {
  weekOpts: PeriodOption[];
  monthOpts: PeriodOption[];
  weekDefault: number;
  monthDefault: number;
  allowMonth: boolean;
  inputCls: string;
  weekLabel: string;
  monthLabel: string;
  currentTag: string;
}) {
  const [period, setPeriod] = useState<'week' | 'month'>('week');
  const [i, setI] = useState(weekDefault);

  const opts = period === 'week' ? weekOpts : monthOpts;
  const def = period === 'week' ? weekDefault : monthDefault;
  const cur = opts[Math.min(i, opts.length - 1)];

  return (
    <>
      {allowMonth ? (
        <select
          name="period"
          value={period}
          onChange={(e) => {
            const p = e.target.value as 'week' | 'month';
            setPeriod(p);
            // Danh sách khác nhau về số phần tử → nhảy về kỳ hiện tại của danh sách mới.
            setI(p === 'week' ? weekDefault : monthDefault);
          }}
          className={`${inputCls} w-[100px] cursor-pointer`}
        >
          <option value="week">{weekLabel}</option>
          <option value="month">{monthLabel}</option>
        </select>
      ) : (
        <input type="hidden" name="period" value="week" />
      )}

      <select
        value={Math.min(i, opts.length - 1)}
        onChange={(e) => setI(Number(e.target.value))}
        className={`${inputCls} w-[190px] cursor-pointer`}
      >
        {opts.map((o, idx) => (
          <option key={o.label} value={idx}>
            {o.label}
            {idx === def ? ` — ${currentTag}` : ''}
          </option>
        ))}
      </select>

      {cur && (
        <>
          <input type="hidden" name="period_label" value={cur.label} />
          <input type="hidden" name="start_date" value={cur.start} />
          <input type="hidden" name="end_date" value={cur.end} />
        </>
      )}
    </>
  );
}

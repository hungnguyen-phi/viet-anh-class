'use client';

import {useState} from 'react';
import {Field, selectCls} from '@/components/ui/Field';
import type {PeriodOption} from '@/lib/dates';

// Cụm field kỳ cho form tạo WIG CON (tuần/tháng) trên /wig.
// Thay 3 ô nhập tay (nhãn kỳ + ngày đầu + ngày cuối) bằng 1 select danh sách tuần/tháng thật.
// Đổi loại kỳ thì danh sách đổi theo và nhảy về kỳ hiện tại.
//
// Sửa 2026-07-27: hai select này trước đây là hai ô trần thả vào giữa một hàng flex, rộng cứng
// 100px và 190px, KHÔNG có nhãn. Người dùng nhìn vào chỉ thấy hai hộp xổ xuống cạnh nhau mà
// không biết cái nào là "loại kỳ" cái nào là "kỳ nào". Nay mỗi cái có nhãn riêng và tự co giãn.
export function ChildPeriodFields({
  weekOpts,
  monthOpts,
  weekDefault,
  monthDefault,
  allowMonth,
  weekLabel,
  monthLabel,
  currentTag,
  typeFieldLabel,
  periodFieldLabel,
}: {
  weekOpts: PeriodOption[];
  monthOpts: PeriodOption[];
  weekDefault: number;
  monthDefault: number;
  allowMonth: boolean;
  weekLabel: string;
  monthLabel: string;
  currentTag: string;
  typeFieldLabel: string;
  periodFieldLabel: string;
}) {
  const [period, setPeriod] = useState<'week' | 'month'>('week');
  const [i, setI] = useState(weekDefault);

  const opts = period === 'week' ? weekOpts : monthOpts;
  const def = period === 'week' ? weekDefault : monthDefault;
  const cur = opts[Math.min(i, opts.length - 1)];

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-[minmax(120px,0.7fr)_minmax(200px,1.3fr)]">
      {allowMonth ? (
        <Field label={typeFieldLabel}>
          <select
            name="period"
            value={period}
            onChange={(e) => {
              const p = e.target.value as 'week' | 'month';
              setPeriod(p);
              // Danh sách khác nhau về số phần tử → nhảy về kỳ hiện tại của danh sách mới.
              setI(p === 'week' ? weekDefault : monthDefault);
            }}
            className={selectCls}
          >
            <option value="week">{weekLabel}</option>
            <option value="month">{monthLabel}</option>
          </select>
        </Field>
      ) : (
        <input type="hidden" name="period" value="week" />
      )}

      <Field
        label={periodFieldLabel}
        className={allowMonth ? 'col-span-2 sm:col-span-1' : 'col-span-2'}
        // Ngày thật của kỳ đang chọn — để giáo viên biết mình vừa chọn đúng tuần chưa.
        hint={cur ? `${cur.start} → ${cur.end}` : undefined}
      >
        <select
          value={Math.min(i, opts.length - 1)}
          onChange={(e) => setI(Number(e.target.value))}
          className={selectCls}
        >
          {opts.map((o, idx) => (
            <option key={o.label} value={idx}>
              {o.label}
              {idx === def ? ` — ${currentTag}` : ''}
            </option>
          ))}
        </select>
      </Field>

      {cur && (
        <>
          <input type="hidden" name="period_label" value={cur.label} />
          <input type="hidden" name="start_date" value={cur.start} />
          <input type="hidden" name="end_date" value={cur.end} />
        </>
      )}
    </div>
  );
}

'use client';

import {useState} from 'react';
import {SubmitButton} from '@/components/ui/SubmitButton';
import {saveOverride} from './actions';

type SlotOption = {id: string; label: string; date: string};

// Form ngoại lệ theo ngày. Client component vì các ô phụ chỉ hiện theo trạng thái đang chọn:
// "dời" cần ngày + tiết đích, "dạy thay" cần tên người dạy thay, "huỷ" thì không cần gì.
// Chọn tiết cũng tự điền ngày của tiết đó trong tuần đang xem (đỡ chọn sai thứ).
export function OverrideForm({
  classId,
  slots,
  periods,
  inputCls,
  labels,
}: {
  classId: string;
  slots: SlotOption[];
  periods: number[];
  inputCls: string;
  labels: {
    slot: string;
    date: string;
    status: string;
    cancelled: string;
    moved: string;
    substituted: string;
    newDate: string;
    newPeriod: string;
    substitute: string;
    note: string;
    save: string;
    period: string;
  };
}) {
  const [slotId, setSlotId] = useState(slots[0]?.id ?? '');
  const [date, setDate] = useState(slots[0]?.date ?? '');
  const [status, setStatus] = useState<'cancelled' | 'moved' | 'substituted'>('cancelled');

  return (
    <form action={saveOverride} className="flex flex-wrap items-end gap-2">
      <input type="hidden" name="class_id" value={classId} />

      <label className="min-w-[220px] flex-1">
        <span className="mb-1 block text-nhan font-extrabold uppercase tracking-wide text-grey-mid">
          {labels.slot}
        </span>
        <select
          name="slot_id"
          value={slotId}
          onChange={(e) => {
            setSlotId(e.target.value);
            // Ngày mặc định = ngày của tiết đó trong tuần đang xem.
            const s = slots.find((x) => x.id === e.target.value);
            if (s) setDate(s.date);
          }}
          className={`${inputCls} cursor-pointer`}
        >
          {slots.map((s) => (
            <option key={s.id} value={s.id}>
              {s.label}
            </option>
          ))}
        </select>
      </label>

      <label>
        <span className="mb-1 block text-nhan font-extrabold uppercase tracking-wide text-grey-mid">
          {labels.date}
        </span>
        <input
          type="date"
          name="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className={inputCls}
          required
        />
      </label>

      <label>
        <span className="mb-1 block text-nhan font-extrabold uppercase tracking-wide text-grey-mid">
          {labels.status}
        </span>
        <select
          name="status"
          value={status}
          onChange={(e) => setStatus(e.target.value as typeof status)}
          className={`${inputCls} w-32 cursor-pointer`}
        >
          <option value="cancelled">{labels.cancelled}</option>
          <option value="moved">{labels.moved}</option>
          <option value="substituted">{labels.substituted}</option>
        </select>
      </label>

      {status === 'moved' && (
        <>
          <label>
            <span className="mb-1 block text-nhan font-extrabold uppercase tracking-wide text-grey-mid">
              {labels.newDate}
            </span>
            <input type="date" name="new_date" className={inputCls} required />
          </label>
          <label>
            <span className="mb-1 block text-nhan font-extrabold uppercase tracking-wide text-grey-mid">
              {labels.newPeriod}
            </span>
            <select name="new_period_no" defaultValue="1" className={`${inputCls} w-28 cursor-pointer`}>
              {periods.map((p) => (
                <option key={p} value={p}>
                  {labels.period} {p}
                </option>
              ))}
            </select>
          </label>
        </>
      )}

      {status === 'substituted' && (
        <label className="min-w-[150px]">
          <span className="mb-1 block text-nhan font-extrabold uppercase tracking-wide text-grey-mid">
            {labels.substitute}
          </span>
          <input name="substitute_name" className={inputCls} required />
        </label>
      )}

      <label className="min-w-[160px] flex-1">
        <span className="mb-1 block text-nhan font-extrabold uppercase tracking-wide text-grey-mid">
          {labels.note}
        </span>
        <input name="note" className={inputCls} />
      </label>

      <SubmitButton
        className="btn-gold h-11 cursor-pointer rounded-[8px] px-4 text-sm font-extrabold"
        wrapClass="contents"
      >
        {labels.save}
      </SubmitButton>
    </form>
  );
}

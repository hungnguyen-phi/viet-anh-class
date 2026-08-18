'use client';

import {useActionState, useEffect, useRef} from 'react';
import {AlertCircle, CheckCircle2} from 'lucide-react';
import {SubmitButton} from '@/components/ui/SubmitButton';
import {luuCLB, type LuuOState} from '@/app/[locale]/(dashboard)/timetable/actions';

// FORM THÊM CLB — lỗi hiện NGAY DƯỚI NÚT, không phải toast đầu trang.
//
// Vì sao tách thành client component (18/08/2026): chủ dự án gõ giờ kết thúc sớm hơn giờ bắt
// đầu, bấm Thêm CLB, và chỉ thấy "load xong không có gì" — câu báo nằm ở toast đầu trang, ngoài
// tầm mắt của người đang đứng cuối trang. useActionState giữ nguyên chữ đã gõ khi lỗi; lưu
// thành công thì xoá trắng form cho lượt nhập tiếp.

export function FormThemClb({
  classId,
  days,
  nhan,
  oNhap,
}: {
  classId: string;
  days: {value: number; label: string}[];
  nhan: {day: string; name: string; from: string; to: string; room: string; add: string};
  oNhap: string;
}) {
  const [state, formAction] = useActionState<LuuOState, FormData>(luuCLB, {ok: false});
  const formRef = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state.ok) formRef.current?.reset();
  }, [state]);

  return (
    <form ref={formRef} action={formAction} className="mt-3 flex flex-col gap-2 border-t border-navy/[0.08] pt-3">
      <div className="flex flex-wrap items-end gap-2">
        <input type="hidden" name="class_id" value={classId} />
        <label className="flex flex-col gap-1 text-[11px] font-extrabold uppercase text-grey-mid">
          {nhan.day}
          <select name="day_of_week" className={`${oNhap} h-11 w-20`} defaultValue={7}>
            {days.map((d) => (
              <option key={d.value} value={d.value}>
                {d.label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex min-w-[160px] flex-1 flex-col gap-1 text-[11px] font-extrabold uppercase text-grey-mid">
          {nhan.name}
          <input name="name" required maxLength={80} className={`${oNhap} h-11`} />
        </label>
        <label className="flex flex-col gap-1 text-[11px] font-extrabold uppercase text-grey-mid">
          {nhan.from}
          <input type="time" name="start_time" required className={`${oNhap} h-11 w-28`} />
        </label>
        <label className="flex flex-col gap-1 text-[11px] font-extrabold uppercase text-grey-mid">
          {nhan.to}
          <input type="time" name="end_time" required className={`${oNhap} h-11 w-28`} />
        </label>
        <label className="flex flex-col gap-1 text-[11px] font-extrabold uppercase text-grey-mid">
          {nhan.room}
          <input name="room" maxLength={40} className={`${oNhap} h-11 w-24`} />
        </label>
        <SubmitButton className="btn-gold h-11 cursor-pointer rounded-[10px] px-4 text-sm font-extrabold">
          {nhan.add}
        </SubmitButton>
      </div>
      {state.error && (
        <p className="inline-flex items-start gap-1.5 rounded-[10px] bg-status-bad/[0.08] px-2.5 py-2 text-[12px] font-bold text-status-bad">
          <AlertCircle size={13} strokeWidth={2.5} className="mt-px shrink-0" />
          {state.error}
        </p>
      )}
      {state.ok && state.message && (
        <p className="inline-flex items-start gap-1.5 rounded-[10px] bg-success/[0.10] px-2.5 py-2 text-[12px] font-bold text-success-dark">
          <CheckCircle2 size={13} strokeWidth={2.5} className="mt-px shrink-0" />
          {state.message}
        </p>
      )}
    </form>
  );
}

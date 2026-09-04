'use client';

import {useActionState, useEffect, useRef, useState} from 'react';
import {AlertCircle, CheckCircle2} from 'lucide-react';
import {SubmitButton} from '@/components/ui/SubmitButton';
import {luuCLBCoSo, type LuuOState} from '@/app/[locale]/(dashboard)/timetable/actions';

// Form thêm CLB cho cơ sở — báo lỗi TẠI CHỖ (cùng lối FormThemClb cũ). Chỉ hiện với Admin/BGH.
export function FormThemClbCoSo({
  campusId,
  days,
  nhan,
}: {
  campusId: string;
  days: {value: number; label: string}[];
  nhan: {day: string; name: string; from: string; to: string; room: string; add: string};
}) {
  const [state, formAction] = useActionState<LuuOState, FormData>(luuCLBCoSo, {ok: false});
  const formRef = useRef<HTMLFormElement>(null);
  // Bốn ô này phải do state giữ: React dọn trắng form sau MỖI lần gửi, kể cả khi máy chủ trả lỗi
  // — để ô không kiểm soát thì gõ đủ tên, giờ vào, giờ ra, phòng; nhận một câu lỗi ở MỘT ô; và
  // mất sạch cả bốn. Dọn tay khi lưu xong (form ở lại để thêm ô tiếp), thay cho form.reset() cũ:
  // reset() không đụng được tới ô đã có state.
  const [ten, setTen] = useState('');
  const [tu, setTu] = useState('');
  const [den, setDen] = useState('');
  const [phong, setPhong] = useState('');
  useEffect(() => {
    if (state.ok) { formRef.current?.reset(); setTen(''); setTu(''); setDen(''); setPhong(''); }
  }, [state]);

  const o =
    'w-full rounded-[8px] border-[1.5px] border-navy/15 bg-white px-2 py-2.5 text-than font-semibold text-navy outline-none focus:border-navy';

  return (
    <form ref={formRef} action={formAction} className="mt-3 flex flex-col gap-2 border-t border-navy/[0.08] pt-3">
      <div className="flex flex-wrap items-end gap-2">
        <input type="hidden" name="campus_id" value={campusId} />
        <label className="flex flex-col gap-1 text-nhan font-extrabold uppercase text-grey-mid">
          {nhan.day}
          <select name="weekday" className={`${o} h-11 w-20`} defaultValue={7}>
            {days.map((d) => (
              <option key={d.value} value={d.value}>
                {d.label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex min-w-[160px] flex-1 flex-col gap-1 text-nhan font-extrabold uppercase text-grey-mid">
          {nhan.name}
          <input name="name" required maxLength={120} value={ten} onChange={(e) => setTen(e.target.value)} className={`${o} h-11`} />
        </label>
        <label className="flex flex-col gap-1 text-nhan font-extrabold uppercase text-grey-mid">
          {nhan.from}
          <input type="time" name="start_time" required value={tu} onChange={(e) => setTu(e.target.value)} className={`${o} h-11 w-28`} />
        </label>
        <label className="flex flex-col gap-1 text-nhan font-extrabold uppercase text-grey-mid">
          {nhan.to}
          <input type="time" name="end_time" required value={den} onChange={(e) => setDen(e.target.value)} className={`${o} h-11 w-28`} />
        </label>
        <label className="flex flex-col gap-1 text-nhan font-extrabold uppercase text-grey-mid">
          {nhan.room}
          <input name="room" maxLength={40} value={phong} onChange={(e) => setPhong(e.target.value)} className={`${o} h-11 w-24`} />
        </label>
        <SubmitButton className="btn-gold h-11 cursor-pointer rounded-[8px] px-4 text-sm font-extrabold">
          {nhan.add}
        </SubmitButton>
      </div>
      {state.error && (
        <p className="inline-flex items-start gap-1.5 rounded-[8px] bg-status-bad/[0.08] px-2.5 py-2 text-chu-thich font-bold text-status-bad">
          <AlertCircle size={12} strokeWidth={2.5} className="mt-px shrink-0" />
          {state.error}
        </p>
      )}
      {state.ok && state.message && (
        <p className="inline-flex items-start gap-1.5 rounded-[8px] bg-success/[0.10] px-2.5 py-2 text-chu-thich font-bold text-success-dark">
          <CheckCircle2 size={12} strokeWidth={2.5} className="mt-px shrink-0" />
          {state.message}
        </p>
      )}
    </form>
  );
}

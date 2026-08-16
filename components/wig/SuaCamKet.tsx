'use client';

import {useActionState, useEffect, useState} from 'react';
import {useTranslations} from 'next-intl';
import {AlertCircle, Pencil} from 'lucide-react';
import {SubmitButton} from '@/components/ui/SubmitButton';
import {ConfirmButton} from '@/components/ui/ConfirmButton';
import {Field, ctlWithBorder, btnGold, btnGhost} from '@/components/ui/Field';
import {suaCamKetTuan, xoaCamKetTuan, xoaViecCuaEm, type CamKetState} from '@/app/[locale]/(dashboard)/student/actions';
import {EditRequestButton} from '@/components/student/EditRequestButton';

// SỬA MỘT CAM KẾT TUẦN — của chính em.
//
// Chủ dự án 16/08/2026: "đừng để nút xóa lộ liễu, để là sửa, khi chưa duyệt thì cứ sửa thoải mái,
// còn duyệt thì sửa phải xin, tương tự bên trong".
//   · CHƯA DUYỆT → nút "Sửa" mở một khung nhỏ: tên cam kết, tên + đích của từng việc; "Xoá việc" và
//     "Xoá cam kết" là chữ nhỏ ở cuối khung, không đứng lộ ngoài dòng.
//   · ĐÃ DUYỆT → nút "Xin sửa" (đường xin cô có sẵn, EditRequestButton) — cô gật rồi mới đổi.
// Xoá/sửa việc gì thì cam kết mẹ tự về chờ duyệt (trigger 0141).
export function SuaCamKet({
  commitmentId,
  studentId,
  classId,
  title,
  status,
  viec,
}: {
  commitmentId: string;
  studentId: string;
  classId: string;
  title: string;
  status: string;
  viec: {id: string; title: string; target: number; unit: string | null}[];
}) {
  const t = useTranslations('goal');
  const tm = useTranslations('meeting');
  const [mo, setMo] = useState(false);
  const [state, formAction] = useActionState<CamKetState, FormData>(suaCamKetTuan, {ok: false});
  useEffect(() => {
    if (state.ok) setMo(false);
  }, [state]);

  if (status === 'approved') {
    return viec.length > 0 ? <EditRequestButton studentId={studentId} classId={classId} leads={viec} /> : null;
  }

  if (!mo) {
    return (
      <button type="button" onClick={() => setMo(true)} className={`${btnGhost} h-8 px-2.5 text-[11.5px]`}>
        <Pencil size={12} strokeWidth={2.5} />
        {t('edit')}
      </button>
    );
  }

  return (
    <div className="basis-full">
    <form action={formAction} className="rounded-[12px] border-[1.5px] border-navy/10 bg-white p-3">
      <input type="hidden" name="commitment_id" value={commitmentId} />
      <input type="hidden" name="student_id" value={studentId} />
      <div className="flex flex-col gap-2.5">
        <Field label={tm('commitmentOne')} htmlFor={`sck-${commitmentId}`} error={state.fieldError === 'title' ? state.error : null}>
          <input id={`sck-${commitmentId}`} name="title" defaultValue={title} maxLength={160} className={ctlWithBorder(state.fieldError === 'title')} />
        </Field>
        {viec.map((v) => (
          <div key={v.id} className="grid grid-cols-[1fr_92px] items-end gap-2">
            <input type="hidden" name="viec_id" value={v.id} />
            <Field label={tm('thisWeekWork')} htmlFor={`sv-${v.id}`}>
              <input id={`sv-${v.id}`} name={`viec_title_${v.id}`} defaultValue={v.title} maxLength={120} className={ctlWithBorder(false)} />
            </Field>
            <Field label={v.unit ? `${t('target')} (${v.unit})` : t('target')} htmlFor={`st-${v.id}`}>
              <input id={`st-${v.id}`} name={`viec_target_${v.id}`} type="number" step="any" min="0.01" inputMode="decimal" defaultValue={v.target} className={ctlWithBorder(false)} />
            </Field>
          </div>
        ))}
        {state.error && !state.fieldError && (
          <p className="inline-flex items-start gap-1.5 text-[12px] font-bold text-status-bad">
            <AlertCircle size={13} strokeWidth={2.5} className="mt-px shrink-0" />
            {state.error}
          </p>
        )}
        <div className="flex flex-wrap items-center gap-3">
          <SubmitButton className={btnGold} wrapClass="contents">
            {t('save')}
          </SubmitButton>
          <button type="button" onClick={() => setMo(false)} className="inline-flex min-h-[24px] cursor-pointer items-center text-[12px] font-extrabold text-grey-mid underline">
            {t('cancel')}
          </button>
        </div>
      </div>
    </form>
    {/* XOÁ — chữ nhỏ ở cuối khung, mỗi cái một form riêng (không lồng form). */}
    <div className="mt-1.5 flex flex-wrap items-center justify-end gap-x-3 gap-y-1 px-1">
      {viec.map((v) => (
        <form key={v.id} action={xoaViecCuaEm}>
          <input type="hidden" name="lead_id" value={v.id} />
          <input type="hidden" name="student_id" value={studentId} />
          <ConfirmButton
            message={t('confirmDeleteWork')}
            label={`${t('deleteWork')}: ${v.title}`}
            className="inline-flex min-h-[24px] cursor-pointer items-center text-[11px] font-extrabold text-status-bad underline"
          >
            {t('deleteWork')}{viec.length > 1 ? ` "${v.title}"` : ''}
          </ConfirmButton>
        </form>
      ))}
      <form action={xoaCamKetTuan}>
        <input type="hidden" name="commitment_id" value={commitmentId} />
        <input type="hidden" name="student_id" value={studentId} />
        <ConfirmButton
          message={t('confirmDeleteCommitment')}
          label={t('deleteCommitmentLong')}
          className="inline-flex min-h-[24px] cursor-pointer items-center text-[11px] font-extrabold text-status-bad underline"
        >
          {t('deleteCommitmentLong')}
        </ConfirmButton>
      </form>
    </div>
    </div>
  );
}

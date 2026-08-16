'use client';

import {useActionState, useEffect, useState} from 'react';
import {useTranslations} from 'next-intl';
import {AlertCircle, Pencil} from 'lucide-react';
import {SubmitButton} from '@/components/ui/SubmitButton';
import {ConfirmButton} from '@/components/ui/ConfirmButton';
import {Field, ctlWithBorder, btnGold, btnGhost} from '@/components/ui/Field';
import {suaCamKetLop, xoaCamKetLop, xoaViecLop, type CamKetLopState} from '@/app/[locale]/(dashboard)/wig/actions';

// SỬA / XOÁ CAM KẾT CỦA LỚP — của cô, khi tuần chưa chốt. Cùng dáng với SuaCamKet của em: một nút
// Sửa nhỏ, khung sửa tên cam kết + tên/đích từng việc, xoá là chữ nhỏ cuối khung.
export function SuaCamKetLop({
  commitmentId,
  title,
  viec,
  classParam,
  weekQ,
}: {
  commitmentId: string;
  title: string;
  viec: {id: string; title: string; target: number; unit: string | null}[];
  classParam?: string;
  weekQ?: string;
}) {
  const t = useTranslations('goal');
  const tm = useTranslations('meeting');
  const [mo, setMo] = useState(false);
  const [state, formAction] = useActionState<CamKetLopState, FormData>(suaCamKetLop, {ok: false});
  useEffect(() => {
    if (state.ok) setMo(false);
  }, [state]);

  if (!mo) {
    return (
      <button type="button" onClick={() => setMo(true)} className={`${btnGhost} h-8 px-2.5 text-[11.5px]`}>
        <Pencil size={12} strokeWidth={2.5} />
        {t('edit')}
      </button>
    );
  }
  const an = (
    <>
      {classParam && <input type="hidden" name="class_id" value={classParam} />}
      {weekQ && <input type="hidden" name="week" value={weekQ} />}
    </>
  );
  return (
    <div className="basis-full">
      <form action={formAction} className="rounded-[12px] border-[1.5px] border-navy/10 bg-white p-3">
        <input type="hidden" name="commitment_id" value={commitmentId} />
        <div className="flex flex-col gap-2.5">
          <Field label={tm('commitmentOne')} htmlFor={`sckl-${commitmentId}`} error={state.fieldError === 'title' ? state.error : null}>
            <input id={`sckl-${commitmentId}`} name="title" defaultValue={title} maxLength={160} className={ctlWithBorder(state.fieldError === 'title')} />
          </Field>
          {viec.map((v) => (
            <div key={v.id} className="grid grid-cols-[1fr_92px] items-end gap-2">
              <input type="hidden" name="viec_id" value={v.id} />
              <Field label={tm('thisWeekWork')} htmlFor={`svl-${v.id}`}>
                <input id={`svl-${v.id}`} name={`viec_title_${v.id}`} defaultValue={v.title} maxLength={120} className={ctlWithBorder(false)} />
              </Field>
              <Field label={v.unit ? `${t('target')} (${v.unit})` : t('target')} htmlFor={`stl-${v.id}`}>
                <input id={`stl-${v.id}`} name={`viec_target_${v.id}`} type="number" step="any" min="0.01" inputMode="decimal" defaultValue={v.target} className={ctlWithBorder(false)} />
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
      <div className="mt-1.5 flex flex-wrap items-center justify-end gap-x-3 gap-y-1 px-1">
        {viec.map((v) => (
          <form key={v.id} action={xoaViecLop}>
            {an}
            <input type="hidden" name="lead_id" value={v.id} />
            <ConfirmButton
              message={t('confirmDeleteWorkLop')}
              label={`${t('deleteWork')}: ${v.title}`}
              className="inline-flex min-h-[24px] cursor-pointer items-center text-[11px] font-extrabold text-status-bad underline"
            >
              {t('deleteWork')}{viec.length > 1 ? ` "${v.title}"` : ''}
            </ConfirmButton>
          </form>
        ))}
        <form action={xoaCamKetLop}>
          {an}
          <input type="hidden" name="commitment_id" value={commitmentId} />
          <ConfirmButton
            message={t('confirmDeleteCommitmentLop')}
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

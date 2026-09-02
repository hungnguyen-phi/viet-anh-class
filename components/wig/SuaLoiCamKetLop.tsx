'use client';

// SỬA một cam kết của lớp — hộp gọn: đổi lời hứa + nút XÓA cam kết ngay trong đó (không đặt "xoá"
// riêng ở thẻ nữa, cho gọn). Đổi số hứa thì xoá rồi đặt lại. suaCamKetLop (state) + xoaCamKetLop (redirect).
import {useState, useActionState, useEffect} from 'react';
import {useTranslations} from 'next-intl';
import {Pencil, Trash2, AlertCircle} from 'lucide-react';
import {Popup} from '@/components/ui/Popup';
import {Field, ctlWithBorder} from '@/components/ui/Field';
import {SubmitButton} from '@/components/ui/SubmitButton';
import {suaCamKetLop} from '@/app/[locale]/(dashboard)/wig/actions';
import {xoaCamKetLop} from '@/app/[locale]/(dashboard)/wig/lop-actions';

type CamKetLopState = {ok: boolean; error?: string; fieldError?: string};

export function SuaLoiCamKetLop({
  camKetId,
  noiDung,
  classId,
  weekQ,
}: {
  camKetId: string;
  noiDung: string;
  classId: string;
  weekQ: string;
}) {
  const t = useTranslations('camKet');
  const [mo, setMo] = useState(false);
  const [state, action] = useActionState<CamKetLopState, FormData>(suaCamKetLop, {ok: false});
  useEffect(() => {
    if (state.ok) setMo(false);
  }, [state]);

  return (
    <>
      <button
        type="button"
        onClick={() => setMo(true)}
        aria-label={t('sua')}
        title={t('sua')}
        className="grid h-6 w-6 cursor-pointer place-items-center rounded-[7px] text-navy transition-colors hover:bg-navy/[0.06]"
      >
        <Pencil size={13} strokeWidth={2.5} />
      </button>
      {mo && (
        <Popup title={t('suaCamKet')} onClose={() => setMo(false)} width="max-w-[420px]">
          <form action={action} className="flex flex-col gap-2.5">
            <input type="hidden" name="class_id" value={classId} />
            <input type="hidden" name="week" value={weekQ} />
            <input type="hidden" name="cam_ket_id" value={camKetId} />
            <Field label={t('noiDungLop')} htmlFor="sck-noi">
              <textarea
                id="sck-noi"
                name="noi_dung"
                maxLength={300}
                defaultValue={noiDung}
                className={`${ctlWithBorder(false)} min-h-[72px] resize-none`}
                autoFocus
              />
            </Field>
            {state.error && (
              <span className="inline-flex items-center gap-1 text-[11.5px] font-extrabold text-status-bad">
                <AlertCircle size={12} strokeWidth={2.5} />
                {state.error}
              </span>
            )}
            <SubmitButton
              className="self-start rounded-[10px] bg-navy px-3.5 py-2 text-[12.5px] font-extrabold text-white transition-all hover:bg-navy/90"
              wrapClass="contents"
            >
              {t('luuSua')}
            </SubmitButton>
          </form>

          {/* XÓA cam kết — nằm trong hộp Sửa (tinh gọn); RLS/trigger vẫn quyết được xoá hay không. */}
          <form
            action={xoaCamKetLop}
            className="mt-3 flex justify-end border-t border-navy/[0.08] pt-3"
            onSubmit={(e) => {
              if (!window.confirm(t('xoaHoi'))) e.preventDefault();
            }}
          >
            <input type="hidden" name="class_id" value={classId} />
            <input type="hidden" name="week" value={weekQ} />
            <input type="hidden" name="cam_ket_id" value={camKetId} />
            <SubmitButton
              className="inline-flex cursor-pointer items-center gap-1 text-[12px] font-extrabold text-status-bad underline"
              wrapClass="contents"
            >
              <Trash2 size={13} strokeWidth={2.5} />
              {t('xoaCamKet')}
            </SubmitButton>
          </form>
        </Popup>
      )}
    </>
  );
}

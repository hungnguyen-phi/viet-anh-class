'use client';

// Sửa LỜI của một cam kết lớp (đổi cách nói lời hứa). Chỉ đổi noi_dung — không gửi so_hua nên số
// hứa/đơn vị giữ nguyên (đổi số thì huỷ rồi đặt lại). PA2 có suaCamKetLop nhưng quên nút.
import {useActionState, useEffect, useRef} from 'react';
import {useTranslations} from 'next-intl';
import {AlertCircle} from 'lucide-react';
import {SubmitButton} from '@/components/ui/SubmitButton';
import {suaCamKetLop} from '@/app/[locale]/(dashboard)/wig/actions';

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
  const [state, action] = useActionState<CamKetLopState, FormData>(suaCamKetLop, {ok: false});
  const chiTiet = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    if (state.ok && chiTiet.current) chiTiet.current.open = false;
  }, [state]);

  return (
    <details ref={chiTiet} className="relative">
      <summary className="cursor-pointer list-none text-[11.5px] font-bold text-grey-mid hover:text-navy">
        {t('sua')}
      </summary>
      <form action={action} className="mt-1 flex flex-col gap-1">
        <input type="hidden" name="class_id" value={classId} />
        <input type="hidden" name="week" value={weekQ} />
        <input type="hidden" name="cam_ket_id" value={camKetId} />
        <textarea
          name="noi_dung"
          maxLength={300}
          defaultValue={noiDung}
          className="w-full min-w-[220px] rounded-[8px] border-[1.5px] border-navy/20 px-2 py-1 text-[12px] text-navy"
        />
        {state.error && (
          <span className="inline-flex items-center gap-1 text-[10.5px] font-extrabold text-status-bad">
            <AlertCircle size={11} strokeWidth={2.5} />
            {state.error}
          </span>
        )}
        <SubmitButton className="self-start rounded-[8px] bg-navy px-2.5 py-1 text-[11px] font-extrabold text-white" wrapClass="contents">
          {t('luuSua')}
        </SubmitButton>
      </form>
    </details>
  );
}

'use client';

// BGH TRẢ LẠI một mục tiêu của lớp (kèm lời nhắn để GVCN sửa) — cạnh nút Duyệt trên màn cơ sở.
// PA2 có action traLaiMucTieuLop nhưng quên nút; BGH chỉ duyệt được, không trả lại được.
import {useActionState, useEffect, useRef} from 'react';
import {useTranslations} from 'next-intl';
import {AlertCircle} from 'lucide-react';
import {SubmitButton} from '@/components/ui/SubmitButton';
import {traLaiMucTieuLop} from '@/app/[locale]/(dashboard)/campus/actions';

type DuyetState = {ok: boolean; error?: string};

export function NutTraLaiMtLop({mtId, ten}: {mtId: string; ten: string}) {
  const t = useTranslations('duyet');
  const [state, action] = useActionState<DuyetState, FormData>(traLaiMucTieuLop, {ok: false});
  const chiTiet = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    if (state.ok && chiTiet.current) chiTiet.current.open = false;
  }, [state]);

  return (
    <details ref={chiTiet} className="relative">
      <summary className="cursor-pointer list-none rounded-full border-[1.5px] border-navy/20 bg-white inline-flex min-h-[44px] items-center px-3 py-1 text-chu-thich font-extrabold text-navy hover:border-navy">
        {t('traLai')}
      </summary>
      <form action={action} className="mt-1 flex flex-col gap-1">
        <input type="hidden" name="muc_tieu_id" value={mtId} />
        <textarea
          name="note"
          maxLength={300}
          placeholder={t('traLaiNhan')}
          aria-label={`${t('traLai')} — ${ten}`}
          className="w-full rounded-[8px] border-[1.5px] border-navy/20 px-2 py-1 text-base text-navy sm:text-chu-thich"
        />
        {state.error && (
          <span className="inline-flex items-center gap-1 text-chu-thich font-extrabold text-status-bad">
            <AlertCircle size={11} strokeWidth={2.5} />
            {state.error}
          </span>
        )}
        <SubmitButton className="min-h-[44px] self-start rounded-[8px] bg-navy px-3 text-chu-thich font-extrabold text-white" wrapClass="contents">
          {t('traLaiGui')}
        </SubmitButton>
      </form>
    </details>
  );
}

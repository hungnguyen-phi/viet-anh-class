'use client';

// SỬA CAM KẾT của em — nút bút mở Popup đổi LỜI HỨA (+ SỐ HỨA nếu cam kết có đơn vị). Chỉ hiện khi
// CHƯA chấm (thẻ cha quyết). Dùng action suaCamKet (redirect) — lưu xong tự về trang của em.
import {useState} from 'react';
import {useTranslations} from 'next-intl';
import {Pencil} from 'lucide-react';
import {Popup} from '@/components/ui/Popup';
import {SubmitButton} from '@/components/ui/SubmitButton';
import {suaCamKet} from '@/app/[locale]/(dashboard)/student/actions';

export function SuaCamKetEm({
  studentId,
  camKetId,
  noiDung,
  soHua,
  tenDonVi,
}: {
  studentId: string;
  camKetId: string;
  noiDung: string;
  soHua: number | null;
  tenDonVi: string | null;
}) {
  const t = useTranslations('camKet');
  const [mo, setMo] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setMo(true)}
        aria-label={t('sua')}
        title={t('sua')}
        className="grid h-7 w-7 cursor-pointer place-items-center rounded-[8px] text-navy transition-colors hover:bg-navy/[0.06]"
      >
        <Pencil size={13} strokeWidth={2.5} />
      </button>
      {mo && (
        <Popup title={t('sua')} onClose={() => setMo(false)} width="max-w-[440px]">
          <form action={suaCamKet} className="flex flex-col gap-2.5">
            <input type="hidden" name="student_id" value={studentId} />
            <input type="hidden" name="cam_ket_id" value={camKetId} />
            <input
              name="noi_dung"
              defaultValue={noiDung}
              maxLength={300}
              placeholder={t('noiDungEm')}
              className="rounded-[9px] border-[1.5px] border-navy/20 px-2.5 py-1.5 text-[13px] text-navy"
              autoFocus
            />
            {tenDonVi ? (
              <span className="inline-flex items-center gap-1">
                <span className="text-[12px] font-semibold text-grey-mid">{t('soHua')}</span>
                <input
                  type="number"
                  name="so_hua"
                  defaultValue={soHua ?? ''}
                  step="any"
                  min="0"
                  className="w-24 rounded-[9px] border-[1.5px] border-navy/20 px-2 py-1 text-[12.5px] text-navy"
                />
                <span className="text-[12px] font-semibold text-grey-mid">{tenDonVi}</span>
              </span>
            ) : null}
            <SubmitButton
              className="mt-1 self-start rounded-[12px] bg-navy px-4 py-2.5 text-[13px] font-extrabold text-white transition-all hover:bg-navy/90"
              wrapClass="contents"
            >
              {t('luuSua')}
            </SubmitButton>
          </form>
        </Popup>
      )}
    </>
  );
}

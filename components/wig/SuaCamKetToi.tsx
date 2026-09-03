'use client';

// SỬA cam kết CÁ NHÂN của thầy cô — hộp gọn: đổi lời hứa + số hứa (đơn vị giữ nguyên), kèm nút
// "Đổi cam kết" (đánh dấu huỷ + bỏ thước đo, đặt lại từ đầu — như doiCamKet của em).
import {useState} from 'react';
import {useTranslations} from 'next-intl';
import {Pencil, RefreshCcw, Trash2} from 'lucide-react';
import {Popup} from '@/components/ui/Popup';
import {Field, ctlWithBorder} from '@/components/ui/Field';
import {SubmitButton} from '@/components/ui/SubmitButton';
import {suaCamKetToi, doiCamKetToi, xoaCamKetToi} from '@/app/[locale]/(dashboard)/wig/lop-actions';

export function SuaCamKetToi({
  camKetId,
  noiDung,
  soHua,
  tenDonVi,
  classId,
  weekQ,
}: {
  camKetId: string;
  noiDung: string;
  soHua: number | null;
  tenDonVi: string | null;
  classId: string;
  weekQ: string;
}) {
  const t = useTranslations('camKet');
  const [mo, setMo] = useState(false);

  const ctx = (
    <>
      <input type="hidden" name="class_id" value={classId} />
      <input type="hidden" name="week" value={weekQ} />
      <input type="hidden" name="cam_ket_id" value={camKetId} />
    </>
  );

  return (
    <>
      <button
        type="button"
        onClick={() => setMo(true)}
        aria-label={t('sua')}
        title={t('sua')}
        className="grid h-7 w-7 shrink-0 cursor-pointer place-items-center rounded-[8px] text-grey-mid transition-colors hover:bg-navy/[0.06] hover:text-navy"
      >
        <Pencil size={13} strokeWidth={2.5} />
      </button>
      {mo && (
        <Popup title={t('suaCamKet')} onClose={() => setMo(false)} width="max-w-[460px]">
          <form action={suaCamKetToi} className="flex flex-col gap-3">
            {ctx}
            <Field label={t('noiDungToi')} htmlFor="sct-noi">
              <input id="sct-noi" name="noi_dung" maxLength={300} defaultValue={noiDung} className={ctlWithBorder(false)} autoFocus />
            </Field>
            {soHua != null && (
              <Field label={t('soHuaLabel')} htmlFor="sct-so">
                <span className="inline-flex items-center gap-2">
                  <input id="sct-so" type="number" name="so_hua" step="any" min="0" defaultValue={soHua} className={`${ctlWithBorder(false)} max-w-[160px]`} />
                  <span className="text-[13px] font-bold text-grey-mid">{tenDonVi ?? ''}</span>
                </span>
              </Field>
            )}
            <SubmitButton className="mt-1 self-start rounded-[12px] bg-navy px-4 py-2.5 text-[13px] font-extrabold text-white transition-all hover:bg-navy/90" wrapClass="contents">
              {t('luuSua')}
            </SubmitButton>
          </form>
          {/* Đổi hẳn cam kết (huỷ + bỏ thước, đặt lại bằng nút (+)) · Xoá hẳn (chưa chấm mới xoá được). */}
          <div className="mt-3 flex items-center justify-between gap-2 border-t border-navy/10 pt-3">
            <form
              action={doiCamKetToi}
              onSubmit={(e) => {
                if (!confirm(t('doiHoi'))) e.preventDefault();
              }}
            >
              {ctx}
              <SubmitButton
                className="inline-flex items-center gap-1.5 rounded-[10px] border-[1.5px] border-status-bad/40 px-3 py-1.5 text-[12px] font-extrabold text-status-bad transition-colors hover:bg-status-bad/[0.08]"
                wrapClass="contents"
              >
                <RefreshCcw size={13} strokeWidth={2.5} />
                {t('doi')}
              </SubmitButton>
            </form>
            <form
              action={xoaCamKetToi}
              onSubmit={(e) => {
                if (!confirm(t('xoaHoi'))) e.preventDefault();
              }}
            >
              {ctx}
              <SubmitButton
                className="inline-flex cursor-pointer items-center gap-1 text-[12px] font-extrabold text-status-bad underline"
                wrapClass="contents"
              >
                <Trash2 size={13} strokeWidth={2.5} />
                {t('xoaCamKet')}
              </SubmitButton>
            </form>
          </div>
        </Popup>
      )}
    </>
  );
}

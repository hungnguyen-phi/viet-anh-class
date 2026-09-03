'use client';

// Nút "+" thêm CAM KẾT tuần CÁ NHÂN của thầy cô (treo ở mục tiêu cá nhân, không phải mục tiêu
// lớp — chốt 03/09). Bấm → hộp: lời hứa + số hứa với đơn vị ÉP theo mục tiêu cá nhân. Thước đo
// dẫn dắt có nút riêng dưới mỗi cam kết (NutThemThuoc mode='toi').
import {useState} from 'react';
import {Plus} from 'lucide-react';
import {useTranslations} from 'next-intl';
import {Popup} from '@/components/ui/Popup';
import {Field, ctlWithBorder} from '@/components/ui/Field';
import {SubmitButton} from '@/components/ui/SubmitButton';
import {taoCamKetToi} from '@/app/[locale]/(dashboard)/wig/lop-actions';

export function NutThemCamKetToi({
  classId,
  weekQ,
  monday,
  mucTieuId,
  tenMucTieu,
  tenDonVi,
}: {
  classId: string;
  weekQ: string;
  monday: string;
  mucTieuId: string;
  tenMucTieu: string;
  tenDonVi: string | null;
}) {
  const t = useTranslations('lopMucTieu');
  const tCk = useTranslations('camKet');
  const [mo, setMo] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setMo(true)}
        aria-label={t('themCamKetToi')}
        title={t('themCamKetToi')}
        className="grid h-7 w-7 shrink-0 cursor-pointer place-items-center rounded-full bg-gold text-navy shadow-sm transition-transform hover:scale-105 active:scale-95"
      >
        <Plus size={16} strokeWidth={3} />
      </button>
      {mo && (
        <Popup title={t('themCamKetToi')} onClose={() => setMo(false)} width="max-w-[460px]">
          <form action={taoCamKetToi} className="flex flex-col gap-3">
            <input type="hidden" name="class_id" value={classId} />
            <input type="hidden" name="week" value={weekQ} />
            <input type="hidden" name="tuan_bat_dau" value={monday} />
            <input type="hidden" name="muc_tieu_id" value={mucTieuId} />
            <p className="text-[12px] font-bold text-grey-mid">{tCk('giupMucTieu', {ten: tenMucTieu})}</p>
            <Field label={tCk('noiDungToi')} htmlFor="ckt-noi">
              <input id="ckt-noi" name="noi_dung" maxLength={300} placeholder={tCk('noiDungToi')} className={ctlWithBorder(false)} autoFocus />
            </Field>
            {/* Đơn vị ÉP theo mục tiêu cá nhân — mục tiêu không đo bằng số thì cam kết chấm tay. */}
            {tenDonVi && (
              <Field label={tCk('soHuaLabel')} htmlFor="ckt-so">
                <span className="inline-flex items-center gap-2">
                  <input id="ckt-so" type="number" name="so_hua" step="any" min="0" placeholder={tCk('soHua')} className={`${ctlWithBorder(false)} max-w-[160px]`} />
                  <span className="text-[13px] font-bold text-grey-mid">{tenDonVi}</span>
                </span>
              </Field>
            )}
            <SubmitButton className="mt-1 self-start rounded-[12px] bg-navy px-4 py-2.5 text-[13px] font-extrabold text-white transition-all hover:bg-navy/90" wrapClass="contents">
              {tCk('luu')}
            </SubmitButton>
          </form>
        </Popup>
      )}
    </>
  );
}

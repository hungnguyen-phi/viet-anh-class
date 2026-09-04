'use client';

// Nút "+" thêm CAM KẾT tuần CÁ NHÂN của thầy cô (treo ở mục tiêu cá nhân). Hộp: lời hứa + số hứa
// với đơn vị ÉP theo mục tiêu. 04/09: đường state — lỗi hiện dưới ô, ô giữ chữ, lưu xong tự đóng.
import {useState} from 'react';
import {Plus} from 'lucide-react';
import {useTranslations} from 'next-intl';
import {Popup} from '@/components/ui/Popup';
import {Field, ctlWithBorder} from '@/components/ui/Field';
import {FormTaiCho, NutGui} from '@/components/ui/FormTaiCho';
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
  const [nd, setNd] = useState('');
  const [so, setSo] = useState('');
  const dong = () => {
    setMo(false);
    setNd('');
    setSo('');
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setMo(true)}
        aria-label={t('themCamKetToi')}
        title={t('themCamKetToi')}
        className="relative grid h-9 w-9 shrink-0 cursor-pointer place-items-center rounded-full bg-gold text-navy shadow-sm transition-transform after:absolute after:left-1/2 after:top-1/2 after:h-11 after:w-11 after:-translate-x-1/2 after:-translate-y-1/2 after:content-[''] hover:scale-105 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy"
      >
        <Plus size={18} strokeWidth={3} />
      </button>
      {mo && (
        <Popup title={t('themCamKetToi')} onClose={dong} width="max-w-[460px]">
          <FormTaiCho action={taoCamKetToi} className="flex flex-col gap-3" onOk={dong} anThanhCong>
            {(state) => (
              <>
                <input type="hidden" name="class_id" value={classId} />
                <input type="hidden" name="week" value={weekQ} />
                <input type="hidden" name="tuan_bat_dau" value={monday} />
                <input type="hidden" name="muc_tieu_id" value={mucTieuId} />
                <p className="text-[12px] font-bold text-grey-mid">{tCk('giupMucTieu', {ten: tenMucTieu})}</p>
                <Field label={tCk('noiDungToi')} htmlFor="ckt-noi" error={state.fieldError === 'noi_dung' ? state.error : null}>
                  <input id="ckt-noi" name="noi_dung" maxLength={300} value={nd} onChange={(e) => setNd(e.target.value)} placeholder={tCk('noiDungToi')} className={ctlWithBorder(state.fieldError === 'noi_dung')} autoFocus />
                </Field>
                {tenDonVi && (
                  <Field label={tCk('soHuaLabel')} htmlFor="ckt-so" error={state.fieldError === 'so_hua' ? state.error : null}>
                    <span className="inline-flex items-center gap-2">
                      <input id="ckt-so" type="number" name="so_hua" step="any" min="0" value={so} onChange={(e) => setSo(e.target.value)} placeholder={tCk('soHua')} className={`${ctlWithBorder(state.fieldError === 'so_hua')} max-w-[160px]`} />
                      <span className="text-[13px] font-bold text-grey-mid">{tenDonVi}</span>
                    </span>
                  </Field>
                )}
                <NutGui className="mt-1 self-start rounded-[12px] bg-navy px-4 text-[13px] font-extrabold text-white transition-all hover:bg-navy/90 focus-visible:ring-2 focus-visible:ring-gold">
                  {tCk('luu')}
                </NutGui>
              </>
            )}
          </FormTaiCho>
        </Popup>
      )}
    </>
  );
}

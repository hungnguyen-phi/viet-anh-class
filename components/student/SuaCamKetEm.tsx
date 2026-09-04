'use client';

// SỬA CAM KẾT của em — nút bút mở hộp đổi LỜI HỨA (+ SỐ HỨA nếu cam kết có đơn vị). Chỉ hiện khi
// CHƯA chấm (thẻ cha quyết). 04/09: đường state — gửi rỗng thì lỗi hiện dưới ô và ô GIỮ chữ
// (trước đây redirect, mất luôn nội dung đang sửa).
import {useState} from 'react';
import {useTranslations} from 'next-intl';
import {Pencil} from 'lucide-react';
import {Popup} from '@/components/ui/Popup';
import {Field, ctlWithBorder} from '@/components/ui/Field';
import {FormTaiCho, NutGui} from '@/components/ui/FormTaiCho';
import {suaCamKetTaiCho} from '@/app/[locale]/(dashboard)/student/actions';

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
  const [nd, setNd] = useState(noiDung);
  const [so, setSo] = useState(soHua != null ? String(soHua) : '');
  return (
    <>
      <button
        type="button"
        onClick={() => setMo(true)}
        aria-label={t('sua')}
        title={t('sua')}
        className="cham-44 relative grid h-8 w-8 cursor-pointer place-items-center rounded-[8px] text-navy transition-colors after:absolute after:left-1/2 after:top-1/2 after:h-11 after:w-11 after:-translate-x-1/2 after:-translate-y-1/2 after:content-[''] hover:bg-navy/[0.06] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold"
      >
        <Pencil size={14} strokeWidth={2.5} />
      </button>
      {mo && (
        <Popup title={t('suaCamKet')} onClose={() => setMo(false)} width="max-w-[440px]">
          <FormTaiCho action={suaCamKetTaiCho} className="flex flex-col gap-2.5" onOk={() => setMo(false)} anThanhCong>
            {(state) => (
              <>
                <input type="hidden" name="student_id" value={studentId} />
                <input type="hidden" name="cam_ket_id" value={camKetId} />
                <Field label={t('noiDungEm')} htmlFor="sce-noi" error={state.fieldError === 'noi_dung' ? state.error : null}>
                  <input id="sce-noi" name="noi_dung" value={nd} onChange={(e) => setNd(e.target.value)} maxLength={300} placeholder={t('noiDungEm')} className={ctlWithBorder(state.fieldError === 'noi_dung')} autoFocus />
                </Field>
                {tenDonVi ? (
                  <Field label={t('soHuaLabel')} htmlFor="sce-so" error={state.fieldError === 'so_hua' ? state.error : null}>
                    <span className="inline-flex items-center gap-2">
                      <input id="sce-so" type="number" name="so_hua" value={so} onChange={(e) => setSo(e.target.value)} step="any" min="0" className={`${ctlWithBorder(state.fieldError === 'so_hua')} max-w-[140px]`} />
                      <span className="text-[13px] font-bold text-grey-mid">{tenDonVi}</span>
                    </span>
                  </Field>
                ) : null}
                <NutGui className="mt-1 self-start rounded-[12px] bg-navy px-4 text-[13px] font-extrabold text-white transition-all hover:bg-navy/90 focus-visible:ring-2 focus-visible:ring-gold">
                  {t('luuSua')}
                </NutGui>
              </>
            )}
          </FormTaiCho>
        </Popup>
      )}
    </>
  );
}

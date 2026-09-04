'use client';

// SỬA cam kết CÁ NHÂN của thầy cô — hộp gọn: đổi lời hứa + số hứa (đơn vị giữ nguyên) và
// "Xóa cam kết" (= huỷ ngầm: ẩn + dừng lăn tuần + bỏ thước). 04/09: đường state — gửi rỗng thì
// lỗi hiện dưới ô, ô GIỮ chữ; xoá hỏi lại bằng hộp xác nhận của app (không window.confirm).
import {useState} from 'react';
import {useTranslations} from 'next-intl';
import {Pencil, Trash2} from 'lucide-react';
import {Popup} from '@/components/ui/Popup';
import {Field, ctlWithBorder} from '@/components/ui/Field';
import {FormTaiCho, NutGui} from '@/components/ui/FormTaiCho';
import {suaCamKetToi, xoaCamKetToi} from '@/app/[locale]/(dashboard)/wig/lop-actions';

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
  const [nd, setNd] = useState(noiDung);
  const [so, setSo] = useState(soHua != null ? String(soHua) : '');

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
        className="grid h-11 w-11 shrink-0 cursor-pointer place-items-center rounded-[12px] text-grey-mid transition-colors hover:bg-navy/[0.06] hover:text-navy focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold"
      >
        <Pencil size={14} strokeWidth={2.5} />
      </button>
      {mo && (
        <Popup title={t('suaCamKet')} onClose={() => setMo(false)} width="max-w-[460px]">
          <FormTaiCho action={suaCamKetToi} className="flex flex-col gap-3" onOk={() => setMo(false)} anThanhCong>
            {(state) => (
              <>
                {ctx}
                <Field label={t('noiDungToi')} htmlFor="sct-noi" error={state.fieldError === 'noi_dung' ? state.error : null}>
                  <input id="sct-noi" name="noi_dung" maxLength={300} value={nd} onChange={(e) => setNd(e.target.value)} className={ctlWithBorder(state.fieldError === 'noi_dung')} autoFocus />
                </Field>
                {soHua != null && (
                  <Field label={t('soHuaLabel')} htmlFor="sct-so" error={state.fieldError === 'so_hua' ? state.error : null}>
                    <span className="inline-flex items-center gap-2">
                      <input id="sct-so" type="number" name="so_hua" step="any" min="0" value={so} onChange={(e) => setSo(e.target.value)} className={`${ctlWithBorder(state.fieldError === 'so_hua')} max-w-[160px]`} />
                      <span className="text-than font-bold text-grey-mid">{tenDonVi ?? ''}</span>
                    </span>
                  </Field>
                )}
                <NutGui className="mt-1 self-start rounded-[12px] bg-navy px-4 text-than font-extrabold text-white transition-all hover:bg-navy/90 focus-visible:ring-2 focus-visible:ring-gold">
                  {t('luuSua')}
                </NutGui>
              </>
            )}
          </FormTaiCho>
          <div className="mt-3 flex items-center justify-end gap-2 border-t border-navy/10 pt-3">
            <FormTaiCho action={xoaCamKetToi} xacNhan={t('xoaHoi')} nhanXacNhan={t('xoaCamKet')} nguyHiem onOk={() => setMo(false)} anThanhCong className="flex flex-col items-end gap-1">
              {ctx}
              <NutGui className="inline-flex cursor-pointer items-center gap-1 rounded-[12px] px-3 text-than font-extrabold text-status-bad hover:bg-status-bad/[0.08] focus-visible:ring-2 focus-visible:ring-gold">
                <Trash2 size={14} strokeWidth={2.5} />
                {t('xoaCamKet')}
              </NutGui>
            </FormTaiCho>
          </div>
        </Popup>
      )}
    </>
  );
}

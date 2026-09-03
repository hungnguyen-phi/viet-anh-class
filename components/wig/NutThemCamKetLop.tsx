'use client';

// Nút "+" thêm CAM KẾT tuần của lớp. Bấm → mở hộp: chỉ lời hứa + số hứa. Thước đo dẫn dắt tách ra
// nút riêng dưới mỗi cam kết (NutThemThuoc). Dùng action taoCamKetLop (redirect) — lưu xong về đúng lớp/tuần.
import {useState} from 'react';
import {Plus} from 'lucide-react';
import {useTranslations} from 'next-intl';
import {Popup} from '@/components/ui/Popup';
import {Field, ctlWithBorder} from '@/components/ui/Field';
import {SubmitButton} from '@/components/ui/SubmitButton';
import {taoCamKetLop} from '@/app/[locale]/(dashboard)/wig/lop-actions';

export function NutThemCamKetLop({
  classId,
  weekQ,
  monday,
  mucTieuId,
}: {
  classId: string;
  weekQ: string;
  monday: string;
  mucTieuId: string;
}) {
  const t = useTranslations('lopMucTieu');
  const tCk = useTranslations('camKet');
  const [mo, setMo] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setMo(true)}
        aria-label={t('themCamKet')}
        title={t('themCamKet')}
        className="grid h-7 w-7 shrink-0 cursor-pointer place-items-center rounded-full bg-gold text-navy shadow-sm transition-transform hover:scale-105 active:scale-95"
      >
        <Plus size={16} strokeWidth={3} />
      </button>
      {mo && (
        <Popup title={t('themCamKet')} onClose={() => setMo(false)} width="max-w-[460px]">
          <form action={taoCamKetLop} className="flex flex-col gap-3">
            <input type="hidden" name="class_id" value={classId} />
            <input type="hidden" name="week" value={weekQ} />
            <input type="hidden" name="tuan_bat_dau" value={monday} />
            <input type="hidden" name="muc_tieu_id" value={mucTieuId} />
            <Field label={tCk('noiDungLop')} htmlFor="ck-noi">
              <input id="ck-noi" name="noi_dung" maxLength={300} placeholder={tCk('noiDungLop')} className={ctlWithBorder(false)} autoFocus />
            </Field>
            <Field label={tCk('soHuaLabel')} htmlFor="ck-so">
              <input id="ck-so" type="number" name="so_hua" step="any" min="0" placeholder={tCk('soHua')} className={`${ctlWithBorder(false)} max-w-[160px]`} />
            </Field>
            <SubmitButton className="mt-1 self-start rounded-[12px] bg-navy px-4 py-2.5 text-[13px] font-extrabold text-white transition-all hover:bg-navy/90" wrapClass="contents">
              {tCk('luu')}
            </SubmitButton>
          </form>
        </Popup>
      )}
    </>
  );
}

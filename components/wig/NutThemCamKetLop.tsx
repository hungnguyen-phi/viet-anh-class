'use client';

// Nút "+" thêm CAM KẾT tuần của lớp. Bấm → mở hộp: lời hứa · VIỆC BỔ TRỢ (một cột mốc nhỏ cô tick/
// đo cả đội) · số hứa. Việc bổ trợ đo tùy đơn vị: "Tick mỗi ngày" (số ngày) hoặc "Đo bằng số" (đơn
// vị + đích/tuần) — y như màn của em. Dùng action taoCamKetLop (redirect) — lưu xong về đúng lớp/tuần.
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
  donViList = [],
}: {
  classId: string;
  weekQ: string;
  monday: string;
  mucTieuId: string;
  donViList?: {id: string; ma: string; nhan?: string}[];
}) {
  const t = useTranslations('lopMucTieu');
  const tCk = useTranslations('camKet');
  const [mo, setMo] = useState(false);
  const [viecCach, setViecCach] = useState<'cham' | 'dien_so'>('cham');

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
            <Field label={tCk('viecBoTroLabel')} htmlFor="ck-viec" hint={tCk('viecBoTroHint')}>
              <input id="ck-viec" name="viec_bo_tro" maxLength={100} placeholder={tCk('viecBoTroHoi')} className={ctlWithBorder(false)} />
            </Field>
            {/* CÁCH ĐO việc bổ trợ: tick mỗi ngày (số ngày) hoặc đo bằng số (đơn vị + đích/tuần). */}
            <div>
              <input type="hidden" name="viec_cach" value={viecCach} />
              <div className="mb-1.5 inline-flex rounded-[9px] border-[1.5px] border-navy/20 p-0.5 text-[12px] font-extrabold">
                <button
                  type="button"
                  onClick={() => setViecCach('cham')}
                  className={`cursor-pointer rounded-[7px] px-2.5 py-1 transition-colors ${viecCach === 'cham' ? 'bg-navy text-white' : 'text-grey-mid'}`}
                >
                  {tCk('viecTick')}
                </button>
                <button
                  type="button"
                  onClick={() => setViecCach('dien_so')}
                  className={`cursor-pointer rounded-[7px] px-2.5 py-1 transition-colors ${viecCach === 'dien_so' ? 'bg-navy text-white' : 'text-grey-mid'}`}
                >
                  {tCk('viecSo')}
                </button>
              </div>
              {viecCach === 'cham' ? (
                <Field label={tCk('soNgayLabel')} htmlFor="ck-ngay" hint={tCk('soNgayHint')}>
                  <input id="ck-ngay" type="number" name="so_ngay" min="1" max="7" defaultValue="5" className={`${ctlWithBorder(false)} max-w-[120px]`} />
                </Field>
              ) : (
                <div className="flex flex-wrap items-end gap-2">
                  <Field label={tCk('chonDonVi')} htmlFor="ck-vdv">
                    <select id="ck-vdv" name="viec_don_vi" className={ctlWithBorder(false)} defaultValue="">
                      <option value="">{tCk('chonDonVi')}</option>
                      {donViList.map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.nhan ?? d.ma}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label={tCk('viecDichHoi')} htmlFor="ck-vdich">
                    <input id="ck-vdich" type="number" name="viec_dich" step="any" min="0" placeholder={tCk('viecDichHoi')} className={`${ctlWithBorder(false)} max-w-[120px]`} />
                  </Field>
                </div>
              )}
            </div>
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

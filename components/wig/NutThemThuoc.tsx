'use client';

// Nút "+ Thước đo dẫn dắt" RIÊNG dưới mỗi cam kết (chưa có thước đo). Bấm → mở hộp: tên việc +
// cách đo (Tick mỗi ngày → số ngày · Đo bằng số → đơn vị + đích/tuần). Lưu xong tạo một thuoc rồi
// nối vào cam kết qua thuoc_id. Dùng chung cho màn cô (mode='lop') và màn em (mode='em').
import {useState} from 'react';
import {Ruler} from 'lucide-react';
import {useTranslations} from 'next-intl';
import {Popup} from '@/components/ui/Popup';
import {Field, ctlWithBorder} from '@/components/ui/Field';
import {SubmitButton} from '@/components/ui/SubmitButton';
import {themThuocChoCamKetLop} from '@/app/[locale]/(dashboard)/wig/lop-actions';
import {themThuocChoCamKet} from '@/app/[locale]/(dashboard)/student/actions';

export function NutThemThuoc({
  mode,
  camKetId,
  classId,
  studentId,
  weekQ,
  monday,
  donViList = [],
}: {
  mode: 'lop' | 'em';
  camKetId: string;
  classId: string;
  studentId?: string;
  weekQ?: string;
  monday: string;
  donViList?: {id: string; ma: string; nhan?: string}[];
}) {
  const t = useTranslations('camKet');
  const [mo, setMo] = useState(false);
  const [viecCach, setViecCach] = useState<'cham' | 'dien_so'>('cham');
  const action = mode === 'lop' ? themThuocChoCamKetLop : themThuocChoCamKet;

  return (
    <>
      <button
        type="button"
        onClick={() => setMo(true)}
        className="inline-flex items-center gap-1.5 self-start rounded-[10px] border-[1.5px] border-dashed border-navy/25 px-2.5 py-1.5 text-[12px] font-extrabold text-grey-mid transition-colors hover:border-navy/50 hover:text-navy"
      >
        <Ruler size={14} strokeWidth={2.5} />
        {t('themThuoc')}
      </button>
      {mo && (
        <Popup title={t('themThuoc')} onClose={() => setMo(false)} width="max-w-[460px]">
          <form action={action} className="flex flex-col gap-3">
            <input type="hidden" name="cam_ket_id" value={camKetId} />
            <input type="hidden" name="class_id" value={classId} />
            {mode === 'em' && <input type="hidden" name="student_id" value={studentId ?? ''} />}
            {mode === 'lop' && <input type="hidden" name="week" value={weekQ ?? ''} />}
            <input type="hidden" name="tuan_bat_dau" value={monday} />
            <input type="hidden" name="viec_cach" value={viecCach} />
            <Field label={t('viecBoTroLabel')} htmlFor="tt-ten" hint={t('viecBoTroHint')}>
              <input id="tt-ten" name="ten" maxLength={160} placeholder={t('viecBoTroHoi')} className={ctlWithBorder(false)} autoFocus />
            </Field>
            {/* CÁCH ĐO: tick mỗi ngày (số ngày) hoặc đo bằng số (đơn vị + đích/tuần). */}
            <div>
              <div className="mb-1.5 inline-flex rounded-[9px] border-[1.5px] border-navy/20 p-0.5 text-[12px] font-extrabold">
                <button
                  type="button"
                  onClick={() => setViecCach('cham')}
                  className={`cursor-pointer rounded-[7px] px-2.5 py-1 transition-colors ${viecCach === 'cham' ? 'bg-navy text-white' : 'text-grey-mid'}`}
                >
                  {t('viecTick')}
                </button>
                <button
                  type="button"
                  onClick={() => setViecCach('dien_so')}
                  className={`cursor-pointer rounded-[7px] px-2.5 py-1 transition-colors ${viecCach === 'dien_so' ? 'bg-navy text-white' : 'text-grey-mid'}`}
                >
                  {t('viecSo')}
                </button>
              </div>
              {viecCach === 'cham' ? (
                <Field label={t('soNgayLabel')} htmlFor="tt-ngay" hint={t('soNgayHint')}>
                  <input id="tt-ngay" type="number" name="so_ngay" min="1" max="7" defaultValue="5" className={`${ctlWithBorder(false)} max-w-[120px]`} />
                </Field>
              ) : (
                <div className="flex flex-wrap items-end gap-2">
                  <Field label={t('chonDonVi')} htmlFor="tt-vdv">
                    <select id="tt-vdv" name="viec_don_vi" className={ctlWithBorder(false)} defaultValue="">
                      <option value="">{t('chonDonVi')}</option>
                      {donViList.map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.nhan ?? d.ma}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label={t('viecDichHoi')} htmlFor="tt-vdich">
                    <input id="tt-vdich" type="number" name="viec_dich" step="any" min="0" placeholder={t('viecDichHoi')} className={`${ctlWithBorder(false)} max-w-[120px]`} />
                  </Field>
                </div>
              )}
            </div>
            <SubmitButton className="mt-1 self-start rounded-[12px] bg-navy px-4 py-2.5 text-[13px] font-extrabold text-white transition-all hover:bg-navy/90" wrapClass="contents">
              {t('luu')}
            </SubmitButton>
          </form>
        </Popup>
      )}
    </>
  );
}

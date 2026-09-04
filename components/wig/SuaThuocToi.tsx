'use client';

// SỬA / XÓA THƯỚC ĐO DẪN DẮT cá nhân của thầy cô — nút bút cạnh tên thước, mở hộp: đổi tên +
// cách đo + đích + ngày tick. Đã có lượt ghi thì KHOÁ cách đo/đơn vị (th_truoc_sua chặn) và nói
// lý do ngay trong hộp; xoá chỉ được khi chưa ghi lần nào (th_truoc_xoa). 04/09: đường state.
import {useState} from 'react';
import {useTranslations} from 'next-intl';
import {Pencil, Trash2} from 'lucide-react';
import {Popup} from '@/components/ui/Popup';
import {Field, ctlWithBorder} from '@/components/ui/Field';
import {ChonNgayTuan} from '@/components/ui/ChonNgayTuan';
import {FormTaiCho, NutGui} from '@/components/ui/FormTaiCho';
import {suaThuocToi, xoaThuocToi} from '@/app/[locale]/(dashboard)/wig/lop-actions';

export function SuaThuocToi({
  thuocId,
  ten,
  cachGhi,
  chiTieu,
  ngayApDung,
  donViId,
  classId,
  weekQ,
  coLuot,
  donViList = [],
}: {
  thuocId: string;
  ten: string;
  cachGhi: string;
  chiTieu: number;
  ngayApDung: number[];
  donViId: string | null;
  classId: string;
  weekQ: string;
  /** Đã có lượt ghi → khoá đổi cách đo/đơn vị, nói lý do. */
  coLuot: boolean;
  donViList?: {id: string; ma: string; nhan?: string}[];
}) {
  const t = useTranslations('camKet');
  const [mo, setMo] = useState(false);
  const [tenMoi, setTenMoi] = useState(ten);
  const [dich, setDich] = useState(String(chiTieu || ''));
  const [viecCach, setViecCach] = useState<'cham' | 'dien_so'>(cachGhi === 'dien_so' ? 'dien_so' : 'cham');

  const ctx = (
    <>
      <input type="hidden" name="class_id" value={classId} />
      <input type="hidden" name="week" value={weekQ} />
      <input type="hidden" name="thuoc_id" value={thuocId} />
    </>
  );

  return (
    <>
      <button
        type="button"
        onClick={() => setMo(true)}
        aria-label={t('suaThuoc')}
        title={t('suaThuoc')}
        className="cham-44 relative grid h-8 w-8 shrink-0 cursor-pointer place-items-center rounded-[8px] text-grey-mid transition-colors after:absolute after:left-1/2 after:top-1/2 after:h-11 after:w-11 after:-translate-x-1/2 after:-translate-y-1/2 after:content-[''] hover:bg-navy/[0.06] hover:text-navy focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold"
      >
        <Pencil size={14} strokeWidth={2.5} />
      </button>
      {mo && (
        <Popup title={t('suaThuoc')} onClose={() => setMo(false)} width="max-w-[460px]">
          <FormTaiCho action={suaThuocToi} className="flex flex-col gap-2.5" onOk={() => setMo(false)} anThanhCong>
            {(state) => (
              <>
                {ctx}
                <input type="hidden" name="viec_cach" value={viecCach} />
                <Field label={t('viecBoTroLabel')} htmlFor="stt-ten" error={state.fieldError === 'ten' ? state.error : null}>
                  <input id="stt-ten" name="ten" maxLength={160} value={tenMoi} onChange={(e) => setTenMoi(e.target.value)} className={ctlWithBorder(state.fieldError === 'ten')} autoFocus />
                </Field>

                {coLuot ? (
                  <p className="text-chu-thich font-semibold italic text-grey-mid">{t('khoaCachDo')}</p>
                ) : (
                  <div className="inline-flex w-fit rounded-[12px] border-[1.5px] border-navy/20 p-0.5 text-than font-extrabold">
                    {(['cham', 'dien_so'] as const).map((c) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setViecCach(c)}
                        aria-pressed={viecCach === c}
                        className={`min-h-[40px] cursor-pointer rounded-[8px] px-3 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold ${viecCach === c ? 'bg-navy text-white' : 'text-grey-mid'}`}
                      >
                        {c === 'cham' ? t('viecTick') : t('viecSo')}
                      </button>
                    ))}
                  </div>
                )}

                {viecCach === 'cham' ? (
                  <Field label={t('chonNgayTick')} htmlFor="stt-ngay" hint={t('chonNgayHint')} error={state.fieldError === 'ngay' ? state.error : null}>
                    <ChonNgayTuan daChon={ngayApDung} />
                  </Field>
                ) : (
                  <div className="flex flex-wrap items-end gap-2">
                    {!coLuot && (
                      <Field label={t('chonDonVi')} htmlFor="stt-vdv">
                        <select id="stt-vdv" name="viec_don_vi" defaultValue={donViId ?? ''} className={ctlWithBorder(false)}>
                          <option value="">{t('chonDonVi')}</option>
                          {donViList.map((d) => (
                            <option key={d.id} value={d.id}>
                              {d.nhan ?? d.ma}
                            </option>
                          ))}
                        </select>
                      </Field>
                    )}
                    <Field label={t('viecDichHoi')} htmlFor="stt-vdich" error={state.fieldError === 'viec_dich' ? state.error : null}>
                      <input id="stt-vdich" type="number" name="viec_dich" step="any" min="0" value={dich} onChange={(e) => setDich(e.target.value)} className={`${ctlWithBorder(state.fieldError === 'viec_dich')} max-w-[120px]`} />
                    </Field>
                  </div>
                )}
                <NutGui className="mt-1 self-start rounded-[12px] bg-navy px-4 text-than font-extrabold text-white transition-all hover:bg-navy/90 focus-visible:ring-2 focus-visible:ring-gold">
                  {t('luuSua')}
                </NutGui>
              </>
            )}
          </FormTaiCho>

          <div className="mt-3 flex justify-end border-t border-navy/[0.08] pt-3">
            <FormTaiCho action={xoaThuocToi} xacNhan={t('xoaThuocHoi')} nhanXacNhan={t('xoaThuoc')} nguyHiem onOk={() => setMo(false)} anThanhCong className="flex flex-col items-end gap-1">
              {ctx}
              <NutGui className="inline-flex cursor-pointer items-center gap-1 rounded-[12px] px-3 text-than font-extrabold text-status-bad hover:bg-status-bad/[0.08] focus-visible:ring-2 focus-visible:ring-gold">
                <Trash2 size={14} strokeWidth={2.5} />
                {t('xoaThuoc')}
              </NutGui>
            </FormTaiCho>
          </div>
        </Popup>
      )}
    </>
  );
}

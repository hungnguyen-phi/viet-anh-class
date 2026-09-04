'use client';

// SỬA / XÓA THƯỚC ĐO DẪN DẮT của em — nút bút mở hộp đổi TÊN + CÁCH ĐO (tick những ngày chọn /
// đo bằng số + đơn vị) + ĐÍCH + NGÀY (hiệu lực ngay, KHÔNG duyệt). Đổi đơn vị/cách-đo chỉ được khi
// CHƯA ghi lượt nào (trigger th_truoc_sua chặn — câu báo hiện nguyên). 04/09: đường state, xoá hỏi
// lại bằng hộp xác nhận của app.
import {useState} from 'react';
import {useTranslations} from 'next-intl';
import {Pencil, Trash2} from 'lucide-react';
import {Popup} from '@/components/ui/Popup';
import {Field, ctlWithBorder} from '@/components/ui/Field';
import {ChonNgayTuan} from '@/components/ui/ChonNgayTuan';
import {FormTaiCho, NutGui} from '@/components/ui/FormTaiCho';
import {suaViecTaiCho, xoaViecTaiCho} from '@/app/[locale]/(dashboard)/student/actions';

export function SuaViecEm({
  studentId,
  thuocId,
  ten,
  chiTieu,
  ngayApDung,
  tenDonVi,
  cachGhi,
  donViId,
  coLuot = false,
  donViList = [],
}: {
  studentId: string;
  thuocId: string;
  ten: string;
  chiTieu: number;
  ngayApDung: number[];
  tenDonVi: string | null;
  cachGhi?: string;
  donViId?: string | null;
  /** Đã có lượt ghi tuần này → khoá đổi cách đo/đơn vị (trigger chặn), nói lý do thay vì để lỗi văng. */
  coLuot?: boolean;
  donViList?: {id: string; ma: string; nhan?: string}[];
}) {
  const t = useTranslations('viec');
  const [mo, setMo] = useState(false);
  const [tenMoi, setTenMoi] = useState(ten);
  const [dich, setDich] = useState(String(chiTieu || ''));
  const [viecCach, setViecCach] = useState<'cham' | 'dien_so'>(cachGhi === 'dien_so' ? 'dien_so' : 'cham');
  const [viecDonVi, setViecDonVi] = useState(donViId ?? '');

  const ctx = (
    <>
      <input type="hidden" name="student_id" value={studentId} />
      <input type="hidden" name="thuoc_id" value={thuocId} />
    </>
  );

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
        <Popup title={t('sua')} onClose={() => setMo(false)} width="max-w-[440px]">
          <FormTaiCho action={suaViecTaiCho} className="flex flex-col gap-2.5" onOk={() => setMo(false)} anThanhCong>
            {(state) => (
              <>
                {ctx}
                <input type="hidden" name="viec_cach" value={viecCach} />
                <Field label={t('tenHoi')} htmlFor="sve-ten" error={state.fieldError === 'ten' ? state.error : null}>
                  <input id="sve-ten" name="ten" value={tenMoi} onChange={(e) => setTenMoi(e.target.value)} maxLength={160} placeholder={t('tenHoi')} className={ctlWithBorder(state.fieldError === 'ten')} autoFocus />
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

                <div className="flex flex-wrap items-end gap-2">
                  {viecCach === 'dien_so' && !coLuot && (
                    <Field label={t('chonDonVi')} htmlFor="sve-dv" error={state.fieldError === 'viec_don_vi' ? state.error : null}>
                      <select id="sve-dv" name="viec_don_vi" value={viecDonVi} onChange={(e) => setViecDonVi(e.target.value)} className={ctlWithBorder(state.fieldError === 'viec_don_vi')}>
                        <option value="">{t('chonDonVi')}</option>
                        {donViList.map((d) => (
                          <option key={d.id} value={d.id}>
                            {d.nhan ?? d.ma}
                          </option>
                        ))}
                      </select>
                    </Field>
                  )}
                  <Field label={t('dichLabel')} htmlFor="sve-dich" error={state.fieldError === 'chi_tieu_ky' ? state.error : null}>
                    <span className="inline-flex items-center gap-2">
                      <input id="sve-dich" type="number" name="chi_tieu_ky" value={dich} onChange={(e) => setDich(e.target.value)} step="any" min="0" className={`${ctlWithBorder(state.fieldError === 'chi_tieu_ky')} max-w-[120px]`} />
                      <span className="text-than font-semibold text-grey-mid">
                        {viecCach === 'cham' ? t('donViNgay') : viecDonVi ? (donViList.find((d) => d.id === viecDonVi)?.nhan ?? '') : (tenDonVi ?? '')}
                      </span>
                    </span>
                  </Field>
                </div>

                {/* NGÀY áp dụng — chip bật/tắt từng ngày (cùng bộ với thầy cô). */}
                <ChonNgayTuan daChon={ngayApDung} />

                <NutGui className="mt-1 self-start rounded-[12px] bg-navy px-4 text-than font-extrabold text-white transition-all hover:bg-navy/90 focus-visible:ring-2 focus-visible:ring-gold">
                  {t('luuSua')}
                </NutGui>
              </>
            )}
          </FormTaiCho>

          <div className="mt-3 flex justify-end border-t border-navy/[0.08] pt-3">
            <FormTaiCho action={xoaViecTaiCho} xacNhan={t('xoaHoi')} nhanXacNhan={t('xoa')} nguyHiem onOk={() => setMo(false)} anThanhCong className="flex flex-col items-end gap-1">
              {ctx}
              <NutGui className="inline-flex cursor-pointer items-center gap-1 rounded-[12px] px-3 text-than font-extrabold text-status-bad hover:bg-status-bad/[0.08] focus-visible:ring-2 focus-visible:ring-gold">
                <Trash2 size={14} strokeWidth={2.5} />
                {t('xoa')}
              </NutGui>
            </FormTaiCho>
          </div>
        </Popup>
      )}
    </>
  );
}

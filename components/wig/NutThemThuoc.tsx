'use client';

// Nút "+ Thước đo dẫn dắt" dưới mỗi cam kết (một cam kết nhiều thước — 0185). Bấm → hộp: tên +
// cách đo (Tick những ngày nào · Đo bằng số → đơn vị + đích/tuần). Dùng chung màn thầy cô
// (mode='toi') và màn em (mode='em'). 04/09: đi đường state — gửi rỗng thì lỗi hiện ngay dưới ô
// (trước đây im lặng), lưu xong popup tự đóng, ô giữ chữ khi lỗi.
import {useState} from 'react';
import {Ruler} from 'lucide-react';
import {useTranslations} from 'next-intl';
import {Popup} from '@/components/ui/Popup';
import {ChonNgayTuan} from '@/components/ui/ChonNgayTuan';
import {Field, ctlWithBorder} from '@/components/ui/Field';
import {FormTaiCho, NutGui} from '@/components/ui/FormTaiCho';
import {themThuocChoCamKetToi} from '@/app/[locale]/(dashboard)/wig/lop-actions';
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
  /** 'toi' = thước cá nhân của thầy cô; 'em' = thước của em. */
  mode: 'toi' | 'em';
  camKetId: string;
  classId: string;
  studentId?: string;
  weekQ?: string;
  monday: string;
  donViList?: {id: string; ma: string; nhan?: string}[];
}) {
  const t = useTranslations('camKet');
  const tf = useTranslations('formChung');
  const [mo, setMo] = useState(false);
  const [ten, setTen] = useState('');
  const [viecCach, setViecCach] = useState<'cham' | 'dien_so'>('cham');
  const [donVi, setDonVi] = useState('');
  const [donViMoi, setDonViMoi] = useState('');
  const [dich, setDich] = useState('');
  const action = mode === 'toi' ? themThuocChoCamKetToi : themThuocChoCamKet;

  const dong = () => {
    setMo(false);
    setTen('');
    setDich('');
    setDonVi('');
    setDonViMoi('');
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setMo(true)}
        className="inline-flex min-h-[44px] items-center gap-1.5 self-start rounded-[12px] border-[1.5px] border-dashed border-navy/30 px-3 text-than font-extrabold text-navy/80 transition-colors hover:border-navy hover:text-navy focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold"
      >
        <Ruler size={14} strokeWidth={2.5} />
        {t('themThuoc')}
      </button>
      {mo && (
        <Popup title={t('themThuoc')} onClose={dong} width="max-w-[460px]">
          <FormTaiCho action={action} className="flex flex-col gap-3" onOk={dong} anThanhCong>
            {(state) => (
              <>
                <input type="hidden" name="cam_ket_id" value={camKetId} />
                <input type="hidden" name="class_id" value={classId} />
                {mode === 'em' && <input type="hidden" name="student_id" value={studentId ?? ''} />}
                {mode === 'toi' && <input type="hidden" name="week" value={weekQ ?? ''} />}
                <input type="hidden" name="tuan_bat_dau" value={monday} />
                <input type="hidden" name="viec_cach" value={viecCach} />
                <Field label={t('viecBoTroLabel')} htmlFor="tt-ten" hint={t('viecBoTroHint')} error={state.fieldError === 'ten' ? state.error : null}>
                  <input
                    id="tt-ten"
                    name="ten"
                    value={ten}
                    onChange={(e) => setTen(e.target.value)}
                    maxLength={160}
                    placeholder={t('viecBoTroHoi')}
                    className={ctlWithBorder(state.fieldError === 'ten')}
                    autoFocus
                  />
                </Field>
                {/* CÁCH ĐO: tick những ngày đã chọn, hoặc đo bằng số (đơn vị + đích/tuần). */}
                <div>
                  <div className="mb-1.5 inline-flex rounded-[12px] border-[1.5px] border-navy/20 p-0.5 text-than font-extrabold">
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
                  {viecCach === 'cham' ? (
                    <Field label={t('chonNgayTick')} htmlFor="tt-ngay" hint={t('chonNgayHint')} error={state.fieldError === 'ngay' ? state.error : null}>
                      <ChonNgayTuan />
                    </Field>
                  ) : (
                    <div className="flex flex-wrap items-end gap-2">
                      <Field label={t('chonDonVi')} htmlFor="tt-vdv" error={state.fieldError === 'don_vi_moi' ? state.error : null}>
                        <select id="tt-vdv" name="viec_don_vi" value={donVi} onChange={(e) => setDonVi(e.target.value)} className={ctlWithBorder(false)}>
                          <option value="">{t('chonDonVi')}</option>
                          {donViList.map((d) => (
                            <option key={d.id} value={d.id}>
                              {d.nhan ?? d.ma}
                            </option>
                          ))}
                          <option value="__khac__">{t('donViKhac')}</option>
                        </select>
                      </Field>
                      {donVi === '__khac__' && (
                        <Field label={t('donViMoiHoi')} htmlFor="tt-dvmoi">
                          <input id="tt-dvmoi" name="don_vi_moi" value={donViMoi} onChange={(e) => setDonViMoi(e.target.value)} maxLength={60} placeholder={t('donViMoiHoi')} className={`${ctlWithBorder(false)} max-w-[160px]`} />
                        </Field>
                      )}
                      <Field label={t('viecDichHoi')} htmlFor="tt-vdich" error={state.fieldError === 'viec_dich' ? state.error : null}>
                        <input id="tt-vdich" type="number" name="viec_dich" value={dich} onChange={(e) => setDich(e.target.value)} step="any" min="0" placeholder={t('viecDichHoi')} className={`${ctlWithBorder(state.fieldError === 'viec_dich')} max-w-[120px]`} />
                      </Field>
                    </div>
                  )}
                </div>
                <NutGui className="mt-1 self-start rounded-[12px] bg-navy px-4 text-than font-extrabold text-white transition-all hover:bg-navy/90 focus-visible:ring-2 focus-visible:ring-gold">
                  {tf('luuThuoc')}
                </NutGui>
              </>
            )}
          </FormTaiCho>
        </Popup>
      )}
    </>
  );
}

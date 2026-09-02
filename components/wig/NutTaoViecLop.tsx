'use client';

// Nút "Thêm việc cho lớp" trên màn GVCN — việc chung cả lớp cùng làm mỗi ngày (thuoc chu_the='lop').
// Action luuViec (wig/actions) đã có sẵn; PA2 chỉ quên nối form vào trang. Đây là form gọn, đủ ô
// bắt buộc: tên · đơn vị · mỗi tuần đủ mấy · mỗi lần tính mấy · những thứ trong tuần.
import {useEffect, useState} from 'react';
import {useActionState} from 'react';
import {useRouter} from 'next/navigation';
import {useTranslations} from 'next-intl';
import {Plus} from 'lucide-react';
import {btnGold, Field, ctlWithBorder} from '@/components/ui/Field';
import {Popup} from '@/components/ui/Popup';
import {SubmitButton} from '@/components/ui/SubmitButton';
import {ChonCuon} from '@/components/ui/ChonCuon';
import {luuViec, type CreateWigState} from '@/app/[locale]/(dashboard)/wig/actions';
import type {DonViChon} from '@/components/student/FormMucTieu';

const THU = [
  {d: 1, nhan: 'T2'},
  {d: 2, nhan: 'T3'},
  {d: 3, nhan: 'T4'},
  {d: 4, nhan: 'T5'},
  {d: 5, nhan: 'T6'},
  {d: 6, nhan: 'T7'},
  {d: 7, nhan: 'CN'},
];

export function NutTaoViecLop({
  classId,
  donViList,
  mucTieuList = [],
}: {
  classId: string;
  donViList: DonViChon[];
  /** Mục tiêu lớp để việc "đẩy" (góp số) vào — nối là mục tiêu tự cộng từ lượt tick. */
  mucTieuList?: {id: string; ten: string}[];
}) {
  const t = useTranslations('lopMucTieu');
  const router = useRouter();
  const [mo, setMo] = useState(false);
  const [state, formAction] = useActionState<CreateWigState, FormData>(luuViec, {ok: false});
  const [ten, setTen] = useState('');
  const [donViId, setDonViId] = useState('');
  const [chiTieu, setChiTieu] = useState('');
  const [moiLan, setMoiLan] = useState('1');
  const [dayMt, setDayMt] = useState('');
  const err = (f: string) => (state.fieldError === f ? state.error : null);

  useEffect(() => {
    if (!state.ok) return;
    setMo(false);
    setTen('');
    setDonViId('');
    setChiTieu('');
    setMoiLan('1');
    setDayMt('');
    router.refresh();
  }, [state, router]);

  return (
    <>
      <button type="button" data-kiem="nut-tao-viec-lop" onClick={() => setMo(true)} className={btnGold}>
        <Plus size={15} strokeWidth={2.8} />
        {t('taoViecLop')}
      </button>
      {mo && (
        <Popup title={t('taoViecLop')} onClose={() => setMo(false)} width="max-w-[560px]">
          <form action={formAction} className="flex flex-col gap-3">
            <input type="hidden" name="class_id" value={classId} />
            <input type="hidden" name="cach_ghi" value="cham" />
            <input type="hidden" name="chieu_dich" value="it_nhat" />
            <input type="hidden" name="gop" value="tong" />
            <input type="hidden" name="ky_tuan" value="1" />
            <input type="hidden" name="pham_vi" value="tung_em" />
            <input type="hidden" name="don_vi_id" value={donViId} />
            <input type="hidden" name="moi_lan" value={moiLan} />
            <input type="hidden" name="day_muc_tieu" value={dayMt} />

            <Field label={t('viecTen')} htmlFor="vl-ten" error={err('ten')}>
              <input
                id="vl-ten"
                data-kiem="vl-ten"
                name="ten"
                value={ten}
                onChange={(e) => setTen(e.target.value)}
                maxLength={160}
                placeholder={t('viecTenPh')}
                className={ctlWithBorder(state.fieldError === 'ten')}
              />
            </Field>

            {mucTieuList.length > 0 && (
              <Field label={t('viecDayMt')} htmlFor="vl-day">
                <ChonCuon
                  id="vl-day"
                  name="_vl_day_ui"
                  value={dayMt}
                  onChange={setDayMt}
                  danhSach={mucTieuList.map((m) => ({ma: m.id, nhan: m.ten}))}
                  chuaChon={t('viecDayMtChon')}
                />
              </Field>
            )}

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <Field label={t('viecDonVi')} htmlFor="vl-dv" error={err('don_vi_id')}>
                <ChonCuon
                  id="vl-dv"
                  name="_vl_dv_ui"
                  value={donViId}
                  onChange={setDonViId}
                  danhSach={donViList.map((d) => ({ma: d.id, nhan: d.ma}))}
                  chuaChon={t('viecDonViChon')}
                  loi={state.fieldError === 'don_vi_id'}
                />
              </Field>
              <Field label={t('viecChiTieu')} htmlFor="vl-ct" error={err('chi_tieu_ky')}>
                <input
                  id="vl-ct"
                  data-kiem="vl-chi-tieu"
                  name="chi_tieu_ky"
                  type="number"
                  min="0"
                  step="any"
                  inputMode="decimal"
                  value={chiTieu}
                  onChange={(e) => setChiTieu(e.target.value)}
                  className={ctlWithBorder(state.fieldError === 'chi_tieu_ky')}
                />
              </Field>
              <Field label={t('viecMoiLan')} htmlFor="vl-ml" error={err('moi_lan')}>
                <input
                  id="vl-ml"
                  name="_vl_ml_ui"
                  type="number"
                  min="0"
                  step="any"
                  inputMode="decimal"
                  value={moiLan}
                  onChange={(e) => setMoiLan(e.target.value)}
                  className={ctlWithBorder(state.fieldError === 'moi_lan')}
                />
              </Field>
            </div>

            <div>
              <span className="mb-1.5 block text-[12px] font-bold text-grey-mid">{t('viecNgay')}</span>
              <div className="flex flex-wrap gap-1.5">
                {THU.map((x) => (
                  <label key={x.d} className="cursor-pointer">
                    <input type="checkbox" name="ngay_ap_dung" value={x.d} defaultChecked={x.d <= 5} className="peer sr-only" />
                    <span className="grid h-9 w-11 select-none place-items-center rounded-[10px] border-[1.5px] border-navy/15 bg-white text-[11.5px] font-extrabold text-grey-mid transition-all hover:border-navy peer-checked:border-transparent peer-checked:bg-gold peer-checked:text-navy">
                      {x.nhan}
                    </span>
                  </label>
                ))}
              </div>
            </div>

            {state.error && !state.fieldError && (
              <p className="rounded-[10px] bg-status-bad/[0.08] px-2.5 py-2 text-[12px] font-bold text-status-bad">{state.error}</p>
            )}

            <div className="flex items-center gap-3">
              <SubmitButton className="btn-gold rounded-[12px] px-4 py-2.5 text-[13px] font-extrabold" wrapClass="contents">
                <span data-kiem="vl-luu">{t('viecLuu')}</span>
              </SubmitButton>
              <button type="button" onClick={() => setMo(false)} className="text-[12px] font-extrabold text-grey-mid underline">
                {t('viecThoi')}
              </button>
            </div>
          </form>
        </Popup>
      )}
    </>
  );
}

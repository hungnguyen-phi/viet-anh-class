'use client';

// THÊM CAM KẾT TUẦN CỦA EM — lời hứa tuần của chính em, hướng vào MỤC TIÊU LỚP để cùng đẩy nó.
// Nút tròn (+) mở HỘP THOẠI để điền (giống form của cô), thay khung bung dài — màn của em mở mỗi
// ngày, không để một form trống nằm giữa trang. Khi lớp có ≥2 mục tiêu thì BẮT BUỘC chọn hướng tới
// mục tiêu nào; đúng một thì tự chọn sẵn.
import {useActionState, useEffect, useState} from 'react';
import {useTranslations} from 'next-intl';
import {Plus} from 'lucide-react';
import {luuCamKet, type CamKetState} from '@/app/[locale]/(dashboard)/student/actions';
import {Popup} from '@/components/ui/Popup';
import {SubmitButton} from '@/components/ui/SubmitButton';

const INIT: CamKetState = {ok: false};

export function ThemCamKetEm({
  studentId,
  classId,
  monday,
  mucTieuLop,
}: {
  studentId: string;
  classId: string;
  monday: string;
  mucTieuLop: {id: string; ten: string; don_vi_id: string | null; ten_don_vi: string | null}[];
}) {
  const t = useTranslations('camKet');
  const [state, formAction] = useActionState(luuCamKet, INIT);
  const [mo, setMo] = useState(false);
  const [noiDung, setNoiDung] = useState('');
  const [soHua, setSoHua] = useState('');
  const [mt, setMt] = useState(mucTieuLop.length === 1 ? mucTieuLop[0].id : '');
  const batBuoc = mucTieuLop.length >= 2;
  // Ràng buộc CSDL: có "hứa bao nhiêu" thì phải có đơn vị. Lấy đơn vị TỪ mục tiêu được chọn —
  // nên chỉ cho nhập số khi mục tiêu ấy có đơn vị (loại đo bằng số); còn lại chỉ hứa bằng lời.
  const mtChon = mucTieuLop.find((m) => m.id === mt);
  const donViId = mtChon?.don_vi_id ?? '';
  const donViNhan = mtChon?.ten_don_vi ?? '';

  // Lưu xong: ĐÓNG hộp + dọn ô; danh sách tự làm mới nhờ revalidatePath trong action.
  useEffect(() => {
    if (state.ok) {
      setMo(false);
      setNoiDung('');
      setSoHua('');
    }
  }, [state]);

  return (
    <>
      <button
        type="button"
        onClick={() => setMo(true)}
        aria-label={t('themCuaEm')}
        title={t('themCuaEm')}
        className="grid h-11 w-11 shrink-0 cursor-pointer place-items-center rounded-full bg-gold text-navy shadow-sm transition-transform hover:scale-105 active:scale-95"
      >
        <Plus size={16} strokeWidth={2.5} />
      </button>
      {mo && (
        <Popup title={t('themCuaEm')} onClose={() => setMo(false)} width="max-w-[460px]">
          <form action={formAction} className="flex flex-col gap-2.5">
            <input type="hidden" name="student_id" value={studentId} />
            <input type="hidden" name="class_id" value={classId} />
            <input type="hidden" name="tuan_bat_dau" value={monday} />
            <label htmlFor="ck-em-noi" className="text-nhan font-extrabold uppercase tracking-wide text-grey-mid">
              {t('noiDungEm')}
            </label>
            <input
              id="ck-em-noi"
              name="noi_dung"
              value={noiDung}
              onChange={(e) => setNoiDung(e.target.value)}
              maxLength={300}
              placeholder={t('noiDungPh')}
              aria-invalid={state.fieldError === 'noi_dung' ? true : undefined}
              aria-describedby={state.fieldError === 'noi_dung' ? 'ck-em-noi-loi' : undefined}
              className="ctl-h rounded-[8px] border-[1.5px] border-navy/20 px-2.5 text-base text-navy sm:text-than"
              autoFocus
            />
            {state.fieldError === 'noi_dung' && state.error && (
              <p id="ck-em-noi-loi" role="alert" className="text-chu-thich font-semibold text-status-bad">{state.error}</p>
            )}
            {/* Đơn vị lấy TỪ mục tiêu được chọn — có số phải có đơn vị (ck_don_vi_ck). */}
            <input type="hidden" name="don_vi_id" value={donViId ? donViId : ''} />
            <div className="flex flex-wrap items-center gap-2">
              {mucTieuLop.length > 0 && (
                <select
                  name="muc_tieu_id"
                  value={mt}
                  onChange={(e) => setMt(e.target.value)}
                  required={batBuoc}
                  className="min-w-0 flex-1 rounded-[8px] border-[1.5px] border-navy/20 px-2 py-1 text-than text-navy"
                >
                  <option value="">{batBuoc ? t('chonMucTieu') : t('giupKhongCo')}</option>
                  {mucTieuLop.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.ten}
                    </option>
                  ))}
                </select>
              )}
              {donViId ? (
                <span className="inline-flex items-center gap-1">
                  <input
                    type="number"
                    name="so_hua"
                    value={soHua}
                    onChange={(e) => setSoHua(e.target.value)}
                    step="any"
                    min="0"
                    placeholder={t('soHua')}
                    className="w-20 rounded-[8px] border-[1.5px] border-navy/20 px-2 py-1 text-than text-navy"
                  />
                  <span className="text-chu-thich font-semibold text-grey-mid">{donViNhan}</span>
                </span>
              ) : null}
            </div>
            {mucTieuLop.length > 0 && <p className="text-chu-thich italic text-grey-mid">{t('huongNhac')}</p>}
            {state.error && state.fieldError !== 'noi_dung' && (
              <p className="text-chu-thich font-semibold text-status-bad">{state.error}</p>
            )}
            <SubmitButton
              className="mt-1 min-h-[44px] self-start rounded-[12px] bg-navy px-4 text-than font-extrabold text-white transition-all hover:bg-navy/90"
              wrapClass="contents"
            >
              {t('luu')}
            </SubmitButton>
          </form>
        </Popup>
      )}
    </>
  );
}

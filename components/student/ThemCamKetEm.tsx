'use client';

// THÊM CAM KẾT TUẦN CỦA EM — lời hứa tuần của chính em, hướng vào MỤC TIÊU LỚP để cùng đẩy nó.
// (Trước đây action luuCamKet có nhưng KHÔNG nối UI nào — em không đặt được cam kết. Nay nối vào.)
// Khi lớp có ≥2 mục tiêu thì BẮT BUỘC chọn hướng tới mục tiêu nào; đúng một thì tự chọn sẵn.
import {useActionState, useEffect, useState} from 'react';
import {useTranslations} from 'next-intl';
import {luuCamKet, type CamKetState} from '@/app/[locale]/(dashboard)/student/actions';
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
  const [noiDung, setNoiDung] = useState('');
  const [viecBoTro, setViecBoTro] = useState('');
  const [soHua, setSoHua] = useState('');
  const [mt, setMt] = useState(mucTieuLop.length === 1 ? mucTieuLop[0].id : '');
  const batBuoc = mucTieuLop.length >= 2;
  // Ràng buộc CSDL: có "hứa bao nhiêu" thì phải có đơn vị. Lấy đơn vị TỪ mục tiêu được chọn —
  // nên chỉ cho nhập số khi mục tiêu ấy có đơn vị (loại đo bằng số); còn lại chỉ hứa bằng lời.
  const mtChon = mucTieuLop.find((m) => m.id === mt);
  const donViId = mtChon?.don_vi_id ?? '';
  const donViNhan = mtChon?.ten_don_vi ?? '';

  // Lưu xong thì dọn ô để hứa tiếp; danh sách tự làm mới nhờ revalidatePath trong action.
  useEffect(() => {
    if (state.ok) {
      setNoiDung('');
      setViecBoTro('');
      setSoHua('');
    }
  }, [state]);

  return (
    <details className="mt-3 rounded-[14px] border-[1.5px] border-dashed border-navy/25 p-3.5">
      <summary className="cursor-pointer text-[13px] font-extrabold text-navy">{t('themCuaEm')}</summary>
      <form action={formAction} className="mt-2.5 flex flex-col gap-2">
        <input type="hidden" name="student_id" value={studentId} />
        <input type="hidden" name="class_id" value={classId} />
        <input type="hidden" name="tuan_bat_dau" value={monday} />
        <input
          name="noi_dung"
          value={noiDung}
          onChange={(e) => setNoiDung(e.target.value)}
          maxLength={300}
          placeholder={t('noiDungEm')}
          className="rounded-[9px] border-[1.5px] border-navy/20 px-2.5 py-1.5 text-[13px] text-navy"
        />
        {state.fieldError === 'noi_dung' && state.error && (
          <p className="text-[11.5px] font-semibold text-status-bad">{state.error}</p>
        )}
        {/* VIỆC BỔ TRỢ — một việc em tick hằng ngày để hoàn thành cam kết này (chỉ khi mục tiêu có đơn vị). */}
        {donViId ? (
          <input
            name="viec_bo_tro"
            value={viecBoTro}
            onChange={(e) => setViecBoTro(e.target.value)}
            maxLength={100}
            placeholder={t('viecBoTroHoi')}
            className="rounded-[9px] border-[1.5px] border-navy/20 px-2.5 py-1.5 text-[12.5px] text-navy"
          />
        ) : null}
        {/* Đơn vị lấy TỪ mục tiêu được chọn — có số phải có đơn vị (ck_don_vi_ck). */}
        <input type="hidden" name="don_vi_id" value={donViId ? donViId : ''} />
        <div className="flex flex-wrap items-center gap-2">
          {mucTieuLop.length > 0 && (
            <select
              name="muc_tieu_id"
              value={mt}
              onChange={(e) => setMt(e.target.value)}
              required={batBuoc}
              className="min-w-0 flex-1 rounded-[9px] border-[1.5px] border-navy/20 px-2 py-1 text-[12.5px] text-navy"
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
                className="w-20 rounded-[9px] border-[1.5px] border-navy/20 px-2 py-1 text-[12.5px] text-navy"
              />
              <span className="text-[12px] font-semibold text-grey-mid">{donViNhan}</span>
            </span>
          ) : null}
          <SubmitButton
            className="rounded-[9px] bg-navy px-3 py-1.5 text-[12px] font-extrabold text-white transition-all hover:bg-navy/90"
            wrapClass="contents"
          >
            {t('luu')}
          </SubmitButton>
        </div>
        {mucTieuLop.length > 0 && (
          <p className="text-[11px] italic text-grey-mid">{t('huongNhac')}</p>
        )}
        {state.error && state.fieldError !== 'noi_dung' && (
          <p className="text-[11.5px] font-semibold text-status-bad">{state.error}</p>
        )}
        {state.ok && state.message && (
          <p className="text-[11.5px] font-semibold text-success-dark">{state.message}</p>
        )}
      </form>
    </details>
  );
}

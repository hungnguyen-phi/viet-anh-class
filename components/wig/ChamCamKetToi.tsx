'use client';

// CHẤM CAM KẾT CÁ NHÂN TẠI CHỖ — Thắng/Thua/Bỏ chấm là nút bé, không đáng chạy cả vòng
// redirect + flash (VPS rớt gói làm cú tải lại nguyên trang thành màn trắng vài giây).
// useActionState: bấm là lưu, trang đứng yên, lỗi hiện ngay cạnh nút.
// Ô số là CONTROLLED — React dọn trắng ô không kiểm soát sau mỗi lần gửi (vết cũ 31/08).
import {useActionState, useState} from 'react';
import {useTranslations} from 'next-intl';
import {Check, X} from 'lucide-react';
import {chamCamKetToiTaiCho, type ChamState} from '@/app/[locale]/(dashboard)/wig/lop-actions';

const INIT: ChamState = {ok: false};

export function ChamCamKetToi({
  camKetId,
  soHua,
  soDat,
  ketQua,
  tenDonVi,
}: {
  camKetId: string;
  soHua: number | null;
  soDat: number | null;
  ketQua: string | null;
  tenDonVi: string | null;
}) {
  const t = useTranslations('camKet');
  const [state, formAction, dangGui] = useActionState(chamCamKetToiTaiCho, INIT);
  const [so, datSo] = useState(soDat != null ? String(soDat) : '');

  return (
    <form action={formAction} className="flex flex-wrap items-center gap-1.5">
      <input type="hidden" name="cam_ket_id" value={camKetId} />
      {soHua != null && (
        <input
          type="number"
          name="so_dat"
          step="any"
          min="0"
          value={so}
          onChange={(e) => datSo(e.target.value)}
          placeholder={t('soDatHoi', {dv: tenDonVi ?? ''})}
          className="w-24 rounded-[7px] border-[1.5px] border-navy/20 px-2 py-1 text-[11.5px] text-navy"
        />
      )}
      <button
        type="submit"
        name="ket_qua"
        value="thang"
        disabled={dangGui}
        className="inline-flex cursor-pointer items-center gap-1 rounded-[7px] border-[1.5px] border-success/40 bg-success/[0.12] px-2 py-1 text-[11.5px] font-extrabold text-success-dark transition-all hover:bg-success/20 disabled:opacity-50"
      >
        <Check size={11} strokeWidth={3} />
        {t('thang')}
      </button>
      <button
        type="submit"
        name="ket_qua"
        value="thua"
        disabled={dangGui}
        className="inline-flex cursor-pointer items-center gap-1 rounded-[7px] border-[1.5px] border-status-bad/40 bg-status-bad/[0.08] px-2 py-1 text-[11.5px] font-extrabold text-status-bad transition-all hover:bg-status-bad/15 disabled:opacity-50"
      >
        <X size={11} strokeWidth={3} />
        {t('thua')}
      </button>
      {/* Đã chấm rồi → cho bỏ chấm (ket_qua rỗng = null): mở đường sửa/xoá lại. */}
      {ketQua && (
        <button
          type="submit"
          name="ket_qua"
          value=""
          disabled={dangGui}
          className="cursor-pointer rounded-[7px] px-2 py-1 text-[11.5px] font-extrabold text-grey-mid underline transition-colors hover:text-navy disabled:opacity-50"
        >
          {t('boCham')}
        </button>
      )}
      {state.error && <p className="w-full text-[11px] font-semibold text-status-bad">{state.error}</p>}
    </form>
  );
}

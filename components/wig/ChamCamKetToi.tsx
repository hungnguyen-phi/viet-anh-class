'use client';

// CHẤM CAM KẾT CÁ NHÂN TẠI CHỖ — Thắng/Thua/Bỏ chấm là nút bé, không đáng chạy cả vòng
// redirect + flash. useActionState: bấm là lưu, trang đứng yên, lỗi hiện ngay cạnh nút.
// Ô số CONTROLLED (React dọn trắng ô không kiểm soát sau mỗi lần gửi — vết 31/08).
// 04/09: nhãn hỏi số không xưng "em" với thầy cô; nhãn nằm TRÊN ô, ô rộng hơn; vùng chạm ≥ 44.
import {useActionState, useState} from 'react';
import {useTranslations} from 'next-intl';
import {Check, X} from 'lucide-react';
import {chamCamKetToiTaiCho} from '@/app/[locale]/(dashboard)/wig/lop-actions';
import {FORM_BAN_DAU} from '@/lib/form-state';

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
  const [state, formAction, dangGui] = useActionState(chamCamKetToiTaiCho, FORM_BAN_DAU);
  const [so, datSo] = useState(soDat != null ? String(soDat) : '');
  // Key trung tính do F3 thêm; chưa có thì lùi về câu cũ (không vỡ màn).
  const nhanSo = t.has('soDatHoiChung') ? t('soDatHoiChung', {dv: tenDonVi ?? ''}) : t('soDatHoi', {dv: tenDonVi ?? ''});

  return (
    <form action={formAction} className="flex flex-col gap-1.5">
      <input type="hidden" name="cam_ket_id" value={camKetId} />
      {soHua != null && (
        <label className="flex flex-col gap-1 text-nhan font-extrabold uppercase tracking-wide text-grey-mid">
          {nhanSo}
          <input
            type="number"
            name="so_dat"
            step="any"
            min="0"
            value={so}
            onChange={(e) => datSo(e.target.value)}
            inputMode="decimal"
            className="ctl-h w-full max-w-[200px] rounded-[12px] border-[1.5px] border-navy/20 bg-white px-3 text-base font-semibold text-navy focus-visible:border-navy focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold sm:text-sm"
          />
        </label>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="submit"
          name="ket_qua"
          value="thang"
          disabled={dangGui}
          className="inline-flex min-h-[44px] cursor-pointer items-center gap-1 rounded-[12px] border-[1.5px] border-success/40 bg-success/[0.12] px-3.5 text-than font-extrabold text-success-dark transition-all hover:bg-success/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold disabled:opacity-50"
        >
          <Check size={14} strokeWidth={2.5} />
          {t('thang')}
        </button>
        <button
          type="submit"
          name="ket_qua"
          value="thua"
          disabled={dangGui}
          className="inline-flex min-h-[44px] cursor-pointer items-center gap-1 rounded-[12px] border-[1.5px] border-status-bad/40 bg-status-bad/[0.08] px-3.5 text-than font-extrabold text-status-bad transition-all hover:bg-status-bad/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold disabled:opacity-50"
        >
          <X size={14} strokeWidth={2.5} />
          {t('thua')}
        </button>
        {/* Đã chấm rồi → cho bỏ chấm (ket_qua rỗng = null): mở đường sửa/xoá lại. */}
        {ketQua && (
          <button
            type="submit"
            name="ket_qua"
            value=""
            disabled={dangGui}
            className="min-h-[44px] cursor-pointer rounded-[12px] px-3 text-than font-extrabold text-grey-mid underline transition-colors hover:text-navy focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold disabled:opacity-50"
          >
            {t('boCham')}
          </button>
        )}
      </div>
      {state.error && <p role="alert" className="text-chu-thich font-bold text-status-bad">{state.error}</p>}
    </form>
  );
}

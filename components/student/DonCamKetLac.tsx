'use client';

// CAM KẾT LẠC (không gắn mục tiêu nào) — mô hình hiện tại mọi cam kết đều thuộc một mục tiêu, nên
// khu này CHỈ để dọn: gắn vào một mục tiêu đã duyệt, hoặc xoá. Không chấm, không tick ở đây
// (04/09: chủ dự án thấy cam kết cũ hiện nguyên bộ chấm bên dưới thẻ mục tiêu, khó hiểu).
import {useActionState, useEffect, useState} from 'react';
import {useTranslations} from 'next-intl';
import {Trash2} from 'lucide-react';
import {suaCamKetTaiCho, xoaCamKet} from '@/app/[locale]/(dashboard)/student/actions';
import {XacNhanForm} from '@/components/ui/PopupXacNhan';
import {FORM_BAN_DAU} from '@/lib/form-state';

export function DonCamKetLac({
  camKetId,
  noiDung,
  soHua,
  mucTieu,
  studentId,
}: {
  camKetId: string;
  noiDung: string;
  soHua: number | null;
  mucTieu: {id: string; title: string}[];
  studentId: string;
}) {
  const t = useTranslations('camKet');
  const [state, formAction, dangGui] = useActionState(suaCamKetTaiCho, FORM_BAN_DAU);
  const [mt, setMt] = useState(mucTieu.length === 1 ? mucTieu[0].id : '');
  const [an, setAn] = useState(false);
  useEffect(() => {
    if (state.ok) setAn(true); // gắn xong → thẻ lạc biến mất, cam kết hiện trong thẻ mục tiêu
  }, [state]);
  if (an) return null;

  return (
    <div className="flex flex-col gap-2 rounded-[12px] border-[1.5px] border-dashed border-navy/20 bg-white/70 p-3">
      <p className="text-[13.5px] font-extrabold text-navy">
        {noiDung}
        {soHua != null && <span className="ml-2 text-[11.5px] font-bold text-grey-mid">{t('soHua')} {soHua}</span>}
      </p>
      {mucTieu.length > 0 ? (
        <form action={formAction} className="flex flex-wrap items-center gap-2">
          <input type="hidden" name="cam_ket_id" value={camKetId} />
          <input type="hidden" name="noi_dung" value={noiDung} />
          {soHua != null && <input type="hidden" name="so_hua" value={soHua} />}
          <select
            name="muc_tieu_id"
            value={mt}
            onChange={(e) => setMt(e.target.value)}
            required
            aria-label={t('lacGanVao')}
            className="ctl-h min-w-0 flex-1 rounded-[10px] border-[1.5px] border-navy/20 bg-white px-2.5 text-base text-navy focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold sm:text-sm"
          >
            <option value="">{t('lacGanVao')}</option>
            {mucTieu.map((m) => (
              <option key={m.id} value={m.id}>
                {m.title}
              </option>
            ))}
          </select>
          <button
            type="submit"
            disabled={dangGui || !mt}
            className="min-h-[44px] cursor-pointer rounded-[10px] bg-navy px-4 text-[13px] font-extrabold text-white transition-colors hover:bg-navy/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold disabled:opacity-50"
          >
            {t('lacGanNut')}
          </button>
          <XacNhanForm action={xoaCamKet} hoi={t('xoaHoi')} nhanDongY={t('xoaCamKet')} nguyHiem className="contents">
            <input type="hidden" name="student_id" value={studentId} />
            <input type="hidden" name="cam_ket_id" value={camKetId} />
            <button
              type="submit"
              aria-label={t('xoaCamKet')}
              title={t('xoaCamKet')}
              className="grid h-11 w-11 cursor-pointer place-items-center rounded-[10px] text-status-bad transition-colors hover:bg-status-bad/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold"
            >
              <Trash2 size={16} strokeWidth={2.5} />
            </button>
          </XacNhanForm>
          {state.error && <p role="alert" className="w-full text-[12px] font-bold text-status-bad">{state.error}</p>}
        </form>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          <p className="min-w-0 flex-1 text-[12px] font-semibold text-grey-mid">{t('lacChuaCoMucTieu')}</p>
          <XacNhanForm action={xoaCamKet} hoi={t('xoaHoi')} nhanDongY={t('xoaCamKet')} nguyHiem className="contents">
            <input type="hidden" name="student_id" value={studentId} />
            <input type="hidden" name="cam_ket_id" value={camKetId} />
            <button
              type="submit"
              className="inline-flex min-h-[44px] cursor-pointer items-center gap-1 rounded-[10px] px-3 text-[12.5px] font-extrabold text-status-bad hover:bg-status-bad/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold"
            >
              <Trash2 size={14} strokeWidth={2.5} />
              {t('xoaCamKet')}
            </button>
          </XacNhanForm>
        </div>
      )}
    </div>
  );
}

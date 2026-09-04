'use client';

// Sửa CHỈ TIÊU một việc của lớp — đi qua thuoc_lich_su nên áp dụng TỪ TUẦN SAU (không đổi tuần
// đang chạy). PA2 có suaChiTieu nhưng quên nút. Nút submit dùng SubmitButton → có spinner khi gửi.
import {useActionState, useEffect, useRef} from 'react';
import {useTranslations} from 'next-intl';
import {AlertCircle} from 'lucide-react';
import {SubmitButton} from '@/components/ui/SubmitButton';
import {suaChiTieu} from '@/app/[locale]/(dashboard)/wig/actions';

type CreateWigState = {ok: boolean; error?: string; fieldError?: string};

export function SuaChiTieuLop({
  thuocId,
  chiTieuHienTai,
  donVi,
  classId,
  weekQ,
}: {
  thuocId: string;
  chiTieuHienTai: number | null;
  donVi: string;
  classId: string;
  weekQ: string;
}) {
  const t = useTranslations('lopMucTieu');
  const [state, action] = useActionState<CreateWigState, FormData>(suaChiTieu, {ok: false});
  const chiTiet = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    if (state.ok && chiTiet.current) chiTiet.current.open = false;
  }, [state]);

  return (
    <details ref={chiTiet} className="relative">
      <summary className="cursor-pointer list-none text-chu-thich font-bold text-grey-mid hover:text-navy">
        {t('suaChiTieu')}
      </summary>
      <form action={action} className="mt-1 flex flex-col gap-1">
        <input type="hidden" name="class_id" value={classId} />
        <input type="hidden" name="week" value={weekQ} />
        <input type="hidden" name="thuoc_id" value={thuocId} />
        <label className="flex items-center gap-1.5 text-chu-thich font-bold text-grey-mid">
          {t('suaChiTieuMoi', {dv: donVi})}
          <input
            type="number"
            name="chi_tieu_ky"
            min="0"
            step="any"
            defaultValue={chiTieuHienTai ?? undefined}
            className="w-24 rounded-[8px] border-[1.5px] border-navy/20 px-2 py-1 text-chu-thich text-navy"
          />
        </label>
        <p className="text-chu-thich font-semibold italic text-grey-mid">{t('suaChiTieuGhiChu')}</p>
        {state.error && (
          <span className="inline-flex items-center gap-1 text-chu-thich font-extrabold text-status-bad">
            <AlertCircle size={12} strokeWidth={2.5} />
            {state.error}
          </span>
        )}
        <SubmitButton
          className="self-start rounded-[8px] bg-navy px-2.5 py-1 text-chu-thich font-extrabold text-white"
          wrapClass="contents"
        >
          {t('suaChiTieuLuu')}
        </SubmitButton>
      </form>
    </details>
  );
}

'use client';

import {useTranslations} from 'next-intl';
import {ConfirmButton} from '@/components/ui/ConfirmButton';
import {xoaCamKetTuan, duyetCamKetCuaEmTraVe} from '@/app/[locale]/(dashboard)/student/actions';
import {NutDuyet} from '@/components/wig/NutDuyet';

// Nút xoá một cam kết tuần — của em (chưa chốt tuần) hoặc do cô dọn hộ. Việc và tick đi theo.
export function NutXoaCamKet({commitmentId, studentId}: {commitmentId: string; studentId: string}) {
  const t = useTranslations('goal');
  return (
    <form action={xoaCamKetTuan}>
      <input type="hidden" name="commitment_id" value={commitmentId} />
      <input type="hidden" name="student_id" value={studentId} />
      <ConfirmButton
        message={t('confirmDeleteCommitment')}
        label={t('deleteCommitment')}
        className="inline-flex min-h-[24px] cursor-pointer items-center px-1 text-[11.5px] font-extrabold text-status-bad underline"
      >
        {t('deleteCommitment')}
      </ConfirmButton>
    </form>
  );
}

// Nút DUYỆT cam kết của em — trên trang của em khi cô mở. Đây là động tác duy nhất của cô ở đó.
// Dùng chung NutDuyet: pending có spinner, xong đổi chip tại chỗ, không nhảy trang (24/08/2026).
export function NutDuyetCamKet({commitmentId, studentId}: {commitmentId: string; studentId: string}) {
  return <NutDuyet hanhDong={duyetCamKetCuaEmTraVe} o={{commitment_id: commitmentId, student_id: studentId}} />;
}

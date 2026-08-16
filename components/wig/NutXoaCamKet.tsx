'use client';

import {useTranslations} from 'next-intl';
import {ConfirmButton} from '@/components/ui/ConfirmButton';
import {xoaCamKetTuan} from '@/app/[locale]/(dashboard)/student/actions';

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

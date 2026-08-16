'use client';

import {useTranslations} from 'next-intl';
import {ConfirmButton} from '@/components/ui/ConfirmButton';
import {xoaCamKetTuan, duyetCamKetCuaEm} from '@/app/[locale]/(dashboard)/student/actions';

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
export function NutDuyetCamKet({commitmentId, studentId}: {commitmentId: string; studentId: string}) {
  const t = useTranslations('goal');
  return (
    <form action={duyetCamKetCuaEm}>
      <input type="hidden" name="commitment_id" value={commitmentId} />
      <input type="hidden" name="student_id" value={studentId} />
      <button
        type="submit"
        className="inline-flex shrink-0 cursor-pointer items-center gap-1 rounded-full border-[1.5px] border-gold-deep/40 bg-gold/[0.18] px-2.5 py-0.5 text-[10.5px] font-extrabold text-gold-text transition-all hover:bg-gold/30"
      >
        {t('approve')}
      </button>
    </form>
  );
}

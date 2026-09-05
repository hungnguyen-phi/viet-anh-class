'use client';

// MÀN EM — nghe mục tiêu của chính em đổi trạng thái (thầy cô duyệt / trả lại) → thẻ dựng lại
// ngay + một câu báo nhỏ. Bọc LamMoiKhiDoi để có toast; chuỗi ở namespace `notif`.
import {useState} from 'react';
import {useTranslations} from 'next-intl';
import {LamMoiKhiDoi} from '@/components/shell/LamMoiKhiDoi';
import {FlashToast} from '@/components/ui/FlashToast';

type MtTrangThai = {trang_thai?: string; cap?: string};

export function BaoDuyetRealtime({studentId}: {studentId: string}) {
  const t = useTranslations('notif');
  const [bao, setBao] = useState<string | null>(null);
  return (
    <>
      <LamMoiKhiDoi
        kenh={`em-${studentId}`}
        nguon={[{table: 'muc_tieu', filter: `student_id=eq.${studentId}`}]}
        onDoi={(_bang, kieu, moi) => {
          if (kieu !== 'UPDATE') return;
          const m = moi as MtTrangThai | undefined;
          if (m?.cap !== 'em') return;
          if (m.trang_thai === 'duyet') setBao(t('daDuyetEm'));
          else if (m.trang_thai === 'tra_lai') setBao(t('traLaiEm'));
        }}
      />
      {bao && <FlashToast message={bao} />}
    </>
  );
}

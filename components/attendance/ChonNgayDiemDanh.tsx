'use client';

import {useState, useTransition} from 'react';
import {Loader2} from 'lucide-react';
import {useRouter} from '@/i18n/navigation';
import {ONgayVN} from '@/components/ui/ONgayVN';
import {useTranslations} from 'next-intl';

// Ô CHỌN NGÀY RIÊNG — gõ đủ ngày/tháng/năm là đi, không có nút "Xem".
//
// Bản trước là <form method="get"> có nhãn "Ngày khác", <input type="date"> và nút Xem: ba thứ
// cho một việc. Và <input type="date"> hiện `08/16/2026` trên trình duyệt cài tiếng Anh — đúng
// cái chủ dự án vừa nhắc "ngày trước tháng sau". Dùng ONgayVN (ngày / tháng / năm) như mọi chỗ
// khác của dự án (lib/dob.ts, hạn mục tiêu). Chấm quay hiện lúc đang chờ trang mới.
export function ChonNgayDiemDanh({
  ngay,
  toiDa,
  classParam,
}: {
  ngay: string;
  toiDa: string;
  classParam?: string;
}) {
  const router = useRouter();
  const t = useTranslations('attendance');
  const [dangTai, batDau] = useTransition();
  const [gt, setGt] = useState(ngay);
  return (
    <span className="inline-flex items-center gap-2">
      <ONgayVN
        name="date"
        nhan={t('pickDate')}
        value={gt}
        max={toiDa}
        onChange={(iso) => {
          setGt(iso);
          // ONgayVN trả '' khi chưa đủ ba ô; đủ rồi mà là ngày chưa tới thì thôi.
          if (!iso || iso === ngay || iso > toiDa) return;
          batDau(() =>
            router.push({
              pathname: '/attendance',
              query: {...(classParam ? {class: classParam} : {}), date: iso},
            }),
          );
        }}
      />
      {dangTai && <Loader2 size={14} strokeWidth={2.5} className="animate-spin text-navy" />}
    </span>
  );
}

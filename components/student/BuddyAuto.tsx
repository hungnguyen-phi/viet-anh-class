'use client';

import {useEffect, useRef, useState} from 'react';
import {useTranslations} from 'next-intl';
import {useRouter} from '@/i18n/navigation';
import {Loader2, Info} from 'lucide-react';
import {refreshBuddyNote, type BuddyAskResult} from '@/app/[locale]/(dashboard)/student/actions';

// KHÔNG có nút: học sinh mở trang là ghi chú tự sinh (quyết định 2026-07-27).
// Server tự chặn: tối đa 1 lượt/ngày và chỉ gọi LLM khi có tick mới kể từ ghi chú trước —
// nên component này gọi thoải mái mà không tốn tiền, client không cần biết luật.
export function BuddyAuto({hasNote}: {hasNote: boolean}) {
  const t = useTranslations('student');
  const router = useRouter();
  // Chỉ chạy MỘT lần mỗi lần mount; React StrictMode gọi effect 2 lần lúc dev.
  const ran = useRef(false);
  const [working, setWorking] = useState(false);
  const [why, setWhy] = useState<string | null>(null);

  // Nói ra lý do khi không có ghi chú. Trước đây lỗi thì component render null → học sinh thấy
  // trống trơn và không hiểu vì sao (hay gặp nhất: GVCN chưa đặt WIG cho tuần này).
  // Dùng switch chứ không t(`key.${code}`) vì next-intl NÉM LỖI khi key không tồn tại.
  function reasonFor(code: BuddyAskResult['error']): string | null {
    switch (code) {
      case 'no_wig':
        return t('buddyErrNoWig');
      case 'no_class':
        return t('buddyErrNoClass');
      case 'no_key':
        return t('buddyErrNoKey');
      case 'forbidden':
        return null; // GVCN/PH đang xem — không phải lỗi, không cần nói gì.
      default:
        return t('buddyErrGeneric');
    }
  }

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;
    let alive = true;
    (async () => {
      // Chưa có ghi chú thì hiện trạng thái chờ; đã có rồi thì làm mới âm thầm, không nhá UI.
      if (!hasNote) setWorking(true);
      const res = await refreshBuddyNote();
      if (!alive) return;
      setWorking(false);
      // Chỉ refresh khi thực sự có nội dung mới — tránh vòng lặp render vô ích.
      if (res.ok && res.generated) {
        router.refresh();
        return;
      }
      // Đã có ghi chú cũ trên trang thì đừng làm ồn bằng thông báo lỗi.
      if (!res.ok && !hasNote) setWhy(reasonFor(res.error));
    })();
    return () => {
      alive = false;
    };
  }, [hasNote, router]);

  if (working) {
    return (
      <div className="inline-flex items-center gap-1.5 text-[12px] font-bold italic text-grey-mid">
        <Loader2 size={13} className="animate-spin" />
        {t('buddyAsking')}
      </div>
    );
  }
  if (why) {
    return (
      <p className="flex items-start gap-1.5 text-[12px] font-semibold italic text-grey-mid">
        <Info size={13} strokeWidth={2.5} className="mt-px shrink-0" />
        {why}
      </p>
    );
  }
  return null;
}

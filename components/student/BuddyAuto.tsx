'use client';

import {useEffect, useRef, useState} from 'react';
import {useTranslations} from 'next-intl';
import {useRouter} from '@/i18n/navigation';
import {Loader2} from 'lucide-react';
import {refreshBuddyNote} from '@/app/[locale]/(dashboard)/student/actions';

// KHÔNG có nút: học sinh mở trang là ghi chú tự sinh (quyết định 2026-07-27).
// Server tự chặn: tối đa 1 lượt/ngày và chỉ gọi LLM khi có tick mới kể từ ghi chú trước —
// nên component này gọi thoải mái mà không tốn tiền, client không cần biết luật.
export function BuddyAuto({hasNote}: {hasNote: boolean}) {
  const t = useTranslations('student');
  const router = useRouter();
  // Chỉ chạy MỘT lần mỗi lần mount; React StrictMode gọi effect 2 lần lúc dev.
  const ran = useRef(false);
  const [working, setWorking] = useState(false);

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
      if (res.ok && res.generated) router.refresh();
    })();
    return () => {
      alive = false;
    };
  }, [hasNote, router]);

  if (!working) return null;
  return (
    <div className="inline-flex items-center gap-1.5 text-[12px] font-bold italic text-grey-mid">
      <Loader2 size={13} className="animate-spin" />
      {t('buddyAsking')}
    </div>
  );
}

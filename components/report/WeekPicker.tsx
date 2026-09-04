'use client';

import {useRouter, usePathname} from '@/i18n/navigation';
import {useSearchParams} from 'next/navigation';

// Bộ chọn tuần cho báo cáo phụ huynh.
//
// TRƯỚC ĐÂY MỖI NÚT LÀ MỘT MÃ: "W31-2026". Nhãn tuần ISO đã bị gỡ khỏi thanh nav vì người thử
// nói thẳng là đoán ra nghĩa mà vẫn không biết dùng để làm gì — vậy mà nó vẫn nằm nguyên ở trang
// của PHỤ HUYNH, người xa thuật ngữ nhà trường nhất, và dãy nút ấy dài thêm mỗi tuần.
//
// Nay mỗi nút là một dải ngày ("28/07 – 03/08") kèm dấu "TUẦN NÀY" cho tuần đang chạy. Mã tuần
// vẫn nằm ở thuộc tính title — ai cần đối chiếu với giáo viên thì rê chuột là thấy.
//
// CHỈ BÀY 8 TUẦN GẦN NHẤT. Danh sách không giới hạn thì tới giữa năm học nó chiếm nửa màn hình
// điện thoại, mà không ai đọc báo cáo của tuần thứ hai mươi bằng cách bấm qua hai mươi cái nút.
const SO_TUAN_BAY = 8;

export type TuanChon = {label: string; start: string; end: string; laTuanNay: boolean};

export function WeekPicker({
  weeks,
  current,
  label,
  nowTag,
}: {
  weeks: TuanChon[];
  current: string;
  label: string;
  nowTag: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  if (weeks.length === 0) return null;

  // Tuần đang xem luôn có mặt, kể cả khi nó nằm ngoài 8 tuần đầu (ai đó dán link cũ).
  const bay = weeks.slice(0, SO_TUAN_BAY);
  if (!bay.some((w) => w.label === current)) {
    const them = weeks.find((w) => w.label === current);
    if (them) bay.push(them);
  }

  const goWeek = (w: string) => {
    const q = new URLSearchParams(searchParams.toString());
    q.set('week', w); // giữ ?child= và các tham số khác
    router.push(`${pathname}?${q.toString()}`);
  };

  const dm = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}`;

  return (
    <div className="flex flex-col items-end gap-2">
      <span className="text-nhan font-extrabold uppercase tracking-wide text-grey-mid">
        {label}
      </span>
      <div className="flex flex-wrap justify-end gap-1.5">
        {bay.map((w) => {
          const active = w.label === current;
          return (
            <button
              key={w.label}
              type="button"
              onClick={() => goWeek(w.label)}
              title={w.label}
              className={`inline-flex h-8 cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-[8px] px-3 text-xs font-extrabold text-navy transition-all ${
                active
                  ? 'btn-gold border border-transparent'
                  : 'border-[1.5px] border-navy/20 bg-white/60 hover:border-navy'
              }`}
            >
              {dm(w.start)} – {dm(w.end)}
              {w.laTuanNay && (
                <span
                  className={`rounded-full px-1.5 py-0.5 text-chu-thich font-extrabold tracking-wide ${
                    active ? 'bg-navy/15 text-navy' : 'bg-gold/25 text-gold-text'
                  }`}
                >
                  {nowTag}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

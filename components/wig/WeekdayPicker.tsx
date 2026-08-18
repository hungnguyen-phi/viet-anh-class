import {labelCls} from '@/components/ui/Field';

// Chọn NHỮNG THỨ mà một lead measure được tick (0073).
//
// Vì sao cần: trước đây bảng tick của học sinh luôn bày ra đủ 7 ngày, nên một việc chỉ làm ở lớp
// (nộp bài tập, đọc to trong tiết) vẫn hiện ô T7/CN — em không biết có phải tick hay không, còn
// mẫu số của mục tiêu tuần thì tính theo 7 ngày trong khi lớp chỉ học 5. Chủ dự án chốt 2026-08-02:
// không làm bảng ngày-nghỉ toàn trường, giáo viên tự chọn thứ ngay khi đặt việc là đủ.
//
// Không cần JavaScript: checkbox thật + `peer-checked` của CSS. Form ở trang /wig là server action
// nên giữ được như vậy thì không phải nạp thêm bundle client nào.
const DOW = [1, 2, 3, 4, 5, 6, 7] as const;

export function WeekdayPicker({
  label,
  hint,
  dayLabels,
  selected,
  className = '',
}: {
  label: string;
  hint?: string;
  // 7 nhãn thứ, bắt đầu từ Thứ Hai — người gọi truyền từ i18n.
  dayLabels: string[];
  // Các thứ đang chọn (ISO 1..7). Mặc định T2–T6 cho việc mới.
  selected?: number[];
  className?: string;
}) {
  const on = new Set(selected ?? [1, 2, 3, 4, 5]);
  return (
    <div className={`min-w-0 ${className}`}>
      <span className={labelCls}>{label}</span>
      <div className="flex flex-wrap gap-1.5">
        {DOW.map((d, i) => (
          <label key={d} className="cursor-pointer">
            <input
              type="checkbox"
              name="weekdays"
              value={d}
              defaultChecked={on.has(d)}
              className="peer sr-only"
            />
            <span className="grid h-9 w-11 select-none place-items-center rounded-[10px] border-[1.5px] border-navy/15 bg-white text-[11.5px] font-extrabold text-grey-mid transition-all hover:border-navy peer-checked:border-transparent peer-checked:bg-gold peer-checked:text-navy peer-focus-visible:ring-2 peer-focus-visible:ring-navy/40">
              {dayLabels[i]}
            </span>
          </label>
        ))}
      </div>
      {hint && <p className="mt-1 text-[11px] font-semibold text-grey-mid">{hint}</p>}
    </div>
  );
}

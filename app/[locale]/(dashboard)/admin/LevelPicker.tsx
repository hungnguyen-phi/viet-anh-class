'use client';

import {useTranslations} from 'next-intl';
import {SCHOOL_LEVELS, gradeNumbersFor, type SchoolLevel} from '@/lib/levels';

// CHỌN NHIỀU CẤP HỌC cho một cơ sở.
//
// Trước đây là một <select> một-giá-trị, và nó nói sai về thực tế: Việt Anh Gò Vấp dạy cả THCS lẫn
// THPT nhưng nhãn chỉ ghi được "THPT", trong khi cơ sở đang có Khối 6→12. Trường liên cấp là
// chuyện bình thường, nên chỗ khai báo phải cho khai đúng.
//
// Dùng ô tick chứ không phải <select multiple>: <select multiple> trên điện thoại là một hộp cuộn
// nhỏ xíu, và trên máy tính thì phải giữ Ctrl mới chọn được nhiều — không ai đoán ra.
//
// Mọi ô đều mang name="level" để phía server đọc bằng formData.getAll('level').
export function LevelPicker({
  value,
  onChange,
  invalid,
}: {
  value: SchoolLevel[];
  onChange: (levels: SchoolLevel[]) => void;
  invalid?: boolean;
}) {
  const t = useTranslations('admin');
  const nums = gradeNumbersFor(value);

  const toggle = (lv: SchoolLevel) =>
    onChange(value.includes(lv) ? value.filter((x) => x !== lv) : [...value, lv]);

  return (
    <div className="w-full">
      {/* role="group" KHÔNG nhận aria-invalid (chỉ widget mới nhận). Báo lỗi bằng viền đỏ cho mắt
          và bằng aria-describedby trỏ tới một câu thật cho trình đọc màn hình — đặt aria-invalid ở
          đây thì trình đọc bỏ qua, tức là người khiếm thị không hề biết ô này đang sai. */}
      <div
        role="group"
        aria-label={t('level')}
        aria-describedby={invalid ? 'level-loi' : undefined}
        className={`flex flex-wrap gap-1.5 rounded-[12px] border-[1.5px] p-1.5 transition-all ${
          invalid ? 'border-status-bad' : 'border-navy/15'
        }`}
      >
        {SCHOOL_LEVELS.map((lv) => {
          const on = value.includes(lv);
          return (
            <label
              key={lv}
              className={`inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-[8px] px-2.5 text-than font-extrabold transition-all ${
                on ? 'bg-navy text-white' : 'bg-white text-navy hover:bg-navy/[0.06]'
              }`}
            >
              <input
                type="checkbox"
                name="level"
                value={lv}
                checked={on}
                onChange={() => toggle(lv)}
                className="h-3.5 w-3.5 cursor-pointer accent-[var(--color-gold)]"
              />
              {t(`level_${lv}`)}
            </label>
          );
        })}
      </div>

      {invalid && (
        <p id="level-loi" className="mt-1.5 text-chu-thich font-bold text-status-bad">
          {t('pickLevelFirst')}
        </p>
      )}

      {/* Cho thấy TRƯỚC sẽ sinh ra khối nào — bớt cảm giác "chọn xong không biết chuyện gì xảy ra".
          Chọn nhiều cấp thì đây là hợp của các dải, đúng thứ hàm sinh khối dưới CSDL sẽ làm. */}
      {value.length > 0 && (
        <p className="mt-1.5 text-chu-thich font-semibold text-grey-mid">
          {nums
            ? `${t('willSeed')}: ${nums.map((n) => `Khối ${n}`).join(' · ')}`
            : t('manualGradeHint')}
        </p>
      )}
    </div>
  );
}

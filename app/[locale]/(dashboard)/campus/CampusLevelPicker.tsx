'use client';

import {useTranslations} from 'next-intl';
import {SCHOOL_LEVELS, GRADE_NUMBERS, type SchoolLevel} from '@/lib/levels';
import {SubmitButton} from '@/components/ui/SubmitButton';
import {setCampusLevel} from './actions';

const inp =
  'min-w-0 rounded-[9px] border-[1.5px] border-navy/15 bg-white px-2.5 py-1.5 text-[13px] font-semibold text-navy outline-none transition-all focus:border-navy';
const navyBtn =
  'h-8 shrink-0 cursor-pointer whitespace-nowrap rounded-[9px] bg-navy px-2.5 text-[11.5px] font-extrabold text-white transition-all hover:bg-navy-700';

// Khai cấp học cho cơ sở → DB sinh luôn bộ khối chuẩn.
//
// Đặt ở đây (chứ không chỉ ở /admin) vì Hiệu trưởng mới là người quản lý khối/lớp của cơ sở;
// bắt họ chờ admin khai cấp học thì màn "Quản lý Khối" của họ là ngõ cụt.
export function CampusLevelPicker({level}: {level: SchoolLevel | null}) {
  const t = useTranslations('admin');
  const nums = level ? GRADE_NUMBERS[level] : null;

  return (
    <form action={setCampusLevel} className="flex flex-wrap items-center gap-1.5">
      <span className="text-[10px] font-extrabold uppercase tracking-wide text-grey-mid">
        {t('level')}
      </span>
      <select name="level" aria-label={t('level')} defaultValue={level ?? ''} className={`${inp} w-44 cursor-pointer`} required>
        <option value="" disabled>
          {t('level')}
        </option>
        {SCHOOL_LEVELS.map((lv) => (
          <option key={lv} value={lv}>
            {t(`level_${lv}`)}
          </option>
        ))}
      </select>
      <SubmitButton className={navyBtn} wrapClass="contents">
        {t('save')}
      </SubmitButton>
      <p className="w-full text-[11px] italic text-grey-mid">
        {level && nums
          ? `${t('gradesAuto')}: ${nums.map((n) => `Khối ${n}`).join(' · ')}`
          : level
            ? t('manualGradeHint')
            : t('pickLevelFirst')}
      </p>
    </form>
  );
}

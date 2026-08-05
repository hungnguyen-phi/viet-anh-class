'use client';

import {useState} from 'react';
import {useTranslations} from 'next-intl';
import {type SchoolLevel} from '@/lib/levels';
import {SubmitButton} from '@/components/ui/SubmitButton';
import {LevelPicker} from '../admin/LevelPicker';
import {setCampusLevel} from './actions';

const navyBtn =
  'inline-flex h-8 shrink-0 cursor-pointer items-center justify-center whitespace-nowrap rounded-[9px] bg-navy px-2.5 text-[11.5px] font-extrabold text-white transition-all hover:bg-navy-700';

// Khai cấp học cho cơ sở → DB sinh luôn bộ khối chuẩn.
//
// Đặt ở đây (chứ không chỉ ở /admin) vì Hiệu trưởng mới là người quản lý khối/lớp của cơ sở; bắt
// họ chờ admin khai cấp học thì màn "Quản lý Khối" của họ là ngõ cụt.
//
// Chọn được NHIỀU cấp: trường liên cấp là chuyện bình thường, và cơ sở dạy cả THCS lẫn THPT thì
// phải khai được đúng như thế thay vì phải chọn một cái rồi chịu nhãn sai.
export function CampusLevelPicker({levels}: {levels: SchoolLevel[]}) {
  const t = useTranslations('admin');
  const [chon, setChon] = useState<SchoolLevel[]>(levels);

  return (
    <form action={setCampusLevel} className="flex flex-wrap items-end gap-2">
      <div className="min-w-[260px] flex-1">
        <span className="mb-1 block text-[10px] font-extrabold uppercase tracking-wide text-grey-mid">
          {t('level')}
        </span>
        <LevelPicker value={chon} onChange={setChon} />
      </div>
      <SubmitButton className={navyBtn} wrapClass="contents">
        {t('save')}
      </SubmitButton>
      {chon.length === 0 && (
        <p className="w-full text-[11px] italic text-grey-mid">{t('pickLevelFirst')}</p>
      )}
    </form>
  );
}

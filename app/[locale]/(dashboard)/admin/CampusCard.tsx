'use client';

import {useState} from 'react';
import {useTranslations} from 'next-intl';
import {ConfirmButton} from '@/components/ui/ConfirmButton';
import {SubmitButton} from '@/components/ui/SubmitButton';
import {SCHOOL_LEVELS, GRADE_NUMBERS, type SchoolLevel} from '@/lib/levels';
import {updateCampus, setCampusActive, deleteCampus} from './actions';
import {GradeManager} from './GradeManager';

type Grade = {id: string; name: string; sort_order: number};

const inp =
  'min-w-0 rounded-[9px] border-[1.5px] border-navy/15 bg-white px-2.5 py-1.5 text-[13px] font-semibold text-navy outline-none transition-all focus:border-navy';
const navyBtn =
  'h-8 shrink-0 cursor-pointer whitespace-nowrap rounded-[9px] bg-navy px-2.5 text-[11.5px] font-extrabold text-white transition-all hover:bg-navy-700';
const ghost =
  'h-8 shrink-0 cursor-pointer whitespace-nowrap rounded-[9px] border-[1.5px] border-navy/20 bg-white px-2.5 text-[11.5px] font-extrabold text-navy transition-all hover:border-navy';
const danger =
  'h-8 shrink-0 cursor-pointer whitespace-nowrap rounded-[9px] bg-[rgba(192,57,43,0.12)] px-2.5 text-[11.5px] font-extrabold text-status-bad transition-all hover:bg-[rgba(192,57,43,0.22)]';

// 1 thẻ Cơ sở: sửa tên/mã/cấp học (toggle) · lưu-trữ · xoá (khi rỗng) + quản lý Khối bên trong.
export function CampusCard({
  campus,
  grades,
  classCount,
}: {
  campus: {id: string; name: string; code: string; level: SchoolLevel | null};
  grades: Grade[];
  classCount: number;
}) {
  const t = useTranslations('admin');
  const [edit, setEdit] = useState(false);

  return (
    <div className="rounded-[14px] border-[1.5px] border-navy/10 bg-white/50 p-3">
      {edit ? (
        <form action={updateCampus} className="flex flex-wrap items-center gap-1.5">
          <input type="hidden" name="id" value={campus.id} />
          <input name="name" defaultValue={campus.name} className={`${inp} flex-1`} required />
          <input name="code" defaultValue={campus.code} className={`${inp} w-24`} required />
          {/* Đổi cấp học sẽ SINH THÊM khối chuẩn của cấp mới (trigger campus_seed_grades).
              Khối cũ không bị xoá — lớp đang trỏ vào chúng vẫn nguyên. */}
          <select
            name="level"
            defaultValue={campus.level ?? ''}
            className={`${inp} w-40 cursor-pointer`}
            title={t('levelHint')}
          >
            <option value="">— {t('level')} —</option>
            {SCHOOL_LEVELS.map((lv) => (
              <option key={lv} value={lv}>
                {t(`level_${lv}`)}
              </option>
            ))}
          </select>
          <SubmitButton className={navyBtn} wrapClass="contents">
            {t('save')}
          </SubmitButton>
          <button type="button" onClick={() => setEdit(false)} className={ghost}>
            {t('cancel')}
          </button>
        </form>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-display text-[15px] font-bold text-navy">{campus.name}</span>
          <span className="rounded-full bg-navy/[0.06] px-2 py-0.5 text-[11px] font-bold text-grey-mid">
            {campus.code}
          </span>
          {campus.level ? (
            <span className="rounded-full bg-gold/[0.18] px-2 py-0.5 text-[11px] font-bold text-navy">
              {t(`level_${campus.level}`)}
              {GRADE_NUMBERS[campus.level] && ` · ${t('grades')} ${GRADE_NUMBERS[campus.level]!.join(', ')}`}
            </span>
          ) : (
            // Chưa khai cấp học thì chưa sinh được khối nào → nói thẳng việc cần làm.
            <span className="rounded-full bg-status-bad/[0.10] px-2 py-0.5 text-[11px] font-bold text-status-bad">
              {t('noLevel')}
            </span>
          )}
          <span className="text-[11px] font-semibold text-grey-mid">
            · {classCount} {t('classesShort')}
          </span>
          <span className="ml-auto flex flex-wrap gap-1.5">
            <button type="button" onClick={() => setEdit(true)} className={ghost}>
              {t('edit')}
            </button>
            <form action={setCampusActive}>
              <input type="hidden" name="id" value={campus.id} />
              <input type="hidden" name="active" value="false" />
              <SubmitButton className={ghost} wrapClass="contents">
                {t('archive')}
              </SubmitButton>
            </form>
            <form action={deleteCampus}>
              <input type="hidden" name="id" value={campus.id} />
              <ConfirmButton message={t('confirmDeleteCampus')} className={danger}>
                {t('delete')}
              </ConfirmButton>
            </form>
          </span>
        </div>
      )}

      <GradeManager campusId={campus.id} grades={grades} level={campus.level} />
    </div>
  );
}

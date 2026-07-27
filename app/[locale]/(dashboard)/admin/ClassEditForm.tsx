'use client';

import {useMemo, useState} from 'react';
import {useTranslations} from 'next-intl';
import {updateClass} from './actions';

type ClassRow = {
  id: string;
  name: string;
  grade_id: string | null;
  school_year: string;
  campus_id: string;
  homeroom_teacher_id: string | null;
};
type Campus = {id: string; name: string};
type Grade = {id: string; name: string; campus_id: string; is_active: boolean};
type Teacher = {id: string; full_name: string | null; email: string};

const inp =
  'min-w-0 rounded-[10px] border-[1.5px] border-navy/15 bg-white px-3 py-2 text-[13px] font-semibold text-navy outline-none transition-all focus:border-navy';
const navyBtn =
  'btn-gold h-11 shrink-0 inline-flex items-center cursor-pointer whitespace-nowrap rounded-[12px] px-3.5 text-[12.5px] font-extrabold transition-all';
const lbl = 'flex flex-col gap-1 text-[10px] font-extrabold uppercase tracking-wide text-grey-mid';

// Sửa lớp (dạng card đầy đủ) — Cơ sở ↔ Khối liên kết. Dùng ở trang chi tiết lớp.
export function ClassEditForm({
  row,
  campuses,
  grades,
  teachers,
}: {
  row: ClassRow;
  campuses: Campus[];
  grades: Grade[];
  teachers: Teacher[];
}) {
  const t = useTranslations('admin');
  const [campusId, setCampusId] = useState(row.campus_id);
  const [gradeId, setGradeId] = useState(row.grade_id ?? '');
  // Giữ khối đang gắn kể cả khi đã lưu-trữ → không âm thầm mất khối khi lưu (audit #3).
  const gradeOptions = useMemo(
    () => grades.filter((g) => g.campus_id === campusId && (g.is_active || g.id === row.grade_id)),
    [grades, campusId, row.grade_id],
  );

  return (
    <form
      action={updateClass}
      className="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(180px,1fr))]"
    >
      <input type="hidden" name="id" value={row.id} />
      <label className={lbl}>
        {t('name')}
        <input name="name"
                aria-label={t('name')} defaultValue={row.name} className={inp} required />
      </label>
      <label className={lbl}>
        {t('schoolYear')}
        <input name="school_year"
                aria-label={t('schoolYear')} defaultValue={row.school_year} className={inp} required />
      </label>
      <label className={lbl}>
        {t('campus')}
        <select
          name="campus_id"
                aria-label={t('campus')}
          value={campusId}
          onChange={(e) => {
            setCampusId(e.target.value);
            setGradeId('');
          }}
          className={`cursor-pointer ${inp}`}
        >
          {campuses.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </label>
      <label className={lbl}>
        {t('grade')}
        <select
          name="grade_id"
                aria-label={t('grade')}
          value={gradeId}
          onChange={(e) => setGradeId(e.target.value)}
          className={`cursor-pointer ${inp}`}
        >
          <option value="">— {t('none')} —</option>
          {gradeOptions.map((g) => (
            <option key={g.id} value={g.id}>
              {g.name}
              {g.is_active ? '' : ` (${t('archived')})`}
            </option>
          ))}
        </select>
      </label>
      <label className={lbl}>
        {t('gvcn')}
        <select
          name="homeroom_teacher_id"
                aria-label={t('gvcn')}
          defaultValue={row.homeroom_teacher_id ?? ''}
          className={`cursor-pointer ${inp}`}
        >
          <option value="">— {t('none')} —</option>
          {teachers.map((p) => (
            <option key={p.id} value={p.id}>
              {p.full_name ?? p.email}
            </option>
          ))}
        </select>
      </label>
      <div className="flex items-end">
        <button type="submit" className={navyBtn}>
          {t('save')}
        </button>
      </div>
    </form>
  );
}

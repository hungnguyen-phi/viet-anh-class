'use client';

import {useMemo, useState} from 'react';
import {useTranslations} from 'next-intl';
import {Link} from '@/i18n/navigation';
import {ConfirmButton} from '@/components/ui/ConfirmButton';
import {updateClass, setClassActive, deleteClass} from './actions';
import {SubmitButton} from '@/components/ui/SubmitButton';

type ClassRow = {
  id: string;
  name: string;
  grade_id: string | null;
  grade: string | null;
  school_year: string;
  campus_id: string;
  homeroom_teacher_id: string | null;
};
type Campus = {id: string; name: string};
type Grade = {id: string; name: string; campus_id: string; is_active: boolean};
type Teacher = {id: string; full_name: string | null; email: string};

const inp =
  'min-w-0 rounded-[9px] border-[1.5px] border-navy/15 bg-white px-2.5 py-1.5 text-[13px] font-semibold text-navy outline-none transition-all focus:border-navy';
const navyBtn =
  'h-8 shrink-0 cursor-pointer whitespace-nowrap rounded-[9px] bg-navy px-2.5 text-[11.5px] font-extrabold text-white transition-all hover:bg-navy-700';
const ghost =
  'h-8 shrink-0 cursor-pointer whitespace-nowrap rounded-[9px] border-[1.5px] border-navy/20 bg-white px-2.5 text-[11.5px] font-extrabold text-navy transition-all hover:border-navy';
const gold =
  'btn-gold h-8 shrink-0 inline-flex items-center cursor-pointer whitespace-nowrap rounded-[9px] px-2.5 text-[11.5px] font-extrabold transition-all';
const danger =
  'h-8 shrink-0 cursor-pointer whitespace-nowrap rounded-[9px] bg-[rgba(192,57,43,0.12)] px-2.5 text-[11.5px] font-extrabold text-status-bad transition-all hover:bg-[rgba(192,57,43,0.22)]';
const th = 'text-[11px] font-extrabold uppercase tracking-wide text-grey-mid';

export function ClassManager({
  classes,
  campuses,
  grades,
  teachers,
}: {
  classes: ClassRow[];
  campuses: Campus[];
  grades: Grade[];
  teachers: Teacher[];
}) {
  const t = useTranslations('admin');
  const [campusFilter, setCampusFilter] = useState('');
  const [editId, setEditId] = useState<string | null>(null);

  const campusName = useMemo(() => new Map(campuses.map((c) => [c.id, c.name])), [campuses]);
  const teacherName = useMemo(
    () => new Map(teachers.map((p) => [p.id, p.full_name ?? p.email])),
    [teachers],
  );

  const shown = campusFilter ? classes.filter((c) => c.campus_id === campusFilter) : classes;

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="font-display text-[15px] font-bold text-navy">
          {t('classes')} ({classes.length})
        </div>
        <select
          aria-label={t('campus')}
          value={campusFilter}
          onChange={(e) => setCampusFilter(e.target.value)}
          className={`cursor-pointer ${inp}`}
        >
          <option value="">{t('allCampuses')}</option>
          {campuses.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>

      <div className="overflow-x-auto rounded-[14px] border-[1.5px] border-navy/10">
        <div className="box-border flex min-w-[720px] items-center gap-2 bg-navy/[0.03] px-[14px] py-[9px]">
          <span className={`flex-1 ${th}`}>{t('name')}</span>
          <span className={`w-[90px] flex-none ${th}`}>{t('grade')}</span>
          <span className={`w-[90px] flex-none ${th}`}>{t('schoolYear')}</span>
          <span className={`flex-1 ${th}`}>{t('gvcn')}</span>
          <span className={`w-[240px] flex-none ${th}`}>{t('actions')}</span>
        </div>

        {shown.map((c) => (
          <div key={c.id} className="border-t border-navy/[0.08]">
            <div className="box-border flex min-w-[720px] items-center gap-2 px-[14px] py-2 transition-colors hover:bg-navy/[0.03]">
              <span className="min-w-0 flex-1 truncate text-[13px] font-bold text-navy">{c.name}</span>
              <span className="w-[90px] flex-none truncate text-[12px] font-semibold text-grey-mid">
                {c.grade ?? '—'}
              </span>
              <span className="w-[90px] flex-none text-[12px] font-semibold text-grey-mid">
                {c.school_year}
              </span>
              <span className="min-w-0 flex-1 truncate text-[12px] font-semibold text-grey-mid">
                {c.homeroom_teacher_id ? teacherName.get(c.homeroom_teacher_id) ?? '—' : t('none')}
              </span>
              <span className="flex w-[240px] flex-none gap-1.5">
                <Link href={`/admin/class/${c.id}`} className={gold}>
                  {t('detail')}
                </Link>
                <button
                  type="button"
                  onClick={() => setEditId(editId === c.id ? null : c.id)}
                  className={ghost}
                >
                  {t('edit')}
                </button>
                <form action={setClassActive}>
                  <input type="hidden" name="id" value={c.id} />
                  <input type="hidden" name="active" value="false" />
                  <SubmitButton className={ghost}>
                    {t('archive')}
                  </SubmitButton>
                </form>
                <form action={deleteClass}>
                  <input type="hidden" name="id" value={c.id} />
                  <ConfirmButton message={t('confirmDeleteClass')} label={t('deleteClass')} className={danger}>
                    ✕
                  </ConfirmButton>
                </form>
              </span>
            </div>

            {editId === c.id && (
              <ClassEditRow
                row={c}
                campuses={campuses}
                grades={grades}
                teachers={teachers}
                onDone={() => setEditId(null)}
              />
            )}
          </div>
        ))}

        {shown.length === 0 && (
          <div className="border-t border-navy/[0.08] px-[14px] py-3 text-[13px] text-grey-mid">
            {t('none')}
          </div>
        )}
      </div>
    </div>
  );
}

// Form sửa 1 lớp — select Cơ sở ↔ Khối liên kết (đổi cơ sở thì reset khối).
function ClassEditRow({
  row,
  campuses,
  grades,
  teachers,
  onDone,
}: {
  row: ClassRow;
  campuses: Campus[];
  grades: Grade[];
  teachers: Teacher[];
  onDone: () => void;
}) {
  const t = useTranslations('admin');
  const [campusId, setCampusId] = useState(row.campus_id);
  const [gradeId, setGradeId] = useState(row.grade_id ?? '');
  // Giữ khối đang gắn của lớp trong danh sách kể cả khi đã lưu-trữ → tránh lưu mất khối (audit #3).
  const gradeOptions = useMemo(
    () => grades.filter((g) => g.campus_id === campusId && (g.is_active || g.id === row.grade_id)),
    [grades, campusId, row.grade_id],
  );

  return (
    <form
      action={updateClass}
      className="box-border grid min-w-[720px] gap-2 border-t border-dashed border-navy/15 bg-navy/[0.02] px-[14px] py-3 [grid-template-columns:repeat(auto-fit,minmax(150px,1fr))]"
    >
      <input type="hidden" name="id" value={row.id} />
      <label className="flex flex-col gap-1 text-[10px] font-extrabold uppercase tracking-wide text-grey-mid">
        {t('name')}
        <input name="name"
                aria-label={t('name')} defaultValue={row.name} className={inp} required />
      </label>
      <label className="flex flex-col gap-1 text-[10px] font-extrabold uppercase tracking-wide text-grey-mid">
        {t('schoolYear')}
        <input name="school_year"
                aria-label={t('schoolYear')} defaultValue={row.school_year} className={inp} required />
      </label>
      <label className="flex flex-col gap-1 text-[10px] font-extrabold uppercase tracking-wide text-grey-mid">
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
      <label className="flex flex-col gap-1 text-[10px] font-extrabold uppercase tracking-wide text-grey-mid">
        {t('grade')}
        <select
          name="grade_id"
                aria-label={t('grade')}
          value={gradeId}
          onChange={(e) => setGradeId(e.target.value)}
          className={`cursor-pointer ${inp}`}
        >
          <option value="">{t('notAssigned')}</option>
          {gradeOptions.map((g) => (
            <option key={g.id} value={g.id}>
              {g.name}
              {g.is_active ? '' : ` (${t('archived')})`}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-[10px] font-extrabold uppercase tracking-wide text-grey-mid">
        {t('gvcn')}
        <select
          name="homeroom_teacher_id"
                aria-label={t('gvcn')}
          defaultValue={row.homeroom_teacher_id ?? ''}
          className={`cursor-pointer ${inp}`}
        >
          <option value="">{t('notAssigned')}</option>
          {/* GIỮ LẠI NGƯỜI ĐANG CHỦ NHIỆM DÙ HỌ KHÔNG CÒN TRONG DANH SÁCH.
              `teachers` chỉ gồm nhân sự đang có vai giáo viên/BGH/quản trị. Nếu người đang chủ
              nhiệm đã bị đổi vai (hoặc vô hiệu), họ biến mất khỏi danh sách — và một <select> có
              defaultValue không khớp option nào sẽ tự nhảy về option ĐẦU TIÊN, ở đây là "— Không —".
              Nên mở form ra sửa mỗi cái tên lớp rồi bấm Lưu là lớp mất chủ nhiệm, lặng lẽ.
              Đúng lỗi này đã được vá cho ô "Khối" ngay bên cạnh; ô này bị sót. */}
          {row.homeroom_teacher_id && !teachers.some((p) => p.id === row.homeroom_teacher_id) && (
            <option value={row.homeroom_teacher_id}>{t('gvcnRoleChanged')}</option>
          )}
          {teachers.map((p) => (
            <option key={p.id} value={p.id}>
              {p.full_name ?? p.email}
            </option>
          ))}
        </select>
      </label>
      <div className="flex items-end gap-1.5">
        <SubmitButton className={navyBtn}>
          {t('save')}
        </SubmitButton>
        <button type="button" onClick={onDone} className={ghost}>
          {t('cancel')}
        </button>
      </div>
    </form>
  );
}

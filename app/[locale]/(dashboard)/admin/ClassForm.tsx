'use client';

import {useActionState, useEffect, useMemo, useRef, useState, type KeyboardEvent} from 'react';
import {useTranslations} from 'next-intl';
import {CheckCircle2, AlertCircle} from 'lucide-react';
import {SubmitButton} from '@/components/ui/SubmitButton';
import {createClass} from './actions';

type Campus = {id: string; name: string};
type Teacher = {id: string; full_name: string | null; email: string};
type Grade = {id: string; name: string; campus_id: string};

// Lớp copy nguyên từ admin/page.tsx (goldBtn, inputCls) — tách phần màu viền để tô đỏ khi lỗi.
const goldBtn =
  'btn-gold inline-flex h-11 cursor-pointer items-center self-start whitespace-nowrap rounded-[12px] px-3.5 text-than font-extrabold transition-all';
const inputBase =
  'w-full rounded-[12px] border-[1.5px] bg-white px-3 py-2 text-sm font-semibold text-navy outline-none transition-all';

// Tạo lớp — validation INLINE (useActionState): lỗi cạnh field, giữ input, báo thành công ngay.
// Khối là thực thể: chọn từ select lọc theo cơ sở (grade_id). Cột text 'grade' được đồng bộ ở action.
export function ClassForm({
  campuses,
  grades,
  teachers,
  defaultYear,
  fixedCampusId,
}: {
  campuses: Campus[];
  grades: Grade[];
  teachers: Teacher[];
  defaultYear: string;
  /**
   * Cơ sở đã biết trước — dùng khi form này nằm BÊN TRONG một cơ sở ở cây quản lý. Bắt người ta
   * chọn lại cơ sở mà họ vừa bấm mở là một bước thừa, và là một bước chọn nhầm được.
   */
  fixedCampusId?: string;
}) {
  const t = useTranslations('admin');
  const [state, formAction] = useActionState(createClass, {ok: false});
  const formRef = useRef<HTMLFormElement>(null);

  const [name, setName] = useState('');
  const [schoolYear, setSchoolYear] = useState(defaultYear);
  const [campusId, setCampusId] = useState(fixedCampusId ?? '');
  const [gradeId, setGradeId] = useState('');
  const [teacherId, setTeacherId] = useState('');

  // Khối khả dụng = khối thuộc cơ sở đang chọn.
  const gradeOptions = useMemo(
    () => grades.filter((g) => g.campus_id === campusId),
    [grades, campusId],
  );

  // Tạo xong → xoá tên + khối (giữ năm học / cơ sở / GVCN để tạo tiếp lớp cùng bối cảnh).
  useEffect(() => {
    if (state.ok) {
      setName('');
      setGradeId('');
    }
  }, [state]);

  const err = (field: string) => (state.fieldError === field ? state.error : null);
  const borderFor = (field: string) =>
    state.fieldError === field ? 'border-status-bad focus:border-status-bad' : 'border-navy/15 focus:border-navy';

  const onKeyDown = (e: KeyboardEvent<HTMLFormElement>) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      formRef.current?.requestSubmit();
    }
  };

  return (
    <form ref={formRef} action={formAction} onKeyDown={onKeyDown} className="flex flex-col gap-2" noValidate>
      <input
        name="name"
                aria-label={t('name')}
        placeholder={t('name')}
        value={name}
        onChange={(e) => setName(e.target.value)}
        aria-invalid={state.fieldError === 'name'}
        className={`${inputBase} ${borderFor('name')}`}
      />
      {err('name') && <FieldError msg={err('name')!} />}

      <input
        name="school_year"
                aria-label={t('schoolYear')}
        placeholder={t('schoolYear')}
        value={schoolYear}
        onChange={(e) => setSchoolYear(e.target.value)}
        aria-invalid={state.fieldError === 'school_year'}
        className={`${inputBase} ${borderFor('school_year')}`}
      />
      {err('school_year') && <FieldError msg={err('school_year')!} />}

      {fixedCampusId ? (
        <input type="hidden" name="campus_id" value={fixedCampusId} />
      ) : (
        <select
          name="campus_id"
          aria-label={t('campus')}
          value={campusId}
          onChange={(e) => {
            setCampusId(e.target.value);
            setGradeId(''); // đổi cơ sở → reset khối (khối thuộc cơ sở khác không hợp lệ)
          }}
          aria-invalid={state.fieldError === 'campus_id'}
          className={`cursor-pointer ${inputBase} ${borderFor('campus_id')}`}
        >
          <option value="" disabled>
            {t('campus')}
          </option>
          {campuses.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      )}
      {err('campus_id') && <FieldError msg={err('campus_id')!} />}

      {/* Khối — lọc theo cơ sở; rỗng nếu chưa chọn cơ sở hoặc cơ sở chưa có khối */}
      <select
        name="grade_id"
                aria-label={t('grade')}
        value={gradeId}
        onChange={(e) => setGradeId(e.target.value)}
        disabled={!campusId}
        className={`cursor-pointer ${inputBase} border-navy/15 focus:border-navy disabled:opacity-50`}
      >
        <option value="">{t('gradeNone')}</option>
        {gradeOptions.map((g) => (
          <option key={g.id} value={g.id}>
            {g.name}
          </option>
        ))}
      </select>

      <select
        name="homeroom_teacher_id"
                aria-label={t('gvcn')}
        value={teacherId}
        onChange={(e) => setTeacherId(e.target.value)}
        className={`cursor-pointer ${inputBase} border-navy/15 focus:border-navy`}
      >
        <option value="">{t('gvcnNone')}</option>
        {teachers.map((s) => (
          <option key={s.id} value={s.id}>
            {s.full_name ?? s.email}
          </option>
        ))}
      </select>

      <SubmitButton className={goldBtn} wrapClass="contents">
        + {t('createClass')}
      </SubmitButton>

      {/* Lỗi chung (server/DB) */}
      {state.error && !state.fieldError && (
        <p className="inline-flex items-center gap-1.5 text-than font-bold text-status-bad">
          <AlertCircle size={14} strokeWidth={2.5} />
          {state.error}
        </p>
      )}
      {/* Báo thành công */}
      {state.ok && state.message && (
        <p className="inline-flex items-center gap-1.5 text-than font-bold text-success-dark">
          <CheckCircle2 size={14} strokeWidth={2.5} />
          {state.message}
        </p>
      )}
    </form>
  );
}

function FieldError({msg}: {msg: string}) {
  return (
    <p className="mt-1 inline-flex items-center gap-1 text-chu-thich font-bold text-status-bad">
      <AlertCircle size={12} strokeWidth={2.5} />
      {msg}
    </p>
  );
}

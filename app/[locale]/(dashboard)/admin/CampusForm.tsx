'use client';

import {useActionState, useEffect, useRef, useState, type KeyboardEvent} from 'react';
import {useTranslations} from 'next-intl';
import {CheckCircle2, AlertCircle} from 'lucide-react';
import {SubmitButton} from '@/components/ui/SubmitButton';
import {SCHOOL_LEVELS, GRADE_NUMBERS, type SchoolLevel} from '@/lib/levels';
import {createCampus} from './actions';

// Lớp copy nguyên từ admin/page.tsx (goldBtn) + base input tách phần màu viền để tô đỏ khi lỗi.
const goldBtn =
  'btn-gold inline-flex h-11 cursor-pointer items-center self-start whitespace-nowrap rounded-[12px] px-3.5 text-[12.5px] font-extrabold transition-all';
const nameBase =
  'min-w-[140px] flex-1 rounded-[10px] border-[1.5px] bg-white px-3 py-2 text-sm font-semibold text-navy outline-none transition-all';
const codeBase =
  'w-[90px] rounded-[10px] border-[1.5px] bg-white px-3 py-2 text-sm font-semibold text-navy outline-none transition-all';

// Tạo cơ sở — validation INLINE (useActionState): lỗi cạnh field, giữ input, báo thành công ngay.
export function CampusForm() {
  const t = useTranslations('admin');
  const [state, formAction] = useActionState(createCampus, {ok: false});
  const formRef = useRef<HTMLFormElement>(null);

  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [level, setLevel] = useState<SchoolLevel | ''>('');

  // Tạo xong → xoá input để tạo tiếp cơ sở khác (giữ cấp học: các cơ sở cùng hệ thường cùng cấp).
  useEffect(() => {
    if (state.ok) {
      setName('');
      setCode('');
    }
  }, [state]);

  const borderFor = (field: string) =>
    state.fieldError === field ? 'border-status-bad focus:border-status-bad' : 'border-navy/15 focus:border-navy';

  const onKeyDown = (e: KeyboardEvent<HTMLFormElement>) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      formRef.current?.requestSubmit();
    }
  };

  return (
    <form
      ref={formRef}
      action={formAction}
      onKeyDown={onKeyDown}
      className="flex flex-wrap items-center gap-2"
      noValidate
    >
      <input
        name="name"
        placeholder={t('name')} aria-label={t('name')}
        value={name}
        onChange={(e) => setName(e.target.value)}
        aria-invalid={state.fieldError === 'name'}
        className={`${nameBase} ${borderFor('name')}`}
      />
      <input
        name="code"
        placeholder={t('code')} aria-label={t('code')}
        value={code}
        onChange={(e) => setCode(e.target.value)}
        aria-invalid={state.fieldError === 'code'}
        className={`${codeBase} ${borderFor('code')}`}
      />
      {/* Cấp học quyết định bộ Khối được sinh tự động ngay khi tạo cơ sở — nhờ vậy không ai
          phải gõ tên khối và số thứ tự bằng tay nữa. */}
      <select
        name="level"
                aria-label={t('level')}
        value={level}
        onChange={(e) => setLevel(e.target.value as SchoolLevel | '')}
        aria-invalid={state.fieldError === 'level'}
        className={`w-44 cursor-pointer rounded-[10px] border-[1.5px] bg-white px-3 py-2 text-sm font-semibold text-navy outline-none transition-all ${borderFor('level')}`}
      >
        <option value="">— {t('level')} —</option>
        {SCHOOL_LEVELS.map((lv) => (
          <option key={lv} value={lv}>
            {t(`level_${lv}`)}
          </option>
        ))}
      </select>

      <SubmitButton className={goldBtn} wrapClass="contents">
        + {t('createCampus')}
      </SubmitButton>

      {/* Cho thấy trước sẽ sinh ra khối nào — bớt cảm giác "chọn xong không biết chuyện gì xảy ra" */}
      {level && (
        <p className="w-full text-[11.5px] font-semibold text-grey-mid">
          {GRADE_NUMBERS[level]
            ? `${t('willSeed')}: ${GRADE_NUMBERS[level]!.map((n) => `Khối ${n}`).join(' · ')}`
            : t('manualGradeHint')}
        </p>
      )}

      {/* Lỗi field (name/code) — chiếm trọn dòng dưới hàng input */}
      {state.error && state.fieldError && (
        <p className="w-full inline-flex items-center gap-1 text-[12px] font-bold text-status-bad">
          <AlertCircle size={12} strokeWidth={2.5} />
          {state.error}
        </p>
      )}
      {/* Lỗi chung (server/DB) */}
      {state.error && !state.fieldError && (
        <p className="w-full inline-flex items-center gap-1.5 text-[13px] font-bold text-status-bad">
          <AlertCircle size={14} strokeWidth={2.5} />
          {state.error}
        </p>
      )}
      {/* Báo thành công */}
      {state.ok && state.message && (
        <p className="w-full inline-flex items-center gap-1.5 text-[13px] font-bold text-success-dark">
          <CheckCircle2 size={14} strokeWidth={2.5} />
          {state.message}
        </p>
      )}
    </form>
  );
}

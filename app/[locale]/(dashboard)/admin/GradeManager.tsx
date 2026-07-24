'use client';

import {useState} from 'react';
import {useTranslations} from 'next-intl';
import {ConfirmButton} from '@/components/ui/ConfirmButton';
import {createGrade, updateGrade, setGradeActive, deleteGrade} from './actions';

type Grade = {id: string; name: string; sort_order: number};

// Style gọn — nhất quán với admin/page.tsx (glass on gradient v3).
const inp =
  'min-w-0 rounded-[9px] border-[1.5px] border-navy/15 bg-white px-2.5 py-1.5 text-[13px] font-semibold text-navy outline-none transition-all focus:border-navy';
const navyBtn =
  'h-8 shrink-0 cursor-pointer whitespace-nowrap rounded-[9px] bg-navy px-2.5 text-[11.5px] font-extrabold text-white transition-all hover:bg-navy-700';
const ghost =
  'h-8 shrink-0 cursor-pointer whitespace-nowrap rounded-[9px] border-[1.5px] border-navy/20 bg-white px-2.5 text-[11.5px] font-extrabold text-navy transition-all hover:border-navy';
const danger =
  'grid h-8 w-8 shrink-0 cursor-pointer place-items-center rounded-[9px] border-[1.5px] border-status-bad/30 bg-status-bad/[0.08] text-status-bad transition-all hover:bg-status-bad/[0.16]';

// Quản lý Khối trong 1 cơ sở: thêm / sửa (inline toggle) / lưu-trữ / xoá (khi rỗng).
export function GradeManager({campusId, grades}: {campusId: string; grades: Grade[]}) {
  const t = useTranslations('admin');
  const [editId, setEditId] = useState<string | null>(null);

  return (
    <div className="mt-2.5 border-t border-navy/[0.08] pt-2.5">
      <div className="mb-1.5 text-[10px] font-extrabold uppercase tracking-wide text-grey-mid">
        {t('grades')} ({grades.length})
      </div>
      <div className="flex flex-col gap-1">
        {grades.map((g) =>
          editId === g.id ? (
            <form key={g.id} action={updateGrade} className="flex items-center gap-1.5">
              <input type="hidden" name="id" value={g.id} />
              <input name="name" defaultValue={g.name} className={`${inp} flex-1`} required />
              <input
                name="sort_order"
                type="number"
                defaultValue={g.sort_order}
                title={t('sortOrder')}
                className={`${inp} w-16 text-center`}
              />
              <button type="submit" className={navyBtn}>
                {t('save')}
              </button>
              <button type="button" onClick={() => setEditId(null)} className={ghost}>
                {t('cancel')}
              </button>
            </form>
          ) : (
            <div key={g.id} className="flex items-center gap-1.5">
              <span className="grid h-5 min-w-5 place-items-center rounded-md bg-navy/[0.06] px-1 text-[10px] font-extrabold text-grey-mid">
                {g.sort_order}
              </span>
              <span className="flex-1 truncate text-[13px] font-bold text-navy">{g.name}</span>
              <button type="button" onClick={() => setEditId(g.id)} className={ghost}>
                {t('edit')}
              </button>
              <form action={setGradeActive}>
                <input type="hidden" name="id" value={g.id} />
                <input type="hidden" name="active" value="false" />
                <button type="submit" className={ghost}>
                  {t('archive')}
                </button>
              </form>
              <form action={deleteGrade}>
                <input type="hidden" name="id" value={g.id} />
                <ConfirmButton message={t('confirmDeleteGrade')} className={danger}>
                  ✕
                </ConfirmButton>
              </form>
            </div>
          ),
        )}
        {grades.length === 0 && <div className="text-[12px] font-semibold text-grey-mid">{t('noGrade')}</div>}
      </div>

      {/* Thêm khối */}
      <form action={createGrade} className="mt-1.5 flex items-center gap-1.5">
        <input type="hidden" name="campus_id" value={campusId} />
        <input name="name" placeholder={t('gradeName')} className={`${inp} flex-1`} required />
        <input
          name="sort_order"
          type="number"
          placeholder="#"
          defaultValue={grades.length}
          className={`${inp} w-16 text-center`}
        />
        <button type="submit" className={navyBtn}>
          + {t('addGrade')}
        </button>
      </form>
    </div>
  );
}

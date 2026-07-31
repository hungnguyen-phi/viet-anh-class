'use client';

import {useState} from 'react';
import {useTranslations} from 'next-intl';
import {ConfirmButton} from '@/components/ui/ConfirmButton';
import {SubmitButton} from '@/components/ui/SubmitButton';
import {hasNumberedGrades, type SchoolLevel} from '@/lib/levels';
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

// Quản lý Khối trong 1 cơ sở.
//
// Cấp phổ thông (tiểu học / THCS / THPT): khối là HẰNG SỐ theo cấp — hệ thống tự sinh
// "Khối 1..5 / 6..9 / 10..12" ngay khi chọn cấp học, và sort_order lấy đúng bằng số khối.
// Vì vậy ở các cấp này KHÔNG hiện ô gõ tên + ô số thứ tự nữa: chúng chính là thứ đã đẻ ra
// mớ dữ liệu "7", "6", "k", "Khối" với thứ tự 0,0,2,7 trên production.
//
// Mầm non: nhà trẻ/mầm/chồi/lá không đánh số và mỗi trường gọi một kiểu → giữ đường nhập tay.
export function GradeManager({
  campusId,
  grades,
  level,
}: {
  campusId: string;
  grades: Grade[];
  level: SchoolLevel | null;
}) {
  const t = useTranslations('admin');
  const [editId, setEditId] = useState<string | null>(null);
  const auto = hasNumberedGrades(level);

  return (
    <div className="mt-2.5 border-t border-navy/[0.08] pt-2.5">
      <div className="mb-1.5 flex flex-wrap items-center gap-2">
        <span className="text-[10px] font-extrabold uppercase tracking-wide text-grey-mid">
          {t('grades')} ({grades.length})
        </span>
        {auto && (
          <span className="rounded-full bg-navy/[0.06] px-2 py-0.5 text-[10px] font-bold text-grey-mid">
            {t('gradesAuto')}
          </span>
        )}
      </div>

      <div className="flex flex-col gap-1">
        {grades.map((g) =>
          // Cấp phổ thông: chỉ xem + lưu-trữ. Không sửa tên/thứ tự (hệ thống giữ chuẩn).
          !auto && editId === g.id ? (
            <form key={g.id} action={updateGrade} className="flex items-center gap-1.5">
              <input type="hidden" name="id" value={g.id} />
              <input name="name" defaultValue={g.name}
                aria-label={t('gradeName')} className={`${inp} flex-1`} required />
              <input
                name="sort_order"
                type="number"
                aria-label={t('sortOrder')}
                defaultValue={g.sort_order}
                title={t('sortOrder')}
                className={`${inp} w-16 text-center`}
              />
              <SubmitButton className={navyBtn} wrapClass="contents">
                {t('save')}
              </SubmitButton>
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
              {!auto && (
                <button type="button" onClick={() => setEditId(g.id)} className={ghost}>
                  {t('edit')}
                </button>
              )}
              <form action={setGradeActive}>
                <input type="hidden" name="id" value={g.id} />
                <input type="hidden" name="active" value="false" />
                <SubmitButton className={ghost} wrapClass="contents">
                  {t('archive')}
                </SubmitButton>
              </form>
              <form action={deleteGrade}>
                <input type="hidden" name="id" value={g.id} />
                <ConfirmButton message={t('confirmDeleteGrade')} label={t('deleteGrade')} className={danger}>
                  ✕
                </ConfirmButton>
              </form>
            </div>
          ),
        )}
        {grades.length === 0 && (
          <div className="text-[12px] font-semibold text-grey-mid">
            {level ? t('noGrade') : t('pickLevelFirst')}
          </div>
        )}
      </div>

      {/* Thêm khối bằng tay — CHỈ cho mầm non (và cơ sở chưa khai cấp học). */}
      {!auto && level != null && (
        <form action={createGrade} className="mt-1.5 flex items-center gap-1.5">
          <input type="hidden" name="campus_id" value={campusId} />
          <input name="name" placeholder={t('gradeName')} aria-label={t('gradeName')} className={`${inp} flex-1`} required />
          <input
            name="sort_order"
            type="number"
            placeholder="#" aria-label={t('sortOrder')}
            defaultValue={grades.length}
            className={`${inp} w-16 text-center`}
          />
          {/* SubmitButton (không phải <button> trần) để nút tự khoá + hiện spinner khi đang gửi.
              Server action còn phải đi một vòng tới Supabase rồi revalidate cả trang, nên nếu
              nút im lìm thì người dùng tưởng bấm hụt và bấm thêm mấy lần nữa. */}
          <SubmitButton className={navyBtn} wrapClass="contents">
            + {t('addGrade')}
          </SubmitButton>
        </form>
      )}
    </div>
  );
}

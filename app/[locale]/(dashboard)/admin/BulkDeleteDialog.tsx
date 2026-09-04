'use client';

import {useTranslations} from 'next-intl';
import {SubmitButton} from '@/components/ui/SubmitButton';
import {bulkDeleteUsers} from './actions';

type Nguoi = {id: string; full_name: string | null; email: string};

// Hộp xác nhận xoá NHIỀU người — dùng chung cho khối "Ai đang chờ bạn" và bảng người dùng.
//
// Vì sao không dùng window.confirm như các nút xoá một người: hộp trần của trình duyệt chỉ hiện
// được một câu chữ, nó không liệt kê nổi ai sắp bị xoá. Với một cú bấm xoá vĩnh viễn hàng chục
// người, "bạn có chắc không" là không đủ — người bấm cần đọc lại đúng những cái tên mình vừa tick.
export function BulkDeleteDialog({
  selected,
  onCancel,
  cancelClass,
  dangerClass,
}: {
  selected: Nguoi[];
  onCancel: () => void;
  cancelClass: string;
  dangerClass: string;
}) {
  const t = useTranslations('admin');

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-navy/35 p-4 backdrop-blur-[2px]"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
      onKeyDown={(e) => {
        if (e.key === 'Escape') onCancel();
      }}
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="xoa-nhieu-tieu-de"
        className="glass w-full max-w-[440px] rounded-[20px] p-[18px]"
      >
        <div id="xoa-nhieu-tieu-de" className="font-display text-doc font-bold text-navy">
          {t('confirmDeleteManyTitle', {n: selected.length})}
        </div>
        <p className="mt-1.5 text-than font-semibold leading-relaxed text-status-bad-dark">
          {t('confirmDeleteManyBody')}
        </p>
        <ul className="mt-3 max-h-[180px] overflow-y-auto rounded-[12px] border-[1.5px] border-navy/10 bg-white/70 px-3 py-2">
          {selected.slice(0, 12).map((u) => (
            <li key={u.id} className="truncate py-0.5 text-than font-bold text-navy">
              {u.full_name ?? u.email}
            </li>
          ))}
          {selected.length > 12 && (
            <li className="py-0.5 text-chu-thich font-semibold italic text-grey-mid">
              {t('andMore', {n: selected.length - 12})}
            </li>
          )}
        </ul>
        <div className="mt-3.5 flex flex-wrap justify-end gap-2">
          {/* Tiêu điểm rơi vào HUỶ, không phải Xoá — hộp này mở ra vì người dùng sắp làm một việc
              không hoàn tác được; phím Enter theo phản xạ phải là lối lùi, không phải lối tiến. */}
          <button type="button" onClick={onCancel} autoFocus className={cancelClass}>
            {t('cancel')}
          </button>
          <form action={bulkDeleteUsers}>
            {selected.map((u) => (
              <input key={u.id} type="hidden" name="userId" value={u.id} />
            ))}
            <SubmitButton className={dangerClass} wrapClass="contents">
              {t('confirmDeleteManyGo', {n: selected.length})}
            </SubmitButton>
          </form>
        </div>
      </div>
    </div>
  );
}

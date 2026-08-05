'use client';

import {useEffect, useRef, useState} from 'react';
import {useTranslations} from 'next-intl';
import {SubmitButton} from '@/components/ui/SubmitButton';
import {bulkDeleteUsers, bulkSetUserRole, setUserRole} from './actions';

type Waiting = {id: string; full_name: string | null; email: string; created_at: string};

const GRANTABLE = ['teacher', 'principal', 'admin', 'student', 'parent'] as const;

const selectCls =
  'h-10 cursor-pointer rounded-[10px] border-[1.5px] border-navy/15 bg-white px-2.5 text-[12.5px] font-semibold text-navy outline-none focus:border-navy';
const navyBtn =
  'h-10 cursor-pointer whitespace-nowrap rounded-[10px] bg-navy px-3 text-[12px] font-extrabold text-white transition-all hover:bg-navy-700';
const dangerBtn =
  'h-10 cursor-pointer whitespace-nowrap rounded-[10px] bg-[color-mix(in_srgb,var(--color-status-bad)_12%,transparent)] px-3 text-[12px] font-extrabold text-status-bad transition-all hover:bg-[color-mix(in_srgb,var(--color-status-bad)_22%,transparent)]';
const ghostBtn =
  'h-8 cursor-pointer whitespace-nowrap rounded-[10px] border-[1.5px] border-navy/20 bg-white/70 px-2.5 text-[11.5px] font-extrabold text-navy transition-all hover:border-navy';

// AI ĐANG CHỜ BẠN — nay duyệt được cả mẻ.
//
// Đầu năm học có vài chục người đăng nhập lần đầu trong một buổi. Bản cũ bắt xử lý từng dòng:
// chọn vai → bấm → cả trang tải lại → cuộn tìm lại chỗ vừa đứng, nhân với ba mươi. Nên tick
// nhiều dòng rồi cấp quyền một lần là việc bắt buộc phải có, không phải tiện nghi.
//
// Ô tick nằm NGOÀI hai form (giữ bằng state React) rồi mới đổ vào hidden input: một ô tick không
// thể nằm trong hai form cùng lúc, mà "Cấp quyền" và "Xoá" là hai server action khác nhau.
export function PendingApprovals({users}: {users: Waiting[]}) {
  const t = useTranslations('admin');
  const tr = useTranslations('roles');
  const [sel, setSel] = useState<string[]>([]);

  const allChecked = users.length > 0 && sel.length === users.length;
  // TRẠNG THÁI MỘT PHẦN. Chọn 3 trên 12 mà ô "Chọn tất cả" hiện y như lúc chưa chọn gì thì nó nói
  // sai: người dùng bấm nó tưởng là "chọn thêm phần còn lại", hoá ra là bỏ hết. `indeterminate`
  // không đặt được bằng thuộc tính JSX, chỉ đặt được qua DOM.
  const allRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (allRef.current) allRef.current.indeterminate = sel.length > 0 && !allChecked;
  }, [sel.length, allChecked]);
  const [askDelete, setAskDelete] = useState(false);
  const selected = users.filter((u) => sel.includes(u.id));
  const toggle = (id: string) =>
    setSel((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  const toggleAll = () => setSel(allChecked ? [] : users.map((u) => u.id));

  return (
    <section className="rounded-[20px] border-[1.5px] border-gold-deep/40 bg-gold/[0.10] p-[18px]">
      <div className="mb-2.5 font-display text-[15px] font-bold text-navy">
        {t('waitingOnYou', {n: users.length})}
      </div>
      <p className="mb-3 text-[12px] font-semibold leading-relaxed text-navy/70">
        {t('waitingOnYouHint')}
      </p>

      {/* Thanh chọn nhiều */}
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <label className="inline-flex cursor-pointer items-center gap-2 text-[12.5px] font-extrabold text-navy">
          <input
            ref={allRef}
            type="checkbox"
            checked={allChecked}
            onChange={toggleAll}
            className="h-4 w-4 cursor-pointer accent-[var(--color-navy)]"
          />
          {t('selectAll')}
        </label>
        {sel.length > 0 && (
          <>
            <span className="text-[12px] font-bold text-grey-mid">
              {t('selectedCount', {n: sel.length})}
            </span>
            {/* Cấp quyền cả mẻ */}
            <form action={bulkSetUserRole} className="flex items-center gap-1.5">
              {sel.map((id) => (
                <input key={id} type="hidden" name="userId" value={id} />
              ))}
              <select
                name="role"
                aria-label={t('selectRole')}
                defaultValue="teacher"
                className={selectCls}
              >
                {GRANTABLE.map((r) => (
                  <option key={r} value={r}>
                    {tr(r)}
                  </option>
                ))}
              </select>
              <SubmitButton className={navyBtn}>
                {t('approveSelected', {n: sel.length})}
              </SubmitButton>
            </form>
            {/* Xoá cả mẻ — mở hộp xác nhận NGAY TRONG TRANG, không dùng window.confirm.
                Hộp trần của trình duyệt chỉ hiện được một câu chữ: nó không liệt kê nổi ai sắp bị
                xoá. Với một cú bấm xoá vĩnh viễn hàng chục người, "bạn có chắc không" là không đủ
                — người bấm cần đọc lại đúng những cái tên mình vừa tick. */}
            <button type="button" onClick={() => setAskDelete(true)} className={dangerBtn}>
              {t('deleteSelected', {n: sel.length})}
            </button>
          </>
        )}
      </div>

      <div className="flex flex-col gap-2">
        {users.map((u) => (
          <div
            key={u.id}
            className={`flex flex-wrap items-center gap-2 rounded-[12px] px-3 py-2.5 transition-colors ${
              sel.includes(u.id) ? 'bg-white ring-[1.5px] ring-navy/25' : 'bg-white/70'
            }`}
          >
            <input
              type="checkbox"
              checked={sel.includes(u.id)}
              onChange={() => toggle(u.id)}
              aria-label={t('pickFor', {name: u.full_name ?? u.email})}
              className="h-4 w-4 shrink-0 cursor-pointer accent-[var(--color-navy)]"
            />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[13px] font-extrabold text-navy">
                {u.full_name ?? u.email}
              </span>
              <span className="block truncate text-[11.5px] font-semibold text-grey-mid">
                {u.email} · {t('waitingSince', {date: String(u.created_at).slice(0, 10)})}
              </span>
            </span>
            {/* Vẫn giữ đường cấp quyền cho MỘT người: phần lớn ngày thường chỉ có một người chờ,
                bắt họ tick rồi mới bấm được là thêm một bước cho việc phổ biến nhất. */}
            <form action={setUserRole} className="flex flex-none items-center gap-1.5">
              <input type="hidden" name="userId" value={u.id} />
              <select
                name="role"
                aria-label={t('roleFor', {name: u.full_name ?? u.email})}
                defaultValue="teacher"
                className={selectCls}
              >
                {GRANTABLE.map((r) => (
                  <option key={r} value={r}>
                    {tr(r)}
                  </option>
                ))}
              </select>
              <SubmitButton className={ghostBtn} label={t('approveFor', {name: u.full_name ?? u.email})}>
                {t('setRole')}
              </SubmitButton>
            </form>
          </div>
        ))}
      </div>
      {/* Hộp xác nhận xoá hàng loạt — liệt kê TÊN, không chỉ đếm số. */}
      {askDelete && (
        <div
          className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-navy/35 p-4 backdrop-blur-[2px]"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setAskDelete(false);
          }}
        >
          <div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="xoa-nhieu-tieu-de"
            className="glass w-full max-w-[440px] rounded-[20px] p-[18px]"
          >
            <div id="xoa-nhieu-tieu-de" className="font-display text-[16px] font-bold text-navy">
              {t('confirmDeleteManyTitle', {n: sel.length})}
            </div>
            <p className="mt-1.5 text-[12.5px] font-semibold leading-relaxed text-status-bad-dark">
              {t('confirmDeleteManyBody')}
            </p>
            <ul className="mt-3 max-h-[180px] overflow-y-auto rounded-[12px] border-[1.5px] border-navy/10 bg-white/70 px-3 py-2">
              {selected.slice(0, 12).map((u) => (
                <li key={u.id} className="truncate py-0.5 text-[12.5px] font-bold text-navy">
                  {u.full_name ?? u.email}
                </li>
              ))}
              {selected.length > 12 && (
                <li className="py-0.5 text-[12px] font-semibold italic text-grey-mid">
                  {t('andMore', {n: selected.length - 12})}
                </li>
              )}
            </ul>
            <div className="mt-3.5 flex flex-wrap justify-end gap-2">
              <button type="button" onClick={() => setAskDelete(false)} autoFocus className={ghostBtn}>
                {t('cancel')}
              </button>
              <form action={bulkDeleteUsers}>
                {sel.map((id) => (
                  <input key={id} type="hidden" name="userId" value={id} />
                ))}
                <SubmitButton className={dangerBtn} wrapClass="contents">
                  {t('confirmDeleteManyGo', {n: sel.length})}
                </SubmitButton>
              </form>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

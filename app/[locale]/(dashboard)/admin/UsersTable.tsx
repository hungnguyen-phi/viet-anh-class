'use client';

import {useEffect, useRef, useState} from 'react';
import {useTranslations} from 'next-intl';
import {SubmitButton} from '@/components/ui/SubmitButton';
import {bulkSetUserRole} from './actions';
import {BulkDeleteDialog} from './BulkDeleteDialog';
import {SuaNguoiDung} from './SuaNguoiDung';
import type {Role} from './user-tabs';

// lop: string = có lớp/cơ sở · null = vai này lẽ ra có mà chưa có · undefined = vai không áp dụng.
type Row = {id: string; full_name: string | null; email: string; role: Role; lop?: string | null};
// Cấp quyền cả mẻ thì KHÔNG cho chọn "chờ cấp quyền": đẩy một loạt người về vai đó nghĩa là đăng
// nhập vào chỉ còn màn hình đỏ, và vai cũ của họ không được lưu ở đâu để mà lùi lại. Muốn làm việc
// đó với một người thì vẫn có nút "Vô hiệu" ở cuối dòng, kèm câu hỏi nêu rõ tên và vai đang có.
const GRANTABLE = ['admin', 'principal', 'teacher', 'student', 'parent'] as const;

const th = 'text-[10px] font-extrabold uppercase tracking-wide text-grey-mid';
// h-8 + inline-flex items-center: thiếu phần căn giữa thì chữ nằm sát mép trên hộp 32px. Không lộ
// ra trên <button> (trình duyệt tự căn giữa nội dung nút) nhưng lộ ngay trên <a> và <span>.
const btnBase = 'inline-flex items-center justify-center whitespace-nowrap font-extrabold transition-all';
const navyBtnSm = `${btnBase} h-8 cursor-pointer rounded-[10px] bg-navy px-2.5 text-[11.5px] text-white hover:bg-navy-700`;
const outlineBtnSm = `${btnBase} h-8 cursor-pointer rounded-[10px] border-[1.5px] border-navy/20 bg-white/60 px-2.5 text-[11.5px] text-navy hover:border-navy`;
const dangerBtnSm = `${btnBase} h-8 cursor-pointer rounded-[10px] bg-[color-mix(in_srgb,var(--color-status-bad)_12%,transparent)] px-2.5 text-[11.5px] text-status-bad hover:bg-[color-mix(in_srgb,var(--color-status-bad)_22%,transparent)]`;
const selectSm =
  'h-8 min-w-0 flex-1 cursor-pointer rounded-[10px] border-[1.5px] border-navy/15 bg-white px-2 text-[12px] font-semibold text-navy outline-none focus:border-navy';

// Bảng người dùng, có CHỌN NHIỀU DÒNG.
//
// Trước đây chọn-nhiều chỉ có ở khối "Ai đang chờ bạn", mà khối đó ẩn khi không có ai chờ — nên
// phần lớn thời gian màn Quản trị trông như không hề có tính năng ấy. Nhưng việc cần nó nhất lại
// nằm ở đây: cuối năm học chuyển một khoá học sinh sang vai khác, hay dọn một loạt tài khoản thử.
//
// Ô tick nằm NGOÀI hai form (giữ bằng state React) rồi mới đổ vào hidden input: một ô tick không
// thể nằm trong hai form cùng lúc, mà "Cấp quyền" và "Xoá" là hai server action khác nhau.
export function UsersTable({rows, meId, q}: {rows: Row[]; meId: string; q: string}) {
  const t = useTranslations('admin');
  const tr = useTranslations('roles');
  const [sel, setSel] = useState<string[]>([]);
  const [askDelete, setAskDelete] = useState(false);

  // Đổi trang / đổi tab là một danh sách người khác hẳn — giữ lại ô tick cũ thì người dùng bấm
  // "Xoá 3" trong khi trên màn hình không còn dòng nào đang sáng. Xoá lựa chọn khi tập dòng đổi.
  const khoaDong = rows.map((r) => r.id).join(',');
  useEffect(() => {
    setSel([]);
    setAskDelete(false);
  }, [khoaDong]);

  // Chỉ tick được người KHÁC mình: đổi vai hoặc xoá chính mình là cách tự khoá quyền quản trị.
  const chonDuoc = rows.filter((r) => r.id !== meId);
  const allChecked = chonDuoc.length > 0 && sel.length === chonDuoc.length;
  const allRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (allRef.current) allRef.current.indeterminate = sel.length > 0 && !allChecked;
  }, [sel.length, allChecked]);

  const toggle = (id: string) =>
    setSel((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  const selected = rows.filter((r) => sel.includes(r.id));

  return (
    <>
      {/* Thanh thao tác hàng loạt. Chỉ hiện khi đã tick — một thanh luôn nằm đó với các nút mờ là
          một thanh người ta thôi đọc. */}
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <label className="inline-flex h-8 cursor-pointer items-center gap-2 text-[12.5px] font-extrabold text-navy">
          <input
            ref={allRef}
            type="checkbox"
            checked={allChecked}
            onChange={() => setSel(allChecked ? [] : chonDuoc.map((r) => r.id))}
            disabled={chonDuoc.length === 0}
            className="h-4 w-4 cursor-pointer accent-[var(--color-navy)]"
          />
          {t('selectAll')}
        </label>
        {sel.length > 0 && (
          <>
            <span className="text-[12px] font-bold text-grey-mid">
              {t('selectedCount', {n: sel.length})}
            </span>
            <form action={bulkSetUserRole} className="flex items-center gap-1.5">
              {sel.map((id) => (
                <input key={id} type="hidden" name="userId" value={id} />
              ))}
              <select
                name="role"
                aria-label={t('selectRole')}
                defaultValue="student"
                className={`${selectSm} flex-none`}
              >
                {GRANTABLE.map((r) => (
                  <option key={r} value={r}>
                    {tr(r)}
                  </option>
                ))}
              </select>
              <SubmitButton className={navyBtnSm} wrapClass="contents">
                {t('approveSelected', {n: sel.length})}
              </SubmitButton>
            </form>
            <button type="button" onClick={() => setAskDelete(true)} className={dangerBtnSm}>
              {t('deleteSelected', {n: sel.length})}
            </button>
          </>
        )}
      </div>

      {/* NGỮ NGHĨA BẢNG BẰNG ARIA, không phải <table>.
          Bảng này dùng flex để các cột co giãn theo tỉ lệ (tên ngắn, email dài) — thứ <table> làm
          được nhưng vụng hơn. Cái mất khi bỏ <table> là trình đọc màn hình không còn biết ô nào
          thuộc cột nào; role="table"/"row"/"columnheader"/"cell" trả lại đúng thông tin đó mà
          không đụng tới bố cục. */}
      <div className="overflow-x-auto rounded-[14px] border-[1.5px] border-navy/10">
        <div role="table" aria-label={t('usersTable')}>
          <div
            role="row"
            className="box-border flex min-w-[640px] items-center gap-2 bg-navy/[0.03] px-[14px] py-[9px]"
          >
            <span className="w-4 flex-none" aria-hidden />
            <span role="columnheader" className={`flex-[1.3] ${th}`}>
              {t('name')}
            </span>
            <span role="columnheader" className={`flex-[1.6] ${th}`}>
              {t('email')}
            </span>
            <span role="columnheader" className={`w-[120px] flex-none ${th}`}>
              {t('role')}
            </span>
            <span role="columnheader" className={`flex-1 ${th}`}>
              {t('cotLop')}
            </span>
            <span role="columnheader" className={`w-11 flex-none text-center ${th}`}>
              <span className="sr-only">{t('actions')}</span>
            </span>
          </div>

          {rows.map((p) => {
            // Tên đọc được của từng nút/ô chọn phải KÈM TÊN NGƯỜI. Nếu mọi dòng dùng chung nhãn
            // "Vai trò" / "Xoá" thì người dùng trình đọc màn hình đi qua năm mươi dòng chỉ nghe
            // đúng một câu lặp lại, không biết mình đang sắp đổi vai hay xoá ai.
            const who = p.full_name ?? p.email;
            const laMinh = p.id === meId;
            const dangChon = sel.includes(p.id);
            return (
              <div
                key={p.id}
                role="row"
                className={`box-border flex min-w-[640px] items-center gap-2 border-t border-navy/[0.08] px-[14px] py-1.5 transition-colors ${
                  dangChon ? 'bg-navy/[0.05]' : 'hover:bg-navy/[0.03]'
                }`}
              >
                <input
                  type="checkbox"
                  checked={dangChon}
                  onChange={() => toggle(p.id)}
                  disabled={laMinh}
                  aria-label={t('pickFor', {name: who})}
                  className="cham-44 h-4 w-4 flex-none cursor-pointer accent-[var(--color-navy)] disabled:cursor-not-allowed disabled:opacity-30"
                />
                <span role="cell" className="min-w-0 flex-[1.3] truncate text-[13px] font-bold text-navy">
                  {/* Chưa có họ tên thì nói thẳng là chưa có, đừng vẽ một dấu gạch ngang. Một ô chỉ
                      chứa "—" không nói được là dữ liệu thiếu hay hệ thống hỏng. */}
                  {p.full_name ?? (
                    <span className="font-semibold italic text-grey-mid">{t('noName')}</span>
                  )}
                </span>
                <span
                  role="cell"
                  className="min-w-0 flex-[1.6] truncate text-xs font-semibold text-grey-mid"
                >
                  {p.email}
                </span>
                <span role="cell" className="w-[120px] flex-none truncate text-[12.5px] font-bold text-navy">
                  {tr(p.role)}
                </span>
                {/* LỚP: học sinh → lớp ghi danh; GVCN → lớp chủ nhiệm; BGH → cơ sở. null = lẽ ra phải
                    có mà chưa có (nói thẳng "Chưa có lớp"); undefined = vai không áp dụng ("—"). */}
                <span role="cell" className="min-w-0 flex-1 truncate text-[12.5px] font-semibold text-navy">
                  {p.lop === undefined ? (
                    <span className="text-grey-mid">—</span>
                  ) : p.lop === null ? (
                    <span className="italic text-grey-mid">{t('chuaCoLop')}</span>
                  ) : (
                    p.lop
                  )}
                </span>
                <span role="cell" className="flex w-11 flex-none justify-center">
                  {!laMinh ? (
                    <SuaNguoiDung id={p.id} who={who} role={p.role} email={p.email} />
                  ) : (
                    // Dòng của chính mình: không có bút — đổi vai/xoá chính mình là tự khoá quyền.
                    <span className="text-[10.5px] font-bold text-grey-mid" title={t('isYou')}>
                      {t('isYou')}
                    </span>
                  )}
                </span>
              </div>
            );
          })}

          {rows.length === 0 && (
            <div className="border-t border-navy/[0.08] px-[14px] py-8 text-center">
              <div className="text-[13.5px] font-extrabold text-navy">
                {q ? t('noMatch', {q}) : t('noUsersFilter')}
              </div>
              <div className="mt-1 text-[12px] font-semibold text-grey-mid">
                {t('noUsersFilterHint')}
              </div>
            </div>
          )}
        </div>
      </div>

      {askDelete && (
        <BulkDeleteDialog
          selected={selected}
          onCancel={() => setAskDelete(false)}
          cancelClass={outlineBtnSm}
          dangerClass={dangerBtnSm}
        />
      )}
    </>
  );
}

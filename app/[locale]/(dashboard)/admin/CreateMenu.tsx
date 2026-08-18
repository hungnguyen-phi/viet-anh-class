'use client';

import {useCallback, useEffect, useRef, useState, type ReactNode} from 'react';
import {useTranslations} from 'next-intl';
import {Building2, GraduationCap, Plus, UserPlus, Users, X} from 'lucide-react';

type Key = 'campus' | 'class' | 'invite' | 'assign' | 'parent';

// Một nút "Tạo mới" thay cho năm thẻ luôn mở.
//
// Tạo cơ sở, tạo lớp, mời người dùng, phân công GVCN, mời phụ huynh đều là việc LÀM MỘT LẦN RỒI
// THÔI, nhưng bản cũ để cả năm form ấy nằm chình ình giữa trang mỗi ngày, đẩy bảng người dùng và
// cây cơ sở xuống dưới. Gom vào một nút: chúng vẫn ở đúng chỗ người ta đi tìm ("tạo cái gì đó"),
// mà không chiếm chỗ của việc hằng ngày.
export function CreateMenu({
  campusForm,
  classForm,
  inviteForm,
  assignForm,
  parentForm,
  revision,
}: {
  campusForm: ReactNode;
  classForm: ReactNode;
  inviteForm: ReactNode;
  assignForm: ReactNode;
  parentForm: ReactNode | null;
  /**
   * Dấu vân tay của dữ liệu phía máy chủ (số cơ sở, số lớp, số người, câu thông báo hiện tại).
   *
   * Dùng để BIẾT KHI NÀO MỘT FORM VỪA LƯU XONG. Năm form này là server action: bấm Lưu là máy chủ
   * chạy, redirect kèm ?flash=..., rồi trang dựng lại — nhưng hộp thoại là state phía client nên
   * nó sống sót qua vòng đó và cứ đứng nguyên đó. Người dùng lưu xong thấy y hệt lúc chưa lưu,
   * không biết là xong hay hỏng, nên bấm Lưu lần nữa.
   *
   * Không dùng useFormStatus được: nó chỉ đọc được từ BÊN TRONG form, mà năm form này truyền vào
   * đây dưới dạng ReactNode dựng sẵn từ server component.
   */
  revision: string;
}) {
  const t = useTranslations('admin');
  const [menu, setMenu] = useState(false);
  const [open, setOpen] = useState<Key | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const revisionOnOpen = useRef(revision);

  const items: {key: Key; label: string; icon: ReactNode; body: ReactNode}[] = [
    {key: 'campus', label: t('createCampus'), icon: <Building2 size={15} strokeWidth={2.2} />, body: campusForm},
    {key: 'class', label: t('createClass'), icon: <GraduationCap size={15} strokeWidth={2.2} />, body: classForm},
    {key: 'invite', label: t('inviteUser'), icon: <UserPlus size={15} strokeWidth={2.2} />, body: inviteForm},
    {key: 'assign', label: t('assignGvcn'), icon: <Users size={15} strokeWidth={2.2} />, body: assignForm},
    // PRD v3 #10: Giai đoạn 1 chưa có phụ huynh — cờ PARENT_PORTAL tắt thì tab này biến mất.
    ...(parentForm
      ? [{key: 'parent' as Key, label: t('inviteParent'), icon: <UserPlus size={15} strokeWidth={2.2} />, body: parentForm}]
      : []),
  ];
  const current = items.find((i) => i.key === open);

  // Đóng hộp thoại và TRẢ TIÊU ĐIỂM VỀ NÚT đã mở nó. Không trả về thì người dùng bàn phím bị thả
  // ở đầu trang, phải Tab lại từ đầu để về đúng chỗ họ đang đứng.
  const closeDialog = useCallback(() => {
    setOpen(null);
    triggerRef.current?.focus();
  }, []);

  // Đóng bằng Esc và bằng cú bấm ra ngoài — hai lối thoát mà người dùng thử theo phản xạ trước
  // khi đi tìm nút đóng.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      setMenu(false);
      setOpen((cur) => {
        if (cur) triggerRef.current?.focus();
        return null;
      });
    };
    const onDown = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setMenu(false);
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onDown);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onDown);
    };
  }, []);

  // Mở hộp thoại → đưa tiêu điểm vào trong và GIỮ NÓ Ở TRONG.
  //
  // aria-modal="true" chỉ là lời hứa với trình đọc màn hình; nó không chặn phím Tab. Thiếu bẫy
  // tiêu điểm thì người dùng bàn phím Tab hai lần là ra sau lớp phủ, gõ vào những thứ họ không
  // nhìn thấy và không biết mình đang ở đâu.
  useEffect(() => {
    if (!current) return;
    const root = dialogRef.current;
    if (!root) return;
    const SELECTOR =
      'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
    const focusables = () => Array.from(root.querySelectorAll<HTMLElement>(SELECTOR));
    // Ô nhập đầu tiên, không phải nút ✕ — người mở hộp thoại này để điền, không phải để đóng.
    const first = focusables().find((el) => !el.hasAttribute('data-close')) ?? focusables()[0];
    first?.focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;
      const list = focusables();
      if (list.length === 0) return;
      const head = list[0];
      const tail = list[list.length - 1];
      if (e.shiftKey && document.activeElement === head) {
        e.preventDefault();
        tail.focus();
      } else if (!e.shiftKey && document.activeElement === tail) {
        e.preventDefault();
        head.focus();
      }
    };
    root.addEventListener('keydown', onKey);
    return () => root.removeEventListener('keydown', onKey);
  }, [current]);

  // Lưu xong thì tự đóng. Ghi lại dấu vân tay lúc MỞ, rồi so mỗi lần trang dựng lại.
  useEffect(() => {
    if (!open) {
      revisionOnOpen.current = revision;
      return;
    }
    if (revision !== revisionOnOpen.current) closeDialog();
  }, [revision, open, closeDialog]);

  // Menu thả xuống: điều hướng bằng phím mũi tên như một menu thật.
  // role="menu" là một lời hứa về cách bấm phím; hứa mà không làm thì người dùng bàn phím tin vào
  // mũi tên rồi không thấy gì nhúc nhích.
  const onMenuKey = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const list = Array.from(menuRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? []);
    if (list.length === 0) return;
    const at = list.indexOf(document.activeElement as HTMLElement);
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      const next = e.key === 'ArrowDown' ? (at + 1) % list.length : (at - 1 + list.length) % list.length;
      list[next].focus();
    } else if (e.key === 'Home') {
      e.preventDefault();
      list[0].focus();
    } else if (e.key === 'End') {
      e.preventDefault();
      list[list.length - 1].focus();
    }
  };

  return (
    <div ref={wrapRef} className="relative">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setMenu((v) => !v)}
        aria-expanded={menu}
        aria-haspopup="menu"
        className="btn-gold inline-flex h-11 cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-[12px] px-4 text-[12.5px] font-extrabold transition-all"
      >
        <Plus size={15} strokeWidth={2.6} />
        {t('createNew')}
      </button>

      {menu && (
        <div
          ref={menuRef}
          role="menu"
          aria-label={t('createNew')}
          onKeyDown={onMenuKey}
          className="glass absolute right-0 z-30 mt-1.5 w-[248px] overflow-hidden rounded-[14px] p-1.5 shadow-lg"
        >
          {items.map((i) => (
            <button
              key={i.key}
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(i.key);
                setMenu(false);
              }}
              className="flex w-full cursor-pointer items-center gap-2 rounded-[10px] px-2.5 py-2.5 text-left text-[12.5px] font-extrabold text-navy transition-colors hover:bg-navy/[0.06]"
            >
              {/* gold-text (5.32:1) chứ không phải gold-deep (3.19:1): icon này nằm cùng dòng với
                  chữ 12.5px và thừa hưởng cỡ đó, mà nấc sáng chỉ đủ chuẩn cho chữ ≥18px.
                  Bộ kiểm scripts/test-tuong-phan.mjs canh đúng chỗ này. */}
              <span className="text-gold-text">{i.icon}</span>
              {i.label}
            </button>
          ))}
        </div>
      )}

      {/* Hộp thoại chứa đúng MỘT form. Các form này vốn là component sẵn có, truyền vào dạng
          children từ server component — nên không phải dựng lại logic nào. */}
      {current && (
        <div
          className="fixed inset-0 z-50 grid place-items-start overflow-y-auto bg-navy/35 p-4 backdrop-blur-[2px] sm:place-items-center"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) closeDialog();
          }}
        >
          <div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-label={current.label}
            className="glass my-auto w-full max-w-[520px] rounded-[20px] p-[18px]"
          >
            <div className="mb-3 flex items-center gap-2">
              <span className="font-display text-[15px] font-bold text-navy">{current.label}</span>
              <button
                type="button"
                data-close
                onClick={closeDialog}
                aria-label={t('cancel')}
                className="ml-auto grid h-10 w-10 cursor-pointer place-items-center rounded-[10px] border-[1.5px] border-navy/15 bg-white/70 text-navy transition-all hover:border-navy"
              >
                <X size={14} strokeWidth={2.6} />
              </button>
            </div>
            {current.body}
          </div>
        </div>
      )}
    </div>
  );
}

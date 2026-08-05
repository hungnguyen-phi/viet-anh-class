'use client';

import {useEffect, useRef, useState, type ReactNode} from 'react';
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
}: {
  campusForm: ReactNode;
  classForm: ReactNode;
  inviteForm: ReactNode;
  assignForm: ReactNode;
  parentForm: ReactNode;
}) {
  const t = useTranslations('admin');
  const [menu, setMenu] = useState(false);
  const [open, setOpen] = useState<Key | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  const items: {key: Key; label: string; icon: ReactNode; body: ReactNode}[] = [
    {key: 'campus', label: t('createCampus'), icon: <Building2 size={15} strokeWidth={2.2} />, body: campusForm},
    {key: 'class', label: t('createClass'), icon: <GraduationCap size={15} strokeWidth={2.2} />, body: classForm},
    {key: 'invite', label: t('inviteUser'), icon: <UserPlus size={15} strokeWidth={2.2} />, body: inviteForm},
    {key: 'assign', label: t('assignGvcn'), icon: <Users size={15} strokeWidth={2.2} />, body: assignForm},
    {key: 'parent', label: t('inviteParent'), icon: <UserPlus size={15} strokeWidth={2.2} />, body: parentForm},
  ];
  const current = items.find((i) => i.key === open);

  // Đóng bằng Esc và bằng cú bấm ra ngoài — hai lối thoát mà người dùng thử theo phản xạ trước
  // khi đi tìm nút đóng.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      setMenu(false);
      setOpen(null);
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

  return (
    <div ref={wrapRef} className="relative">
      <button
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
          role="menu"
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
              className="flex w-full cursor-pointer items-center gap-2 rounded-[10px] px-2.5 py-2 text-left text-[12.5px] font-extrabold text-navy transition-colors hover:bg-navy/[0.06]"
            >
              <span className="text-gold-deep">{i.icon}</span>
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
            if (e.target === e.currentTarget) setOpen(null);
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label={current.label}
            className="glass my-auto w-full max-w-[520px] rounded-[20px] p-[18px]"
          >
            <div className="mb-3 flex items-center gap-2">
              <span className="font-display text-[15px] font-bold text-navy">{current.label}</span>
              <button
                type="button"
                onClick={() => setOpen(null)}
                aria-label={t('cancel')}
                className="ml-auto grid h-8 w-8 cursor-pointer place-items-center rounded-[10px] border-[1.5px] border-navy/15 bg-white/70 text-navy transition-all hover:border-navy"
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

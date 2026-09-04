'use client';

// NÚT BÚT + POPUP "SỬA NGƯỜI DÙNG" (04/09): hai cột "Đổi vai trò" và "Thao tác" trên bảng gộp
// thành MỘT nút bút — bấm mới thấy đổi vai / vô hiệu / xoá. Chỗ dôi ra dành cho cột "Lớp".
// Các action (setUserRole/disableUser/deleteUser) chỉ revalidate, không redirect → đóng popup
// ngay khi form gửi xong; hàng bảng tự làm mới.
import {useState, useTransition} from 'react';
import {useTranslations} from 'next-intl';
import {Pencil} from 'lucide-react';
import {Popup} from '@/components/ui/Popup';
import {SubmitButton} from '@/components/ui/SubmitButton';
import {XacNhanForm} from '@/components/ui/PopupXacNhan';
import {deleteUser, disableUser, setUserRole} from './actions';
import type {Role} from './user-tabs';

const ROLES = ['admin', 'principal', 'teacher', 'student', 'parent', 'pending'] as const;

export function SuaNguoiDung({
  id,
  who,
  role,
  email,
}: {
  id: string;
  who: string;
  role: Role;
  email: string;
}) {
  const t = useTranslations('admin');
  const tr = useTranslations('roles');
  const [mo, setMo] = useState(false);
  const [dangGui, batDau] = useTransition();

  const goi = (action: (fd: FormData) => Promise<void>) => (fd: FormData) => {
    batDau(async () => {
      await action(fd);
      setMo(false);
    });
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setMo(true)}
        aria-label={t('suaNguoiDung', {name: who})}
        title={t('suaNguoiDung', {name: who})}
        className="cham-44 grid h-8 w-8 cursor-pointer place-items-center rounded-[8px] text-navy transition-colors hover:bg-navy/[0.06] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold"
      >
        <Pencil size={14} strokeWidth={2.5} />
      </button>
      {mo && (
        <Popup title={`${t('suaNguoiDungTitle')}: ${who}`} onClose={() => setMo(false)} width="max-w-[440px]">
          <p className="text-chu-thich font-semibold text-grey-mid">{email}</p>

          {/* Đổi vai trò */}
          <form action={goi(setUserRole)} className="mt-3 flex flex-col gap-2">
            <input type="hidden" name="userId" value={id} />
            <label htmlFor={`vai-${id}`} className="text-nhan font-extrabold uppercase tracking-wide text-grey-mid">
              {t('role')}
            </label>
            <div className="flex flex-wrap items-center gap-2">
              <select
                id={`vai-${id}`}
                name="role"
                defaultValue={role}
                className="ctl-h min-w-0 flex-1 cursor-pointer rounded-[12px] border-[1.5px] border-navy/20 bg-white px-3 text-base font-semibold text-navy focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold sm:text-sm"
              >
                {ROLES.map((r) => (
                  <option key={r} value={r}>
                    {tr(r)}
                  </option>
                ))}
              </select>
              <SubmitButton
                className="min-h-[44px] cursor-pointer rounded-[12px] bg-navy px-4 text-than font-extrabold text-white transition-colors hover:bg-navy/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold disabled:opacity-50"
                wrapClass="contents"
                label={t('setRoleFor', {name: who})}
              >
                {t('luuVaiTro')}
              </SubmitButton>
            </div>
          </form>

          {/* Vùng nguy hiểm: vô hiệu + xoá — mỗi cái hỏi lại bằng hộp xác nhận của app. */}
          <div className="mt-5 border-t border-navy/10 pt-3">
            <p className="text-nhan font-extrabold uppercase tracking-wide text-status-bad">{t('vungNguyHiem')}</p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <XacNhanForm action={goi(disableUser)} hoi={t('confirmDisable', {name: who, role: tr(role)})} nhanDongY={t('disable')} className="contents">
                <input type="hidden" name="userId" value={id} />
                <button
                  type="submit"
                  disabled={dangGui}
                  className="min-h-[44px] cursor-pointer rounded-[12px] border-[1.5px] border-navy/20 bg-white px-4 text-than font-extrabold text-navy transition-colors hover:border-navy focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold disabled:opacity-50"
                >
                  {t('disable')}
                </button>
              </XacNhanForm>
              <XacNhanForm action={goi(deleteUser)} hoi={t('confirmDelete')} nhanDongY={t('deleteFor', {name: who})} nguyHiem className="contents">
                <input type="hidden" name="userId" value={id} />
                <button
                  type="submit"
                  disabled={dangGui}
                  className="min-h-[44px] cursor-pointer rounded-[12px] bg-status-bad/[0.1] px-4 text-than font-extrabold text-status-bad transition-colors hover:bg-status-bad/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold disabled:opacity-50"
                >
                  {t('delete')}
                </button>
              </XacNhanForm>
            </div>
          </div>
        </Popup>
      )}
    </>
  );
}

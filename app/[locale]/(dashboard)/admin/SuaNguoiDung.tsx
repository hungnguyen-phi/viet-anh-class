'use client';

// NÚT BÚT + POPUP "SỬA NGƯỜI DÙNG" (04/09): hai cột "Đổi vai trò" và "Thao tác" trên bảng gộp
// thành MỘT nút bút — bấm mới thấy đổi vai / vô hiệu / xoá. Chỗ dôi ra dành cho cột "Lớp".
// 05/09: thành hộp QUYỀN đủ ba thứ — vai trò · cơ sở · lớp — lưu một lần (capQuyenNguoiDung).
// Ô chọn để UNCONTROLLED (defaultValue): FormData đọc thẳng DOM, state chỉ để ẩn/hiện ô và lọc lớp
// theo cơ sở (ô lớp remount bằng key khi đổi vai/cơ sở).
// Trước đây cơ sở của BGH chỉ gán được bằng SQL, lớp của em/GVCN phải sang màn khác.
import {useMemo, useState, useTransition} from 'react';
import {useTranslations} from 'next-intl';
import {Pencil} from 'lucide-react';
import {Popup} from '@/components/ui/Popup';
import {SubmitButton} from '@/components/ui/SubmitButton';
import {XacNhanForm} from '@/components/ui/PopupXacNhan';
import {capQuyenNguoiDung, deleteUser, disableUser} from './actions';
import type {Role} from './user-tabs';

const ROLES = ['admin', 'principal', 'teacher', 'student', 'parent', 'pending'] as const;

export type DanhMucQuyen = {
  campuses: {id: string; name: string}[];
  classes: {id: string; name: string; campus_id: string; grade_id: string | null}[];
};

const oChon =
  'ctl-h w-full min-w-0 cursor-pointer rounded-[12px] border-[1.5px] border-navy/20 bg-white px-3 text-base font-semibold text-navy focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold sm:text-sm';
const nhan = 'text-nhan font-extrabold uppercase tracking-wide text-grey-mid';

export function SuaNguoiDung({
  id,
  who,
  role,
  email,
  campusId,
  lopId,
  danhMuc,
}: {
  id: string;
  who: string;
  role: Role;
  email: string;
  campusId: string | null;
  /** Lớp hiện tại: học sinh = lớp đang ghi danh; giáo viên = lớp chủ nhiệm. */
  lopId: string | null;
  danhMuc: DanhMucQuyen;
}) {
  const t = useTranslations('admin');
  const tr = useTranslations('roles');
  const [mo, setMo] = useState(false);
  const [dangGui, batDau] = useTransition();
  const [vai, setVai] = useState<Role>(role);
  const [coSo, setCoSo] = useState<string>(campusId ?? '');

  const goi = (action: (fd: FormData) => Promise<void>) => (fd: FormData) => {
    batDau(async () => {
      await action(fd);
      setMo(false);
    });
  };

  // Lớp chỉ có nghĩa với học sinh (ghi danh) và giáo viên (chủ nhiệm); lọc theo cơ sở đã chọn.
  const canLop = vai === 'student' || vai === 'teacher';
  const canCoSo = vai === 'principal' || vai === 'teacher' || vai === 'admin';
  const lopChon = useMemo(
    () => danhMuc.classes.filter((c) => !coSo || c.campus_id === coSo).sort((a, b) => a.name.localeCompare(b.name, 'vi', {numeric: true})),
    [danhMuc.classes, coSo],
  );

  return (
    <>
      <button
        type="button"
        onClick={() => setMo(true)}
        aria-label={t('suaNguoiDung', {name: who})}
        title={t('suaNguoiDung', {name: who})}
        className="grid h-11 w-11 cursor-pointer place-items-center rounded-[12px] text-navy transition-colors hover:bg-navy/[0.06] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold"
      >
        <Pencil size={14} strokeWidth={2.5} />
      </button>
      {mo && (
        <Popup title={`${t('suaNguoiDungTitle')}: ${who}`} onClose={() => setMo(false)} width="max-w-[460px]">
          <p className="text-chu-thich font-semibold text-grey-mid">{email}</p>

          {/* QUYỀN: vai · cơ sở · lớp — một form, một nút Lưu. */}
          <form action={goi(capQuyenNguoiDung)} className="mt-3 flex flex-col gap-3">
            <input type="hidden" name="userId" value={id} />
            <p className={nhan}>{t('quyenTitle')}</p>

            <label className="flex flex-col gap-1">
              <span className="text-chu-thich font-bold text-navy">{t('role')}</span>
              <select name="role" defaultValue={role} onChange={(e) => setVai(e.target.value as Role)} className={oChon}>
                {ROLES.map((r) => (
                  <option key={r} value={r}>
                    {tr(r)}
                  </option>
                ))}
              </select>
            </label>

            {canCoSo && (
              <label className="flex flex-col gap-1">
                <span className="text-chu-thich font-bold text-navy">{t('coSo')}</span>
                <select name="campus_id" defaultValue={campusId ?? ''} onChange={(e) => setCoSo(e.target.value)} className={oChon}>
                  <option value="">{t('coSoChuaGan')}</option>
                  {danhMuc.campuses.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                  {campusId && <option value="__bo__">{t('coSoBoGan')}</option>}
                </select>
                {vai === 'principal' && <span className="text-chu-thich font-semibold text-grey-mid">{t('coSoBghHint')}</span>}
              </label>
            )}

            {canLop && (
              <label className="flex flex-col gap-1">
                <span className="text-chu-thich font-bold text-navy">{vai === 'teacher' ? t('chuNhiemLop') : t('lopHoc')}</span>
                {!canCoSo && danhMuc.campuses.length > 1 && (
                  <select aria-label={t('coSo')} defaultValue={campusId ?? ''} onChange={(e) => setCoSo(e.target.value)} className={oChon}>
                    <option value="">{t('coSoMoi')}</option>
                    {danhMuc.campuses.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                )}
                <select key={`${vai}-${coSo}`} name="class_id" defaultValue={lopId ?? ''} className={oChon}>
                  <option value="">{lopId ? t('lopGiuNguyen') : t('lopKhongGan')}</option>
                  {lopChon.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
                <span className="text-chu-thich font-semibold text-grey-mid">{vai === 'teacher' ? t('chuNhiemHint') : t('lopHocHint')}</span>
              </label>
            )}

            <SubmitButton
              className="min-h-[44px] cursor-pointer self-start rounded-[12px] bg-navy px-4 text-than font-extrabold text-white transition-colors hover:bg-navy/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold disabled:opacity-50"
              wrapClass="contents"
              label={t('setRoleFor', {name: who})}
            >
              {t('luuQuyen')}
            </SubmitButton>
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

'use client';

import {useTranslations} from 'next-intl';
import {UserRound, MailPlus} from 'lucide-react';
import {SubmitButton} from '@/components/ui/SubmitButton';
import {ConfirmButton} from '@/components/ui/ConfirmButton';
import {inviteTeachers, cancelInvite, setTeacherActive} from './actions';

type Teacher = {id: string; full_name: string | null; email: string; role: string; homerooms: string[]};
type Invite = {email: string; created_at: string};

const inp =
  'min-w-0 rounded-[9px] border-[1.5px] border-navy/15 bg-white px-2.5 py-1.5 text-[13px] font-semibold text-navy outline-none transition-all focus:border-navy';
const navyBtn =
  'h-8 shrink-0 cursor-pointer whitespace-nowrap rounded-[9px] bg-navy px-2.5 text-[11.5px] font-extrabold text-white transition-all hover:bg-navy-700';
const ghost =
  'h-8 shrink-0 cursor-pointer whitespace-nowrap rounded-[9px] border-[1.5px] border-navy/20 bg-white px-2.5 text-[11.5px] font-extrabold text-navy transition-all hover:border-navy';
const danger =
  'h-8 shrink-0 cursor-pointer whitespace-nowrap rounded-[9px] bg-[rgba(192,57,43,0.12)] px-2.5 text-[11.5px] font-extrabold text-status-bad transition-all hover:bg-[rgba(192,57,43,0.22)]';

// Quản lý giáo viên trong CƠ SỞ của Hiệu trưởng.
//
// Trước đây HT chỉ có ô chọn GVCN lúc tạo lớp, mà ô đó chỉ hiện người ĐÃ tự đăng nhập Google —
// nên với trường mới nó luôn rỗng và trông như hỏng. Giờ HT tự mời được giáo viên vào cơ sở
// mình, và người được mời sẽ mang sẵn campus_id đúng khi đăng nhập lần đầu.
export function TeacherManager({teachers, invites}: {teachers: Teacher[]; invites: Invite[]}) {
  const t = useTranslations('campusReport');
  const tr = useTranslations('roles');

  const active = teachers.filter((x) => x.role === 'teacher');
  const disabled = teachers.filter((x) => x.role !== 'teacher');

  return (
    <div className="flex flex-col gap-3">
      {/* Mời giáo viên */}
      <form action={inviteTeachers} className="flex flex-wrap items-center gap-1.5">
        <input
          name="email"
          placeholder={t('inviteTeacherPlaceholder')}
          className={`${inp} min-w-[220px] flex-1`}
          required
        />
        <SubmitButton className={navyBtn} wrapClass="inline-flex items-center gap-1.5">
          <MailPlus size={13} strokeWidth={2.5} />
          {t('inviteTeacher')}
        </SubmitButton>
        <p className="w-full text-[11px] italic text-grey-mid">{t('inviteTeacherHint')}</p>
      </form>

      {/* Lời mời chưa dùng */}
      {invites.length > 0 && (
        <div className="rounded-[12px] border-[1.5px] border-dashed border-navy/15 p-2.5">
          <div className="mb-1.5 text-[10px] font-extrabold uppercase tracking-wide text-grey-mid">
            {t('pendingInvites')} ({invites.length})
          </div>
          <div className="flex flex-col gap-1">
            {invites.map((iv) => (
              <div key={iv.email} className="flex items-center gap-2">
                <span className="flex-1 truncate text-[12.5px] font-semibold text-navy">{iv.email}</span>
                <form action={cancelInvite}>
                  <input type="hidden" name="email" value={iv.email} />
                  <SubmitButton className={ghost} wrapClass="contents">
                    {t('cancelInvite')}
                  </SubmitButton>
                </form>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Giáo viên đang hoạt động */}
      <div>
        <div className="mb-1.5 text-[10px] font-extrabold uppercase tracking-wide text-grey-mid">
          {t('teachers')} ({active.length})
        </div>
        <div className="flex flex-col gap-1">
          {active.map((x) => (
            <div key={x.id} className="flex flex-wrap items-center gap-2">
              <UserRound size={13} strokeWidth={2.5} className="shrink-0 text-grey-mid" />
              <span className="text-[13px] font-bold text-navy">{x.full_name ?? x.email}</span>
              <span className="truncate text-[11.5px] font-semibold text-grey-mid">{x.email}</span>
              {x.homerooms.length > 0 && (
                <span className="rounded-full bg-gold/[0.18] px-2 py-0.5 text-[10.5px] font-bold text-navy">
                  {t('homeroomOf')} {x.homerooms.join(', ')}
                </span>
              )}
              <form action={setTeacherActive} className="ml-auto">
                <input type="hidden" name="userId" value={x.id} />
                <input type="hidden" name="active" value="false" />
                {/* Vô hiệu chứ KHÔNG xoá: giữ nguyên lịch sử điểm danh / WIG người này đã ghi. */}
                <ConfirmButton message={t('confirmDisable')} className={danger}>
                  {t('disable')}
                </ConfirmButton>
              </form>
            </div>
          ))}
          {active.length === 0 && (
            <div className="text-[12px] font-semibold text-grey-mid">{t('noTeacher')}</div>
          )}
        </div>
      </div>

      {/* Đã vô hiệu */}
      {disabled.length > 0 && (
        <div>
          <div className="mb-1.5 text-[10px] font-extrabold uppercase tracking-wide text-grey-mid">
            {tr('pending')} ({disabled.length})
          </div>
          <div className="flex flex-col gap-1">
            {disabled.map((x) => (
              <div key={x.id} className="flex flex-wrap items-center gap-2 opacity-70">
                <UserRound size={13} strokeWidth={2.5} className="shrink-0 text-grey-mid" />
                <span className="text-[13px] font-bold text-navy">{x.full_name ?? x.email}</span>
                <span className="truncate text-[11.5px] font-semibold text-grey-mid">{x.email}</span>
                <form action={setTeacherActive} className="ml-auto">
                  <input type="hidden" name="userId" value={x.id} />
                  <input type="hidden" name="active" value="true" />
                  <SubmitButton className={ghost} wrapClass="contents">
                    {t('restore')}
                  </SubmitButton>
                </form>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

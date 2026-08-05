import {Suspense} from 'react';
import {getTranslations} from 'next-intl/server';
import {SubmitButton} from '@/components/ui/SubmitButton';
import {schoolYearLabel} from '@/lib/dates';
import {assignGvcn, inviteUser} from './actions';
import {layDanhMuc} from './admin-data';
import {CampusForm} from './CampusForm';
import {ClassForm} from './ClassForm';
import {CreateMenu} from './CreateMenu';
import {InviteEmailsField} from './InviteEmailsField';
import {ParentFormLoader} from './ParentFormLoader';

const INVITE_ROLES = ['teacher', 'principal', 'admin', 'student'] as const;

const inputCls =
  'w-full rounded-[10px] border-[1.5px] border-navy/15 bg-white px-3 py-2 text-sm font-semibold text-navy outline-none transition-all focus:border-navy';
const goldBtn =
  'btn-gold inline-flex h-11 cursor-pointer items-center self-start whitespace-nowrap rounded-[12px] px-3.5 text-[12.5px] font-extrabold transition-all';

// Nút "Tạo mới" + năm form bên trong nó.
//
// Tách khỏi page.tsx để nút này chảy về theo nhịp riêng: nó cần danh mục cơ sở/lớp/nhân sự, còn
// bảng người dùng thì không — không có lý do gì bắt bảng chờ nó.
// Dữ liệu lấy qua layDanhMuc() có cache(), nên cây Cơ sở ở giữa trang dùng lại đúng kết quả này
// chứ không hỏi Supabase lần thứ hai.
export async function CreateMenuLoader({revision}: {revision: string}) {
  const t = await getTranslations('admin');
  const tr = await getTranslations('roles');
  const tcommon = await getTranslations('common');
  const {allCampuses, allGrades, allClasses, staffList} = await layDanhMuc();

  const activeCampuses = allCampuses.filter((c) => c.is_active);
  const activeGrades = allGrades.filter((g) => g.is_active);
  const activeClasses = allClasses.filter((c) => c.is_active);
  const campusOptions = activeCampuses.map((c) => ({id: c.id, name: c.name}));
  const gradeOptions = activeGrades.map((g) => ({id: g.id, name: g.name, campus_id: g.campus_id}));
  const teacherName = new Map(staffList.map((p) => [p.id, p.full_name ?? p.email]));

  // GHI KÈM GVCN ĐANG CÓ. Mời một giáo viên vào lớp đã có chủ nhiệm từng ÂM THẦM cướp lớp của
  // người đang dạy (đã chặn ở CSDL từ 0082). Nhưng chặn thôi chưa đủ: người mời vẫn cần biết ghế
  // ấy có người, nếu không họ mời xong rồi ngồi đợi một chuyện sẽ không xảy ra.
  const nhanLop = (c: (typeof activeClasses)[number]) => {
    const gv = c.homeroom_teacher_id ? teacherName.get(c.homeroom_teacher_id) : null;
    return `${c.name} · ${c.school_year}${gv ? ` · ${t('alreadyHasGvcn', {name: gv})}` : ''}`;
  };

  return (
    <CreateMenu
      revision={revision}
      campusForm={<CampusForm />}
      classForm={
        <ClassForm
          campuses={campusOptions}
          grades={gradeOptions}
          teachers={staffList}
          defaultYear={schoolYearLabel(new Date())}
        />
      }
      inviteForm={
        <form action={inviteUser} className="flex flex-col gap-2">
          {/* <textarea> không có kiểm tra định dạng sẵn của trình duyệt, mà ô này nhận NHIỀU email
              nên cũng không đổi sang <input type="email"> được. Dùng pattern qua InviteEmailsField
              (client) để báo lỗi ngay tại ô thay vì phải gửi lên server rồi tải lại trang mới biết. */}
          <InviteEmailsField
            name="email"
            placeholder={t('emailsMulti')}
            ariaLabel={t('emailsMulti')}
            className={`${inputCls} min-h-[44px] resize-y`}
          />
          <select
            name="role"
            aria-label={t('selectRole')}
            required
            defaultValue=""
            className={`cursor-pointer ${inputCls}`}
          >
            <option value="" disabled>
              {t('selectRole')}
            </option>
            {INVITE_ROLES.map((r) => (
              <option key={r} value={r}>
                {tr(r)}
              </option>
            ))}
          </select>
          <select
            name="class_id"
            aria-label={t('selectClass')}
            defaultValue=""
            className={`cursor-pointer ${inputCls}`}
          >
            <option value="">{t('classNone')}</option>
            {activeClasses.map((c) => (
              <option key={c.id} value={c.id}>
                {nhanLop(c)}
              </option>
            ))}
          </select>
          <SubmitButton className={goldBtn} wrapClass="contents">
            + {t('inviteUser')}
          </SubmitButton>
          <div className="text-[10.5px] font-semibold italic text-grey-mid">{t('applyNote')}</div>
        </form>
      }
      assignForm={
        <form action={assignGvcn} className="flex flex-col gap-2">
          <select
            name="userId"
            aria-label={t('selectUser')}
            required
            defaultValue=""
            className={`cursor-pointer ${inputCls}`}
          >
            <option value="" disabled>
              {t('selectUser')}
            </option>
            {staffList.map((p) => (
              <option key={p.id} value={p.id}>
                {p.full_name ?? p.email}
              </option>
            ))}
          </select>
          <select
            name="class_id"
            aria-label={t('selectClass')}
            required
            defaultValue=""
            className={`cursor-pointer ${inputCls}`}
          >
            <option value="" disabled>
              {t('selectClass')}
            </option>
            {activeClasses.map((c) => (
              <option key={c.id} value={c.id}>
                {nhanLop(c)}
              </option>
            ))}
          </select>
          <SubmitButton className={goldBtn} wrapClass="contents">
            {t('assignGvcn')}
          </SubmitButton>
        </form>
      }
      parentForm={
        <Suspense
          fallback={
            <div className="py-4 text-center text-[12.5px] font-semibold text-grey-mid">
              {tcommon('loading')}
            </div>
          }
        >
          <ParentFormLoader />
        </Suspense>
      }
    />
  );
}

// Chỗ giữ đúng kích thước nút thật, để tiêu đề trang không nhảy sang phải khi nút hiện ra.
export function CreateMenuSkeleton() {
  return <div className="h-11 w-[124px] rounded-[12px] bg-gold/40" aria-hidden />;
}

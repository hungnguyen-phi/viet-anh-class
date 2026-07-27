import {getTranslations, setRequestLocale} from 'next-intl/server';
import {requireRole} from '@/lib/auth';
import {createClient} from '@/lib/supabase/server';
import {schoolYearLabel} from '@/lib/dates';
import {
  assignGvcn,
  deleteUser,
  disableUser,
  inviteUser,
  setUserRole,
  setCampusActive,
  setGradeActive,
  setClassActive,
} from './actions';
import {ConfirmButton} from '@/components/ui/ConfirmButton';
import {SubmitButton} from '@/components/ui/SubmitButton';
import {CampusForm} from './CampusForm';
import {ClassForm} from './ClassForm';
import {ParentForm} from './ParentForm';
import {headers} from 'next/headers';
import {CampusCard} from './CampusCard';
import {ClassManager} from './ClassManager';
import {AreaConfigForm} from './AreaConfigForm';
import {SchoolNetworkManager} from './SchoolNetworkManager';
import {AREAS, buildAreaMeta} from '@/lib/areas';
import {clientIp} from '@/lib/ip';
import {Link} from '@/i18n/navigation';

const ROLES = ['admin', 'principal', 'teacher', 'student', 'parent', 'pending'] as const;
const INVITE_ROLES = ['teacher', 'principal', 'admin', 'student'] as const;

export default async function AdminPage({
  params,
  searchParams,
}: {
  params: Promise<{locale: string}>;
  searchParams: Promise<{flash?: string; q?: string; upage?: string}>;
}) {
  const {locale} = await params;
  const {flash, q: qRaw, upage: upageRaw} = await searchParams;
  setRequestLocale(locale);
  const me = await requireRole(['admin']);
  const t = await getTranslations('admin');
  const tr = await getTranslations('roles');
  const tn = await getTranslations('nav');
  const tcommon = await getTranslations('common');
  const supabase = await createClient();

  const screens = [
    {href: '/', label: tn('scoreboard'), desc: 'Trang lớp: bảng điểm, xếp hạng, donut WIG'},
    {href: '/attendance', label: tn('attendance'), desc: 'Điểm danh hằng ngày (realtime, tick cả lớp)'},
    {href: '/roster', label: tn('roster'), desc: 'Danh sách lớp + gán trưởng điểm danh'},
    {href: '/wig', label: tn('wig'), desc: 'Thiết lập WIG năm → tuần → lead measure'},
    {href: '/meeting', label: tn('meeting'), desc: 'Biên bản họp WIG tuần'},
    {href: '/report', label: tn('report'), desc: 'Báo cáo phụ huynh (chỉ con mình)'},
    {href: '/campus', label: tn('campus'), desc: 'Báo cáo cơ sở (BGH)'},
    {href: '/admin', label: tn('admin'), desc: 'Trang quản trị (màn hình này)'},
    {href: '/login', label: tcommon('login'), desc: 'Màn hình đăng nhập (đăng xuất để xem)'},
  ];

  // Phân trang + tìm kiếm bảng người dùng (tránh load TOÀN BỘ PII trong 1 payload).
  const PAGE = 50;
  // Loại ký tự phá cú pháp filter PostgREST (,()*) để chống injection ở .or().
  const q = (qRaw ?? '').replace(/[,()*%]/g, '').trim();
  const upage = Math.max(1, Number(upageRaw) || 1);
  const fromIdx = (upage - 1) * PAGE;

  let usersQuery = supabase
    .from('profiles')
    .select('id, full_name, email, role', {count: 'exact'})
    .order('email')
    .range(fromIdx, fromIdx + PAGE - 1);
  if (q) usersQuery = usersQuery.or(`email.ilike.%${q}%,full_name.ilike.%${q}%`);

  const [
    {data: pageUsers, count: usersTotal},
    {data: staff},
    {data: students},
    {data: campuses},
    {data: grades},
    {data: classes},
    {data: grants},
    {data: invites},
    {data: areaCfg},
    {data: networks},
  ] = await Promise.all([
    usersQuery,
    supabase
      .from('profiles')
      .select('id, full_name, email')
      .in('role', ['teacher', 'principal', 'admin'])
      .order('email')
      .limit(500),
    supabase.from('profiles').select('id, full_name, email').eq('role', 'student').order('email').limit(1000),
    supabase.from('campuses').select('id, name, code, is_active, level').order('name'),
    supabase.from('grades').select('id, name, campus_id, sort_order, is_active').order('sort_order'),
    supabase
      .from('classes')
      .select('id, name, school_year, grade, grade_id, campus_id, homeroom_teacher_id, is_active')
      .order('name'),
    supabase.from('pending_user_grants').select('email, role, class_id').order('created_at'),
    supabase.from('parent_invitations').select('email, student_id, status').order('created_at'),
    supabase.from('area_config').select('*').order('sort_order'),
    supabase.from('school_networks').select('id, label, cidr, campus_id, is_active').order('created_at'),
  ]);
  const currentIp = clientIp(await headers());

  const rows = pageUsers ?? [];
  const total = usersTotal ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE));
  const staffList = staff ?? [];
  const studentList = students ?? [];
  const allCampuses = campuses ?? [];
  const allGrades = grades ?? [];
  const allClasses = classes ?? [];
  const campusName = new Map(allCampuses.map((c) => [c.id, c.name]));
  // Tên người: gộp từ staff + students + trang hiện tại (đủ cho hiển thị GVCN lớp & lời mời).
  const personName = new Map(
    [...staffList, ...studentList, ...rows].map((p) => [p.id, p.full_name ?? p.email]),
  );
  const className = new Map(allClasses.map((c) => [c.id, c.name]));

  // Tách active / đã-lưu-trữ + gom khối theo cơ sở, đếm lớp theo cơ sở.
  const activeCampuses = allCampuses.filter((c) => c.is_active);
  const archivedCampuses = allCampuses.filter((c) => !c.is_active);
  const activeGrades = allGrades.filter((g) => g.is_active);
  const archivedGrades = allGrades.filter((g) => !g.is_active);
  const activeClasses = allClasses.filter((c) => c.is_active);
  const archivedClasses = allClasses.filter((c) => !c.is_active);
  const gradesByCampus = new Map<string, typeof activeGrades>();
  for (const g of activeGrades) {
    const arr = gradesByCampus.get(g.campus_id) ?? [];
    arr.push(g);
    gradesByCampus.set(g.campus_id, arr);
  }
  const classCountByCampus = new Map<string, number>();
  for (const c of activeClasses) {
    classCountByCampus.set(c.campus_id, (classCountByCampus.get(c.campus_id) ?? 0) + 1);
  }
  // Options cho ClassForm/ClassManager (chỉ cơ sở & khối đang hoạt động).
  const campusOptions = activeCampuses.map((c) => ({id: c.id, name: c.name}));
  const gradeOptions = activeGrades.map((g) => ({id: g.id, name: g.name, campus_id: g.campus_id}));
  // Cho form SỬA lớp: gồm cả khối đã lưu-trữ (kèm cờ is_active) để không âm thầm mất khối
  // khi lớp đang gắn 1 khối đã archive (audit #3).
  const allGradeOptions = allGrades.map((g) => ({
    id: g.id,
    name: g.name,
    campus_id: g.campus_id,
    is_active: g.is_active,
  }));
  // Cấu hình 4 lĩnh vực 4DX (Môn) — fallback = giá trị hiện tại nếu thiếu row.
  const areaMeta = buildAreaMeta(areaCfg);
  const areaRows = AREAS.map((a) => ({area: a, meta: areaMeta[a]}));
  const pendingInvites = [
    ...(grants ?? []).map((g) => ({
      email: g.email,
      detail: `${tr(g.role)}${g.class_id ? ` · ${className.get(g.class_id) ?? ''}` : ''}`,
    })),
    ...(invites ?? [])
      .filter((i) => i.status === 'pending')
      .map((i) => ({
        email: i.email,
        detail: `${tr('parent')} · ${personName.get(i.student_id) ?? ''}`,
      })),
  ];
  const defaultYear = schoolYearLabel(new Date());

  // Design system v3 — glass on gradient
  const inputCls =
    'w-full rounded-[10px] border-[1.5px] border-navy/15 bg-white px-3 py-2 text-sm font-semibold text-navy outline-none transition-all focus:border-navy';
  const goldBtn =
    'btn-gold inline-flex h-11 cursor-pointer items-center self-start whitespace-nowrap rounded-[12px] px-3.5 text-[12.5px] font-extrabold transition-all';
  const cardTitle = 'mb-3 font-display text-[15px] font-bold text-navy';
  const th = 'text-[11px] font-extrabold uppercase tracking-wide text-grey-mid';
  const selectSm =
    'min-w-0 flex-1 cursor-pointer rounded-[10px] border-[1.5px] border-navy/15 bg-white/65 px-2.5 py-[7px] text-xs font-semibold text-navy outline-none transition-all focus:border-navy focus:bg-white';
  const navyBtnSm =
    'h-8 cursor-pointer whitespace-nowrap rounded-[10px] bg-navy px-[11px] text-[11.5px] font-extrabold text-white transition-all hover:bg-navy-700';
  const outlineBtnSm =
    'h-8 cursor-pointer whitespace-nowrap rounded-[10px] border-[1.5px] border-navy/20 bg-white/60 px-2.5 text-[11.5px] font-extrabold text-navy transition-all hover:border-navy';
  const dangerBtnSm =
    'h-8 cursor-pointer whitespace-nowrap rounded-[10px] bg-[rgba(192,57,43,0.12)] px-2.5 text-[11.5px] font-extrabold text-status-bad transition-all hover:bg-[rgba(192,57,43,0.22)]';

  return (
    <div className="flex flex-col gap-4">
      <h1 className="font-display text-[22px] font-bold text-navy">{t('title')}</h1>

      {flash && (
        <div className="rounded-[14px] border border-success/30 bg-success/10 px-4 py-2.5 text-sm font-bold text-success">
          {flash}
        </div>
      )}

      {/* Người dùng + đổi vai trò */}
      <section className="glass rounded-[20px] p-[18px]">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div className="font-display text-[15px] font-bold text-navy">
            {t('users')} ({total})
          </div>
          <form method="get" className="flex items-center gap-1.5">
            <input
              name="q"
              defaultValue={q}
              placeholder={t('searchUser')}
              className="h-10 w-[200px] rounded-[10px] border-[1.5px] border-navy/15 bg-white px-3 text-[12.5px] font-semibold text-navy outline-none focus:border-navy"
            />
            <button type="submit" className={`${navyBtnSm} h-10`}>
              {t('search')}
            </button>
            {q && (
              <Link href="/admin" className={outlineBtnSm}>
                {t('clear')}
              </Link>
            )}
          </form>
        </div>
        <div className="overflow-x-auto rounded-[14px] border-[1.5px] border-navy/10">
          <div className="box-border flex min-w-[760px] items-center gap-2 bg-navy/[0.03] px-[14px] py-[9px]">
            <span className={`flex-[1.2] ${th}`}>{t('name')}</span>
            <span className={`flex-[1.4] ${th}`}>{t('email')}</span>
            <span className={`flex-1 ${th}`}>{t('role')}</span>
            <span className={`flex-[1.6] ${th}`}>{t('setRole')}</span>
            <span className={`w-[130px] flex-none ${th}`}>{t('actions')}</span>
          </div>
          {rows.map((p) => (
            <div
              key={p.id}
              className="box-border flex min-w-[760px] items-center gap-2 border-t border-navy/[0.08] px-[14px] py-2 transition-colors hover:bg-navy/[0.03]"
            >
              <span className="min-w-0 flex-[1.2] truncate text-[13px] font-bold text-navy">
                {p.full_name ?? '—'}
              </span>
              <span className="min-w-0 flex-[1.4] truncate text-xs font-semibold text-grey-mid">
                {p.email}
              </span>
              <span className="flex-1 whitespace-nowrap text-[12.5px] font-bold text-navy">
                {tr(p.role)}
              </span>
              <span className="flex-[1.6]">
                <form action={setUserRole} className="flex items-center gap-1.5">
                  <input type="hidden" name="userId" value={p.id} />
                  <select name="role" defaultValue={p.role} className={selectSm}>
                    {ROLES.map((r) => (
                      <option key={r} value={r}>
                        {tr(r)}
                      </option>
                    ))}
                  </select>
                  <button type="submit" className={navyBtnSm}>
                    {t('setRole')}
                  </button>
                </form>
              </span>
              <span className="flex w-[130px] flex-none gap-1.5">
                {p.id !== me.id ? (
                  <>
                    <form action={disableUser}>
                      <input type="hidden" name="userId" value={p.id} />
                      <button type="submit" className={outlineBtnSm}>
                        {t('disable')}
                      </button>
                    </form>
                    <form action={deleteUser}>
                      <input type="hidden" name="userId" value={p.id} />
                      <ConfirmButton message={t('confirmDelete')} className={dangerBtnSm}>
                        {t('delete')}
                      </ConfirmButton>
                    </form>
                  </>
                ) : (
                  <span className="text-xs text-grey-mid">{t('none')}</span>
                )}
              </span>
            </div>
          ))}
          {rows.length === 0 && (
            <div className="border-t border-navy/[0.08] px-[14px] py-3 text-[13px] text-grey-mid">
              {t('none')}
            </div>
          )}
        </div>
        {/* Phân trang */}
        {totalPages > 1 && (
          <div className="mt-3 flex items-center justify-center gap-2 text-[12.5px] font-bold text-navy">
            {upage > 1 && (
              <Link
                href={{pathname: '/admin', query: {...(q ? {q} : {}), upage: upage - 1}}}
                className={outlineBtnSm}
              >
                ← {t('prev')}
              </Link>
            )}
            <span className="text-grey-mid">
              {upage} / {totalPages}
            </span>
            {upage < totalPages && (
              <Link
                href={{pathname: '/admin', query: {...(q ? {q} : {}), upage: upage + 1}}}
                className={outlineBtnSm}
              >
                {t('next')} →
              </Link>
            )}
          </div>
        )}
      </section>

      {/* Tạo cơ sở · Tạo lớp · Mời người dùng · Phân công GVCN · Mời phụ huynh */}
      <div className="grid items-start gap-4 [grid-template-columns:repeat(auto-fit,minmax(340px,1fr))]">
        {/* Tạo cơ sở */}
        <section className="glass rounded-[20px] p-[18px]">
          <div className={cardTitle}>{t('createCampus')}</div>
          <CampusForm />
          <p className="mt-2.5 text-[11px] font-semibold italic text-grey-mid">{t('manageBelowHint')}</p>
        </section>

        {/* Tạo lớp */}
        <section className="glass rounded-[20px] p-[18px]">
          <div className={cardTitle}>{t('createClass')}</div>
          <ClassForm
            campuses={campusOptions}
            grades={gradeOptions}
            teachers={staffList}
            defaultYear={defaultYear}
          />
        </section>

        {/* Mời người dùng mới */}
        <section className="glass rounded-[20px] p-[18px]">
          <div className={cardTitle}>{t('inviteUser')}</div>
          <form action={inviteUser} className="flex flex-col gap-2">
            <textarea
              name="email"
              placeholder={t('emailsMulti')}
              required
              rows={2}
              className={`${inputCls} min-h-[44px] resize-y`}
            />
            <select name="role" required defaultValue="" className={`cursor-pointer ${inputCls}`}>
              <option value="" disabled>
                — {t('selectRole')} —
              </option>
              {INVITE_ROLES.map((r) => (
                <option key={r} value={r}>
                  {tr(r)}
                </option>
              ))}
            </select>
            <select name="class_id" defaultValue="" className={`cursor-pointer ${inputCls}`}>
              <option value="">
                — {t('selectClass')} ({t('none')}) —
              </option>
              {activeClasses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} · {c.school_year}
                </option>
              ))}
            </select>
            <SubmitButton className={goldBtn} wrapClass="contents">
              + {t('inviteUser')}
            </SubmitButton>
            <div className="text-[10.5px] font-semibold italic text-grey-mid">{t('applyNote')}</div>
          </form>
        </section>

        {/* Phân công GVCN */}
        <section className="glass rounded-[20px] p-[18px]">
          <div className={cardTitle}>{t('assignGvcn')}</div>
          <form action={assignGvcn} className="flex flex-col gap-2">
            <select name="userId" required defaultValue="" className={`cursor-pointer ${inputCls}`}>
              <option value="" disabled>
                — {t('selectUser')} —
              </option>
              {staffList.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.full_name ?? p.email}
                </option>
              ))}
            </select>
            <select name="class_id" required defaultValue="" className={`cursor-pointer ${inputCls}`}>
              <option value="" disabled>
                — {t('selectClass')} —
              </option>
              {activeClasses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} · {c.school_year}
                </option>
              ))}
            </select>
            <SubmitButton className={goldBtn} wrapClass="contents">
              {t('assignGvcn')}
            </SubmitButton>
          </form>
        </section>

        {/* Mời phụ huynh */}
        <section className="glass rounded-[20px] p-[18px]">
          <div className={cardTitle}>{t('inviteParent')}</div>
          <ParentForm students={studentList} />
        </section>
      </div>

      {/* Cơ sở & Khối — quản lý sửa/lưu-trữ/xoá, khối lồng bên trong mỗi cơ sở */}
      <section className="glass rounded-[20px] p-[18px]">
        <div className={cardTitle}>
          {t('manageCampusGrade')} ({activeCampuses.length})
        </div>
        {activeCampuses.length === 0 ? (
          <div className="rounded-[12px] border-[1.5px] border-navy/10 px-[13px] py-[9px] text-[13px] text-grey-mid">
            {t('none')}
          </div>
        ) : (
          <div className="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(300px,1fr))]">
            {activeCampuses.map((c) => (
              <CampusCard
                key={c.id}
                campus={{id: c.id, name: c.name, code: c.code, level: c.level}}
                grades={(gradesByCampus.get(c.id) ?? []).map((g) => ({
                  id: g.id,
                  name: g.name,
                  sort_order: g.sort_order,
                }))}
                classCount={classCountByCampus.get(c.id) ?? 0}
              />
            ))}
          </div>
        )}
      </section>

      {/* Lớp — quản lý sửa/lưu-trữ/xoá + mở trang chi tiết */}
      <section className="glass rounded-[20px] p-[18px]">
        <ClassManager
          classes={activeClasses.map((c) => ({
            id: c.id,
            name: c.name,
            grade_id: c.grade_id,
            grade: c.grade,
            school_year: c.school_year,
            campus_id: c.campus_id,
            homeroom_teacher_id: c.homeroom_teacher_id,
          }))}
          campuses={campusOptions}
          grades={allGradeOptions}
          teachers={staffList}
        />
      </section>

      {/* Lời mời đang chờ */}
      {pendingInvites.length > 0 && (
        <section className="glass rounded-[20px] p-[18px]">
          <div className={cardTitle}>
            {t('pending')} ({pendingInvites.length})
          </div>
          <div className="rounded-[12px] border-[1.5px] border-navy/10">
            {pendingInvites.map((p, i) => (
              <div
                key={`${p.email}-${i}`}
                className={`flex items-center justify-between px-[13px] py-[9px] text-[13px] ${
                  i > 0 ? 'border-t border-navy/[0.08]' : ''
                }`}
              >
                <span className="font-bold text-navy">{p.email}</span>
                <span className="font-semibold text-grey-mid">{p.detail}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Môn — cấu hình 4 lĩnh vực 4DX (nhãn/màu/icon/đơn vị) */}
      <section className="glass rounded-[20px] p-[18px]">
        <div className={cardTitle}>{t('manageAreas')}</div>
        <p className="mb-3 text-xs text-grey-mid">{t('areasHint')}</p>
        <AreaConfigForm rows={areaRows} />
      </section>

      {/* Điểm danh & Wifi trường — cổng IP cho check-in cảm xúc */}
      <section className="glass rounded-[20px] p-[18px]">
        <div className={cardTitle}>{t('networkTitle')}</div>
        <SchoolNetworkManager
          networks={networks ?? []}
          campuses={campusOptions}
          currentIp={currentIp}
        />
      </section>

      {/* Đã lưu trữ — khôi phục Cơ sở / Khối / Lớp */}
      {archivedCampuses.length + archivedGrades.length + archivedClasses.length > 0 && (
        <section className="glass rounded-[20px] p-[18px]">
          <div className={cardTitle}>
            {t('archived')} ({archivedCampuses.length + archivedGrades.length + archivedClasses.length})
          </div>
          <div className="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(260px,1fr))]">
            <ArchivedCol
              label={t('campuses')}
              restoreLabel={t('restore')}
              emptyLabel={t('none')}
              rows={archivedCampuses.map((c) => ({id: c.id, label: c.name, sub: c.code}))}
              action={setCampusActive}
            />
            <ArchivedCol
              label={t('grades')}
              restoreLabel={t('restore')}
              emptyLabel={t('none')}
              rows={archivedGrades.map((g) => ({
                id: g.id,
                label: g.name,
                sub: campusName.get(g.campus_id) ?? '',
              }))}
              action={setGradeActive}
            />
            <ArchivedCol
              label={t('classes')}
              restoreLabel={t('restore')}
              emptyLabel={t('none')}
              rows={archivedClasses.map((c) => ({
                id: c.id,
                label: c.name,
                sub: campusName.get(c.campus_id) ?? '',
              }))}
              action={setClassActive}
            />
          </div>
        </section>
      )}

      {/* Giao diện mẫu — mở mọi màn hình */}
      <section className="glass rounded-[20px] p-[18px]">
        <div className="mb-1 font-display text-[15px] font-bold text-navy">{t('screensTitle')}</div>
        <p className="mb-3 text-xs text-grey-mid">{t('screensHint')}</p>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {screens.map((s) => (
            <Link
              key={s.href}
              href={s.href}
              className="glass glass-hover block cursor-pointer rounded-[14px] p-3.5"
            >
              <div className="flex items-center justify-between">
                <span className="font-display text-[15px] font-bold text-navy">{s.label}</span>
                <span className="text-xs font-extrabold text-gold-deep">{tcommon('open')} →</span>
              </div>
              <p className="mt-1 text-xs text-grey-mid">{s.desc}</p>
              <code className="mt-1 block text-[11px] text-grey-mid">{s.href}</code>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}

// Cột "Đã lưu trữ" cho 1 loại (cơ sở/khối/lớp) — mỗi dòng có nút Khôi phục (server action).
function ArchivedCol({
  label,
  restoreLabel,
  emptyLabel,
  rows,
  action,
}: {
  label: string;
  restoreLabel: string;
  emptyLabel: string;
  rows: {id: string; label: string; sub: string}[];
  action: (formData: FormData) => void | Promise<void>;
}) {
  return (
    <div>
      <div className="mb-1.5 text-[10px] font-extrabold uppercase tracking-wide text-grey-mid">
        {label} ({rows.length})
      </div>
      <div className="rounded-[12px] border-[1.5px] border-navy/10">
        {rows.map((r, i) => (
          <div
            key={r.id}
            className={`flex items-center justify-between gap-2 px-3 py-2 ${
              i > 0 ? 'border-t border-navy/[0.08]' : ''
            }`}
          >
            <div className="min-w-0">
              <div className="truncate text-[13px] font-bold text-navy">{r.label}</div>
              {r.sub && <div className="truncate text-[11px] font-semibold text-grey-mid">{r.sub}</div>}
            </div>
            <form action={action}>
              <input type="hidden" name="id" value={r.id} />
              <input type="hidden" name="active" value="true" />
              <button
                type="submit"
                className="h-8 shrink-0 cursor-pointer whitespace-nowrap rounded-[9px] bg-navy px-2.5 text-[11.5px] font-extrabold text-white transition-all hover:bg-navy-700"
              >
                {restoreLabel}
              </button>
            </form>
          </div>
        ))}
        {rows.length === 0 && <div className="px-3 py-2 text-[12px] text-grey-mid">{emptyLabel}</div>}
      </div>
    </div>
  );
}

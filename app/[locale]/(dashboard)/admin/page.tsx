import {getTranslations, setRequestLocale} from 'next-intl/server';
import {requireRole} from '@/lib/auth';
import {createClient} from '@/lib/supabase/server';
import {schoolYearLabel} from '@/lib/dates';
import {
  assignGvcn,
  createCampus,
  createClass,
  deleteUser,
  disableUser,
  inviteParent,
  inviteUser,
  setUserRole,
} from './actions';
import {ConfirmButton} from '@/components/ui/ConfirmButton';
import {Link} from '@/i18n/navigation';

const ROLES = ['admin', 'principal', 'teacher', 'student', 'parent', 'pending'] as const;
const INVITE_ROLES = ['teacher', 'principal', 'admin', 'student'] as const;

export default async function AdminPage({
  params,
  searchParams,
}: {
  params: Promise<{locale: string}>;
  searchParams: Promise<{flash?: string}>;
}) {
  const {locale} = await params;
  const {flash} = await searchParams;
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
    {href: '/guide', label: tcommon('guide'), desc: 'Hướng dẫn sử dụng app'},
    {href: '/login', label: tcommon('login'), desc: 'Màn hình đăng nhập (đăng xuất để xem)'},
  ];

  const [{data: profiles}, {data: campuses}, {data: classes}, {data: grants}, {data: invites}] =
    await Promise.all([
      supabase.from('profiles').select('id, full_name, email, role').order('email'),
      supabase.from('campuses').select('id, name, code').order('name'),
      supabase
        .from('classes')
        .select('id, name, school_year, grade, campus_id, homeroom_teacher_id')
        .order('name'),
      supabase.from('pending_user_grants').select('email, role, class_id').order('created_at'),
      supabase.from('parent_invitations').select('email, student_id, status').order('created_at'),
    ]);

  const all = profiles ?? [];
  const staff = all.filter((p) => ['teacher', 'principal', 'admin'].includes(p.role));
  const students = all.filter((p) => p.role === 'student');
  const campusName = new Map((campuses ?? []).map((c) => [c.id, c.name]));
  const personName = new Map(all.map((p) => [p.id, p.full_name ?? p.email]));
  const className = new Map((classes ?? []).map((c) => [c.id, c.name]));
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
    'w-full rounded-[10px] border-[1.5px] border-navy/15 bg-white/65 px-3 py-2 text-sm font-semibold text-navy outline-none transition-all focus:border-navy focus:bg-white';
  const goldBtn =
    'btn-gold inline-flex h-[38px] cursor-pointer items-center self-start whitespace-nowrap rounded-[12px] px-3.5 text-[12.5px] font-extrabold transition-all';
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
        <div className={cardTitle}>
          {t('users')} ({all.length})
        </div>
        <div className="overflow-x-auto rounded-[14px] border-[1.5px] border-navy/10">
          <div className="box-border flex min-w-[760px] items-center gap-2 bg-white/45 px-[14px] py-[9px]">
            <span className={`flex-[1.2] ${th}`}>{t('name')}</span>
            <span className={`flex-[1.4] ${th}`}>{t('email')}</span>
            <span className={`flex-1 ${th}`}>{t('role')}</span>
            <span className={`flex-[1.6] ${th}`}>{t('setRole')}</span>
            <span className={`w-[130px] flex-none ${th}`}>{t('actions')}</span>
          </div>
          {all.map((p) => (
            <div
              key={p.id}
              className="box-border flex min-w-[760px] items-center gap-2 border-t border-navy/[0.08] px-[14px] py-2 transition-colors hover:bg-white/35"
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
        </div>
      </section>

      {/* Tạo cơ sở · Tạo lớp · Mời người dùng · Phân công GVCN · Mời phụ huynh */}
      <div className="grid items-start gap-4 [grid-template-columns:repeat(auto-fit,minmax(340px,1fr))]">
        {/* Tạo cơ sở + danh sách */}
        <section className="glass rounded-[20px] p-[18px]">
          <div className={cardTitle}>{t('createCampus')}</div>
          <form action={createCampus} className="flex flex-wrap items-center gap-2">
            <input
              name="name"
              placeholder={t('name')}
              required
              className="min-w-[140px] flex-1 rounded-[10px] border-[1.5px] border-navy/15 bg-white/65 px-3 py-2 text-sm font-semibold text-navy outline-none transition-all focus:border-navy focus:bg-white"
            />
            <input
              name="code"
              placeholder={t('code')}
              required
              className="w-[90px] rounded-[10px] border-[1.5px] border-navy/15 bg-white/65 px-3 py-2 text-sm font-semibold text-navy outline-none transition-all focus:border-navy focus:bg-white"
            />
            <button type="submit" className={goldBtn}>
              + {t('createCampus')}
            </button>
          </form>
          <div className="mb-1.5 mt-3.5 text-[10px] font-extrabold uppercase tracking-wide text-grey-mid">
            {t('campuses')} ({(campuses ?? []).length})
          </div>
          <div className="rounded-[12px] border-[1.5px] border-navy/10">
            {(campuses ?? []).map((c, i) => (
              <div
                key={c.id}
                className={`flex justify-between px-[13px] py-[9px] text-[13px] ${
                  i > 0 ? 'border-t border-navy/[0.08]' : ''
                }`}
              >
                <span className="font-bold text-navy">{c.name}</span>
                <span className="font-semibold text-grey-mid">{c.code}</span>
              </div>
            ))}
            {(campuses ?? []).length === 0 && (
              <div className="px-[13px] py-[9px] text-[13px] text-grey-mid">{t('none')}</div>
            )}
          </div>
        </section>

        {/* Tạo lớp */}
        <section className="glass rounded-[20px] p-[18px]">
          <div className={cardTitle}>{t('createClass')}</div>
          <form action={createClass} className="flex flex-col gap-2">
            <div className="flex gap-2">
              <input name="name" placeholder={t('name')} required className={inputCls} />
              <input
                name="grade"
                placeholder={t('grade')}
                className="w-20 rounded-[10px] border-[1.5px] border-navy/15 bg-white/65 px-3 py-2 text-sm font-semibold text-navy outline-none transition-all focus:border-navy focus:bg-white"
              />
            </div>
            <input
              name="school_year"
              defaultValue={defaultYear}
              placeholder={t('schoolYear')}
              required
              className={inputCls}
            />
            <select name="campus_id" required defaultValue="" className={`cursor-pointer ${inputCls}`}>
              <option value="" disabled>
                — {t('campus')} —
              </option>
              {(campuses ?? []).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <select
              name="homeroom_teacher_id"
              defaultValue=""
              className={`cursor-pointer ${inputCls}`}
            >
              <option value="">
                — {t('gvcn')} ({t('none')}) —
              </option>
              {staff.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.full_name ?? s.email}
                </option>
              ))}
            </select>
            <button type="submit" className={goldBtn}>
              + {t('createClass')}
            </button>
          </form>
        </section>

        {/* Mời người dùng mới */}
        <section className="glass rounded-[20px] p-[18px]">
          <div className={cardTitle}>{t('inviteUser')}</div>
          <form action={inviteUser} className="flex flex-col gap-2">
            <input name="email" type="email" placeholder={t('email')} required className={inputCls} />
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
              {(classes ?? []).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} · {c.school_year}
                </option>
              ))}
            </select>
            <button type="submit" className={goldBtn}>
              + {t('inviteUser')}
            </button>
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
              {all.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.full_name ?? p.email} ({tr(p.role)})
                </option>
              ))}
            </select>
            <select name="class_id" required defaultValue="" className={`cursor-pointer ${inputCls}`}>
              <option value="" disabled>
                — {t('selectClass')} —
              </option>
              {(classes ?? []).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} · {c.school_year}
                </option>
              ))}
            </select>
            <button type="submit" className={goldBtn}>
              {t('assignGvcn')}
            </button>
          </form>
        </section>

        {/* Mời phụ huynh */}
        <section className="glass rounded-[20px] p-[18px]">
          <div className={cardTitle}>{t('inviteParent')}</div>
          <form action={inviteParent} className="flex flex-wrap items-center gap-2">
            <input
              name="email"
              type="email"
              placeholder={t('email')}
              required
              className="min-w-[160px] flex-1 rounded-[10px] border-[1.5px] border-navy/15 bg-white/65 px-3 py-2 text-sm font-semibold text-navy outline-none transition-all focus:border-navy focus:bg-white"
            />
            <select
              name="student_id"
              required
              defaultValue=""
              className="w-[170px] cursor-pointer rounded-[10px] border-[1.5px] border-navy/15 bg-white/65 px-3 py-2 text-sm font-semibold text-navy outline-none transition-all focus:border-navy focus:bg-white"
            >
              <option value="" disabled>
                — {t('student')} —
              </option>
              {students.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.full_name ?? s.email}
                </option>
              ))}
            </select>
            <button type="submit" className={goldBtn}>
              {t('invite')}
            </button>
          </form>
        </section>
      </div>

      {/* Danh sách lớp đầy đủ */}
      <section className="glass rounded-[20px] p-[18px]">
        <div className={cardTitle}>
          {t('classes')} ({(classes ?? []).length})
        </div>
        <div className="overflow-x-auto rounded-[14px] border-[1.5px] border-navy/10">
          <div className="box-border flex min-w-[640px] items-center gap-2 bg-white/45 px-[14px] py-[9px]">
            <span className={`flex-1 ${th}`}>{t('name')}</span>
            <span className={`w-[70px] flex-none ${th}`}>{t('grade')}</span>
            <span className={`flex-1 ${th}`}>{t('schoolYear')}</span>
            <span className={`flex-1 ${th}`}>{t('campus')}</span>
            <span className={`flex-1 ${th}`}>{t('gvcn')}</span>
          </div>
          {(classes ?? []).map((c) => (
            <div
              key={c.id}
              className="box-border flex min-w-[640px] items-center gap-2 border-t border-navy/[0.08] px-[14px] py-[9px] transition-colors hover:bg-white/35"
            >
              <span className="flex-1 text-[13px] font-bold text-navy">{c.name}</span>
              <span className="w-[70px] flex-none text-[12.5px] font-semibold text-grey-mid">
                {c.grade ?? '—'}
              </span>
              <span className="flex-1 text-[12.5px] font-semibold text-grey-mid">
                {c.school_year}
              </span>
              <span className="flex-1 text-[12.5px] font-semibold text-grey-mid">
                {campusName.get(c.campus_id) ?? '—'}
              </span>
              <span className="flex-1 text-[12.5px] font-semibold text-grey-mid">
                {c.homeroom_teacher_id ? personName.get(c.homeroom_teacher_id) ?? '—' : t('none')}
              </span>
            </div>
          ))}
          {(classes ?? []).length === 0 && (
            <div className="border-t border-navy/[0.08] px-[14px] py-[9px] text-[13px] text-grey-mid">
              {t('none')}
            </div>
          )}
        </div>
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

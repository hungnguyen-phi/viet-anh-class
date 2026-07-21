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

  const inputCls = 'w-full rounded-md border border-grey-line bg-white px-2 py-1.5 text-sm';
  const cardCls = 'rounded-xl border border-grey-line bg-white p-4';
  const btnCls = 'rounded-md bg-navy px-3 py-1.5 text-sm font-bold text-white hover:bg-navy-dark';

  return (
    <div className="space-y-6">
      <h1 className="font-heading text-2xl font-black text-navy">{t('title')}</h1>

      {flash && (
        <div className="rounded-lg border border-success/30 bg-success/10 px-4 py-2 text-sm font-semibold text-success">
          {flash}
        </div>
      )}

      {/* Người dùng + đổi vai trò */}
      <section className={cardCls}>
        <h2 className="mb-3 font-heading font-extrabold text-navy">
          {t('users')} ({all.length})
        </h2>
        <div className="max-h-80 overflow-auto rounded-md border border-grey-line">
          <table className="w-full text-sm">
            <thead className="sticky top-0">
              <tr className="bg-grey-light text-navy">
                <th className="px-2 py-2 text-left">{t('name')}</th>
                <th className="px-2 py-2 text-left">{t('email')}</th>
                <th className="px-2 py-2 text-left">{t('role')}</th>
                <th className="px-2 py-2 text-left">{t('setRole')}</th>
                <th className="px-2 py-2 text-left">{t('actions')}</th>
              </tr>
            </thead>
            <tbody>
              {all.map((p) => (
                <tr key={p.id} className="border-t border-grey-line">
                  <td className="px-2 py-1.5 font-medium text-ink">{p.full_name ?? '—'}</td>
                  <td className="px-2 py-1.5 text-grey-mid">{p.email}</td>
                  <td className="px-2 py-1.5">{tr(p.role)}</td>
                  <td className="px-2 py-1.5">
                    <form action={setUserRole} className="flex items-center gap-2">
                      <input type="hidden" name="userId" value={p.id} />
                      <select name="role" defaultValue={p.role} className={inputCls} style={{width: 'auto'}}>
                        {ROLES.map((r) => (
                          <option key={r} value={r}>
                            {tr(r)}
                          </option>
                        ))}
                      </select>
                      <button type="submit" className={btnCls}>
                        {t('setRole')}
                      </button>
                    </form>
                  </td>
                  <td className="px-2 py-1.5">
                    {p.id !== me.id ? (
                      <div className="flex gap-1">
                        <form action={disableUser}>
                          <input type="hidden" name="userId" value={p.id} />
                          <button
                            type="submit"
                            className="rounded-md border border-grey-line px-2 py-1.5 text-xs font-bold text-navy hover:border-navy"
                          >
                            {t('disable')}
                          </button>
                        </form>
                        <form action={deleteUser}>
                          <input type="hidden" name="userId" value={p.id} />
                          <ConfirmButton
                            message={t('confirmDelete')}
                            className="rounded-md bg-status-bad px-2 py-1.5 text-xs font-bold text-white hover:opacity-90"
                          >
                            {t('delete')}
                          </ConfirmButton>
                        </form>
                      </div>
                    ) : (
                      <span className="text-xs text-grey-mid">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Tạo cơ sở + danh sách */}
        <section className={cardCls}>
          <h2 className="mb-3 font-heading font-extrabold text-navy">{t('createCampus')}</h2>
          <form action={createCampus} className="flex flex-wrap items-center gap-2">
            <input name="name" placeholder={t('name')} className={inputCls} style={{maxWidth: '12rem'}} required />
            <input name="code" placeholder={t('code')} className={inputCls} style={{maxWidth: '7rem'}} required />
            <button type="submit" className={btnCls}>
              + {t('createCampus')}
            </button>
          </form>
          <div className="mt-4">
            <div className="mb-1 text-xs font-bold uppercase text-grey-mid">
              {t('campuses')} ({(campuses ?? []).length})
            </div>
            <ul className="divide-y divide-grey-line rounded-md border border-grey-line">
              {(campuses ?? []).map((c) => (
                <li key={c.id} className="flex items-center justify-between px-3 py-2 text-sm">
                  <span className="font-medium text-ink">{c.name}</span>
                  <span className="text-grey-mid">{c.code}</span>
                </li>
              ))}
              {(campuses ?? []).length === 0 && (
                <li className="px-3 py-2 text-sm text-grey-mid">{t('none')}</li>
              )}
            </ul>
          </div>
        </section>

        {/* Tạo lớp */}
        <section className={cardCls}>
          <h2 className="mb-3 font-heading font-extrabold text-navy">{t('createClass')}</h2>
          <form action={createClass} className="space-y-2">
            <div className="flex gap-2">
              <input name="name" placeholder={t('name')} className={inputCls} required />
              <input name="grade" placeholder={t('grade')} className={inputCls} style={{maxWidth: '6rem'}} />
            </div>
            <input name="school_year" defaultValue={defaultYear} placeholder={t('schoolYear')} className={inputCls} required />
            <select name="campus_id" className={inputCls} required defaultValue="">
              <option value="" disabled>
                — {t('campus')} —
              </option>
              {(campuses ?? []).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <select name="homeroom_teacher_id" className={inputCls} defaultValue="">
              <option value="">— {t('gvcn')} ({t('none')}) —</option>
              {staff.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.full_name ?? s.email}
                </option>
              ))}
            </select>
            <button type="submit" className={btnCls}>
              + {t('createClass')}
            </button>
          </form>
        </section>
      </div>

      {/* Danh sách lớp đầy đủ */}
      <section className={cardCls}>
        <h2 className="mb-3 font-heading font-extrabold text-navy">
          {t('classes')} ({(classes ?? []).length})
        </h2>
        <div className="overflow-x-auto rounded-md border border-grey-line">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-grey-light text-navy">
                <th className="px-2 py-2 text-left">{t('name')}</th>
                <th className="px-2 py-2 text-left">{t('grade')}</th>
                <th className="px-2 py-2 text-left">{t('schoolYear')}</th>
                <th className="px-2 py-2 text-left">{t('campus')}</th>
                <th className="px-2 py-2 text-left">{t('gvcn')}</th>
              </tr>
            </thead>
            <tbody>
              {(classes ?? []).map((c) => (
                <tr key={c.id} className="border-t border-grey-line">
                  <td className="px-2 py-1.5 font-medium text-ink">{c.name}</td>
                  <td className="px-2 py-1.5 text-grey-mid">{c.grade ?? '—'}</td>
                  <td className="px-2 py-1.5 text-grey-mid">{c.school_year}</td>
                  <td className="px-2 py-1.5 text-grey-mid">{campusName.get(c.campus_id) ?? '—'}</td>
                  <td className="px-2 py-1.5 text-grey-mid">
                    {c.homeroom_teacher_id ? personName.get(c.homeroom_teacher_id) ?? '—' : t('none')}
                  </td>
                </tr>
              ))}
              {(classes ?? []).length === 0 && (
                <tr>
                  <td colSpan={5} className="px-2 py-2 text-grey-mid">
                    {t('none')}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Mời người dùng mới */}
        <section className={cardCls}>
          <h2 className="mb-3 font-heading font-extrabold text-navy">{t('inviteUser')}</h2>
          <form action={inviteUser} className="space-y-2">
            <input name="email" type="email" placeholder={t('email')} className={inputCls} required />
            <select name="role" className={inputCls} required defaultValue="">
              <option value="" disabled>
                — {t('selectRole')} —
              </option>
              {INVITE_ROLES.map((r) => (
                <option key={r} value={r}>
                  {tr(r)}
                </option>
              ))}
            </select>
            <select name="class_id" className={inputCls} defaultValue="">
              <option value="">— {t('selectClass')} ({t('none')}) —</option>
              {(classes ?? []).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} · {c.school_year}
                </option>
              ))}
            </select>
            <button type="submit" className={btnCls}>
              + {t('inviteUser')}
            </button>
          </form>
          <p className="mt-2 text-xs italic text-grey-mid">{t('applyNote')}</p>
        </section>

        {/* Phân công GVCN */}
        <section className={cardCls}>
          <h2 className="mb-3 font-heading font-extrabold text-navy">{t('assignGvcn')}</h2>
          <form action={assignGvcn} className="space-y-2">
            <select name="userId" className={inputCls} required defaultValue="">
              <option value="" disabled>
                — {t('selectUser')} —
              </option>
              {all.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.full_name ?? p.email} ({tr(p.role)})
                </option>
              ))}
            </select>
            <select name="class_id" className={inputCls} required defaultValue="">
              <option value="" disabled>
                — {t('selectClass')} —
              </option>
              {(classes ?? []).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} · {c.school_year}
                </option>
              ))}
            </select>
            <button type="submit" className={btnCls}>
              {t('assignGvcn')}
            </button>
          </form>
        </section>
      </div>

      {/* Lời mời đang chờ */}
      {pendingInvites.length > 0 && (
        <section className={cardCls}>
          <h2 className="mb-3 font-heading font-extrabold text-navy">
            {t('pending')} ({pendingInvites.length})
          </h2>
          <ul className="divide-y divide-grey-line rounded-md border border-grey-line">
            {pendingInvites.map((p, i) => (
              <li key={`${p.email}-${i}`} className="flex items-center justify-between px-3 py-2 text-sm">
                <span className="font-medium text-ink">{p.email}</span>
                <span className="text-grey-mid">{p.detail}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Mời phụ huynh */}
      <section className={cardCls}>
        <h2 className="mb-3 font-heading font-extrabold text-navy">{t('inviteParent')}</h2>
        <form action={inviteParent} className="flex flex-wrap items-center gap-2">
          <input name="email" type="email" placeholder={t('email')} className={inputCls} style={{maxWidth: '16rem'}} required />
          <select name="student_id" className={inputCls} style={{width: 'auto'}} required defaultValue="">
            <option value="" disabled>
              — {t('student')} —
            </option>
            {students.map((s) => (
              <option key={s.id} value={s.id}>
                {s.full_name ?? s.email}
              </option>
            ))}
          </select>
          <button type="submit" className={btnCls}>
            {t('invite')}
          </button>
        </form>
      </section>

      {/* Giao diện mẫu — mở mọi màn hình */}
      <section className={cardCls}>
        <h2 className="mb-1 font-heading font-extrabold text-navy">{t('screensTitle')}</h2>
        <p className="mb-3 text-xs text-grey-mid">{t('screensHint')}</p>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {screens.map((s) => (
            <Link
              key={s.href}
              href={s.href}
              className="rounded-xl border border-grey-line p-3 transition-colors hover:border-navy hover:bg-grey-light"
            >
              <div className="flex items-center justify-between">
                <span className="font-heading font-extrabold text-navy">{s.label}</span>
                <span className="text-shadow-dark text-xs font-bold text-gold">{tcommon('open')} →</span>
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

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
import {ParentFormLoader} from './ParentFormLoader';
import {headers} from 'next/headers';
import {Suspense} from 'react';
import {CampusTree} from './CampusTree';
import {CreateMenu} from './CreateMenu';
import {Disclosure} from './Disclosure';
import {PendingApprovals} from './PendingApprovals';
import {UsersToolbar} from './UsersToolbar';
// Hằng số lấy từ file trung lập, KHÔNG lấy từ UsersToolbar.tsx: nhập dữ liệu thuần từ một module
// 'use client' vào server component thì nhận về proxy tham chiếu, không phải mảng. Xem user-tabs.ts.
import {USER_TABS, PAGE_SIZES, type UserTab} from './user-tabs';
import {AreaConfigForm} from './AreaConfigForm';
import {InviteEmailsField} from './InviteEmailsField';
import {SchoolNetworkManager} from './SchoolNetworkManager';
import {AREAS, buildAreaMeta} from '@/lib/areas';
import {clientIp} from '@/lib/ip';
import {Link} from '@/i18n/navigation';
import {UtensilsCrossed, BookMarked} from 'lucide-react';
import {Flash} from '@/components/ui/Flash';

const ROLES = ['admin', 'principal', 'teacher', 'student', 'parent', 'pending'] as const;
const INVITE_ROLES = ['teacher', 'principal', 'admin', 'student'] as const;

// LỜI MỜI ĐANG CHỜ — TẠM ẨN.
//
// Mục này liệt kê những email đã được khai trước vai trò, dưới cái tên "đang chờ". Nhưng hệ thống
// CHƯA GỬI EMAIL nào cho họ cả: vai trò chỉ được áp khi tự họ đăng nhập lần đầu. Một danh sách
// mang chữ "đang chờ" mà không có ai được báo là đang chờ đọc như một hàng đợi đang chạy, khiến
// người quản trị ngồi đợi một chuyện sẽ không xảy ra.
// Bật lại bằng cách đổi hằng số này thành true sau khi đường gửi mail chạy thật.
const HIEN_LOI_MOI_DANG_CHO = false;

export default async function AdminPage({
  params,
  searchParams,
}: {
  params: Promise<{locale: string}>;
  searchParams: Promise<{
    q?: string;
    upage?: string;
    vai?: string;
    size?: string;
    flash?: string;
    flash_err?: string;
  }>;
}) {
  const {locale} = await params;
  const {
    q: qRaw,
    upage: upageRaw,
    vai: vaiRaw,
    size: sizeRaw,
    flash: flashOk,
    flash_err: flashErr,
  } = await searchParams;
  setRequestLocale(locale);
  const me = await requireRole(['admin']);
  const t = await getTranslations('admin');
  const tr = await getTranslations('roles');
  const tn = await getTranslations('nav');
  const tcommon = await getTranslations('common');
  const supabase = await createClient();

  // Mục lục màn hình. CHỈ liệt kê những trang quản trị viên THẬT SỰ MỞ ĐƯỢC từ đây.
  //
  // Bản cũ có thêm hai thẻ dẫn tới ngõ cụt: "/report" (chỉ phụ huynh vào được — admin bấm là bị
  // đá ngược về /admin, không một lời giải thích) và "/login" kèm chú thích "đăng xuất để xem",
  // tức một cái nút chỉ dùng được sau khi làm một việc khác. Thẻ bấm vào mà không tới đâu thì
  // lần sau người ta thôi tin cả cái mục lục.
  //
  // "/meeting" cũng bỏ: từ đợt này nó đưa giáo viên/quản trị thẳng sang /wig/hop, nên để hai thẻ
  // trỏ về cùng một chỗ là bày ra một lựa chọn không tồn tại.
  const screens = [
    {href: '/', label: tn('scoreboard'), desc: 'Trang lớp: bảng điểm, xếp hạng, donut WIG'},
    {href: '/attendance', label: tn('attendance'), desc: 'Điểm danh hằng ngày (tick cả lớp rồi bấm Lưu)'},
    {href: '/roster', label: tn('roster'), desc: 'Danh sách lớp + gán trưởng điểm danh'},
    {href: '/wig', label: tn('wig'), desc: 'Mục tiêu tuần, việc để các em tick, phòng họp WIG'},
    {href: '/homework', label: tn('homework'), desc: 'Báo bài cho lớp'},
    {href: '/grades', label: tn('grades'), desc: 'Học bạ: điểm số và rèn luyện'},
    {href: '/campus', label: tn('campus'), desc: 'Bảng tổng hợp toàn trường (BGH)'},
    {href: '/admin', label: tn('admin'), desc: 'Trang quản trị (màn hình này)'},
  ];

  // ── Bảng người dùng: LỌC THEO VAI (tab) + tìm kiếm + số dòng mỗi trang ────────────────────
  // Loại ký tự phá cú pháp filter PostgREST (,()*) để chống injection ở .or().
  const q = (qRaw ?? '').replace(/[,()*%]/g, '').trim();
  const tab: UserTab = (USER_TABS as readonly string[]).includes(vaiRaw ?? '')
    ? (vaiRaw as UserTab)
    : 'all';
  // Cỡ trang phải nằm trong danh sách cho phép: ?size=100000 là một cách vô tình (hoặc cố ý) kéo
  // toàn bộ PII của trường về trong một payload.
  const sizeNum = Number(sizeRaw);
  const PAGE = (PAGE_SIZES as readonly number[]).includes(sizeNum) ? sizeNum : PAGE_SIZES[0];
  const upage = Math.max(1, Number(upageRaw) || 1);
  const fromIdx = (upage - 1) * PAGE;

  let usersQuery = supabase
    .from('profiles')
    .select('id, full_name, email, role', {count: 'exact'})
    .order('email')
    .range(fromIdx, fromIdx + PAGE - 1);
  // Phải khớp ĐÚNG phép so của hàm admin_user_counts (ilike hai cột), nếu không con số trên tab
  // và số dòng trong bảng sẽ lệch nhau.
  if (q) usersQuery = usersQuery.or(`email.ilike.%${q}%,full_name.ilike.%${q}%`);
  if (tab !== 'all') usersQuery = usersQuery.eq('role', tab);
  // Số đếm cho từng tab — TÍNH THEO CẢ Ô TÌM KIẾM, để "Giáo viên (3)" nghĩa là ba giáo viên khớp
  // từ khoá đang gõ, chứ không phải ba giáo viên toàn trường rồi bấm vào lại thấy bảng rỗng.
  //
  // MỘT lượt đi-về, không phải bảy. Bản đầu bắn bảy truy vấn đếm song song cho bảy tab; Postgres
  // trả lời được cả bảy bằng một câu `group by` (hàm admin_user_counts, migration 0085). Đáng đổi
  // vì VPS này mất khoảng 5% gói TCP: mỗi truy vấn thêm vào không chỉ chậm hơn mà còn là thêm một
  // cơ hội để cả trang ném lỗi và người quản trị nhận màn hình đỏ.
  const countQuery = supabase.rpc('admin_user_counts', q ? {p_q: q} : {});

  const [
    {data: pageUsers, count: usersTotal},
    {data: roleCounts},
    {data: staff},
    {data: campuses},
    {data: grades},
    {data: classes},
    {data: grants},
    {data: invites},
    {data: areaCfg},
    {data: networks},
    {data: dangKet},
  ] = await Promise.all([
    usersQuery,
    countQuery,
    supabase
      .from('profiles')
      .select('id, full_name, email')
      .in('role', ['teacher', 'principal', 'admin'])
      .order('email')
      .limit(500),
    supabase.from('campuses').select('id, name, code, is_active, level').order('name'),
    supabase.from('grades').select('id, name, campus_id, sort_order, is_active').order('sort_order'),
    supabase
      .from('classes')
      .select('id, name, school_year, grade, grade_id, campus_id, homeroom_teacher_id, is_active')
      .order('name'),
    supabase.from('pending_user_grants').select('email, role, class_id').order('created_at'),
    supabase.from('parent_invitations').select('email, student_id, status').order('created_at'),
    supabase.from('area_config').select('*').order('sort_order'),
    // Mạng đang bật lên trên, rồi theo nhãn A→Z — chứ không theo thứ tự vừa thêm. Một dải mạng
    // mới khai luôn rơi xuống cuối là lý do danh sách này càng dùng càng khó đọc.
    supabase
      .from('school_networks')
      .select('id, label, cidr, campus_id, is_active')
      .order('is_active', {ascending: false})
      .order('label'),
    // NGƯỜI ĐANG KẸT Ở MÀN HÌNH ĐỎ. Bảng người dùng bên dưới phân trang theo email, nên một giáo
    // viên mới có thể nằm ở trang 3 suốt hai tuần mà không ai để ý.
    supabase
      .from('profiles')
      .select('id, full_name, email, created_at')
      .eq('role', 'pending')
      .order('created_at')
      .limit(50),
  ]);
  const currentIp = clientIp(await headers());

  const rows = pageUsers ?? [];
  const total = usersTotal ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE));
  // Hàm chỉ trả về những vai CÓ người; vai rỗng không có dòng nào. Dựng đủ bảy khoá với mặc định 0
  // để tab "Phụ huynh (0)" vẫn hiện số thay vì hiện `undefined`.
  const byRole = new Map((roleCounts ?? []).map((r) => [r.role, Number(r.n)]));
  const counts = Object.fromEntries(
    USER_TABS.map((k) => [
      k,
      k === 'all' ? [...byRole.values()].reduce((a, b) => a + b, 0) : (byRole.get(k) ?? 0),
    ]),
  ) as Record<UserTab, number>;
  const staffList = staff ?? [];
  const allCampuses = campuses ?? [];
  const allGrades = grades ?? [];
  const allClasses = classes ?? [];
  const campusName = new Map(allCampuses.map((c) => [c.id, c.name]));
  // Tên người: chỉ gộp nhân sự + trang người dùng hiện tại. Đủ cho việc duy nhất còn dùng tới nó
  // là hiện tên GVCN đang giữ lớp trong hai ô chọn lớp.
  // KHÔNG gộp học sinh nữa: danh sách một nghìn học sinh đã chuyển sang ParentFormLoader nạp sau.
  const personName = new Map(
    [...staffList, ...rows].map((p) => [p.id, p.full_name ?? p.email]),
  );
  const className = new Map(allClasses.map((c) => [c.id, c.name]));

  // Tách active / đã-lưu-trữ.
  const activeCampuses = allCampuses.filter((c) => c.is_active);
  const archivedCampuses = allCampuses.filter((c) => !c.is_active);
  const activeGrades = allGrades.filter((g) => g.is_active);
  const archivedGrades = allGrades.filter((g) => !g.is_active);
  const activeClasses = allClasses.filter((c) => c.is_active);
  const archivedClasses = allClasses.filter((c) => !c.is_active);
  // Options cho form tạo lớp (chỉ cơ sở & khối đang hoạt động).
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
        // Không kèm tên học sinh: tên đó nằm trong danh sách đã tách sang ParentFormLoader.
        // Mục này đang tắt (HIEN_LOI_MOI_DANG_CHO); khi bật lại thì cho nó tự nạp tên nó cần,
        // đừng kéo cả nghìn dòng vào đường dựng trang chỉ để ghép một chuỗi.
        detail: tr('parent'),
      })),
  ];
  const defaultYear = schoolYearLabel(new Date());
  const activeNetworks = (networks ?? []).filter((n) => n.is_active).length;

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
    'h-8 cursor-pointer whitespace-nowrap rounded-[10px] bg-[color-mix(in_srgb,var(--color-status-bad)_12%,transparent)] px-2.5 text-[11.5px] font-extrabold text-status-bad transition-all hover:bg-[color-mix(in_srgb,var(--color-status-bad)_22%,transparent)]';
  const openLink =
    'inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-[10px] border-[1.5px] border-navy/20 bg-white px-3 text-[12.5px] font-extrabold text-navy transition-all hover:border-navy';

  return (
    <div className="flex flex-col gap-4">
      {/* Tiêu đề + MỘT nút "Tạo mới" gom cả năm việc khai báo (cơ sở, lớp, mời người, phân công,
          mời phụ huynh) — trước đây là năm thẻ form luôn mở giữa trang. */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="font-display text-[22px] font-bold text-navy">{t('title')}</h1>
        {/* revision = dấu vân tay dữ liệu, để hộp thoại tự đóng khi form bên trong vừa lưu xong.
            Gồm cả câu thông báo: tạo một cơ sở TRÙNG TÊN bị chặn thì không con số nào đổi, nhưng
            ?flash_err= thì có — người dùng vẫn cần thấy hộp thoại phản ứng chứ không đứng im. */}
        <CreateMenu
          revision={[
            counts.all,
            allCampuses.length,
            allClasses.length,
            pendingInvites.length,
            (invites ?? []).length,
            flashOk ?? '',
            flashErr ?? '',
          ].join('|')}
          campusForm={<CampusForm />}
          classForm={
            <ClassForm
              campuses={campusOptions}
              grades={gradeOptions}
              teachers={staffList}
              defaultYear={defaultYear}
            />
          }
          inviteForm={
            <form action={inviteUser} className="flex flex-col gap-2">
              {/* <textarea> không có kiểm tra định dạng sẵn của trình duyệt, mà ô này nhận NHIỀU
                  email nên cũng không đổi sang <input type="email"> được. Dùng pattern qua
                  InviteEmailsField (client) để báo lỗi ngay tại ô thay vì phải gửi lên server rồi
                  tải lại cả trang mới biết sai. */}
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
                {/* GHI KÈM GVCN ĐANG CÓ. Mời một giáo viên vào lớp đã có chủ nhiệm từng ÂM THẦM
                    cướp lớp của người đang dạy (đã chặn ở CSDL từ 0082). Nhưng chặn thôi chưa đủ:
                    người mời vẫn cần biết ghế ấy có người, nếu không họ mời xong rồi ngồi đợi một
                    chuyện sẽ không xảy ra. */}
                {activeClasses.map((c) => {
                  const gv = c.homeroom_teacher_id ? personName.get(c.homeroom_teacher_id) : null;
                  return (
                    <option key={c.id} value={c.id}>
                      {c.name} · {c.school_year}
                      {gv ? ` · ${t('alreadyHasGvcn', {name: gv})}` : ''}
                    </option>
                  );
                })}
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
                {activeClasses.map((c) => {
                  const gv = c.homeroom_teacher_id ? personName.get(c.homeroom_teacher_id) : null;
                  return (
                    <option key={c.id} value={c.id}>
                      {c.name} · {c.school_year}
                      {gv ? ` · ${t('alreadyHasGvcn', {name: gv})}` : ''}
                    </option>
                  );
                })}
              </select>
              <SubmitButton className={goldBtn} wrapClass="contents">
                {t('assignGvcn')}
              </SubmitButton>
            </form>
          }
          parentForm={
            <Suspense fallback={<div className="py-4 text-center text-[12.5px] font-semibold text-grey-mid">{tcommon('loading')}</div>}>
              <ParentFormLoader />
            </Suspense>
          }
        />
      </div>

      <Flash />

      {/* ══ AI ĐANG CHỜ BẠN ══
          Đặt TRÊN CÙNG, trước cả bảng người dùng: đây là việc duy nhất trên trang này có người
          thật đang ngồi đợi ở đầu kia. Chỉ hiện khi có người chờ — một khối rỗng nằm mãi trên
          đầu là một khối người ta thôi nhìn. */}
      {(dangKet ?? []).length > 0 && <PendingApprovals users={dangKet ?? []} />}

      {/* Người dùng: tab theo vai + tìm kiếm + số dòng/trang + đổi vai trò */}
      <section className="glass rounded-[20px] p-[18px]">
        <div className="mb-3 font-display text-[15px] font-bold text-navy">
          {t('users')} <span className="font-semibold text-grey-mid">({counts.all})</span>
        </div>

        <UsersToolbar q={q} tab={tab} size={PAGE} counts={counts} />

        {/* NGỮ NGHĨA BẢNG BẰNG ARIA, không phải <table>.
            Bảng này dùng flex để các cột co giãn theo tỉ lệ (tên ngắn, email dài) — thứ <table>
            làm được nhưng vụng hơn. Cái mất khi bỏ <table> là trình đọc màn hình không còn biết ô
            nào thuộc cột nào: người khiếm thị nghe một dòng chữ liền mạch "Nguyễn Văn A a@b.c Giáo
            viên Đổi vai trò Vô hiệu Xoá" mà không có tên cột nào xen giữa. role="table"/"row"/
            "columnheader"/"cell" trả lại đúng thông tin đó mà không đụng tới bố cục. */}
        <div className="overflow-x-auto rounded-[14px] border-[1.5px] border-navy/10">
          <div role="table" aria-label={t('usersTable')} aria-rowcount={total}>
            <div role="row" className="box-border flex min-w-[760px] items-center gap-2 bg-navy/[0.03] px-[14px] py-[9px]">
              <span role="columnheader" className={`flex-[1.2] ${th}`}>{t('name')}</span>
              <span role="columnheader" className={`flex-[1.4] ${th}`}>{t('email')}</span>
              <span role="columnheader" className={`flex-1 ${th}`}>{t('role')}</span>
              <span role="columnheader" className={`flex-[1.6] ${th}`}>{t('setRole')}</span>
              <span role="columnheader" className={`w-[130px] flex-none ${th}`}>{t('actions')}</span>
            </div>
            {rows.map((p) => {
              // Tên đọc được của từng nút/ô chọn phải KÈM TÊN NGƯỜI.
              // Trước đây mọi dòng dùng chung aria-label "Vai trò" / "Xoá", nên người dùng trình
              // đọc màn hình đi qua năm mươi dòng chỉ nghe đúng một câu lặp lại, không biết mình
              // đang sắp đổi vai hay xoá ai. Đây là nút xoá vĩnh viễn — không phải chỗ để đoán.
              const who = p.full_name ?? p.email;
              return (
                <div
                  key={p.id}
                  role="row"
                  className="box-border flex min-w-[760px] items-center gap-2 border-t border-navy/[0.08] px-[14px] py-2 transition-colors hover:bg-navy/[0.03]"
                >
                  <span role="cell" className="min-w-0 flex-[1.2] truncate text-[13px] font-bold text-navy">
                    {/* Chưa có họ tên thì nói thẳng là chưa có, đừng vẽ một dấu gạch ngang.
                        Một ô chỉ chứa "—" không nói được là dữ liệu thiếu hay hệ thống hỏng. */}
                    {p.full_name ?? <span className="font-semibold italic text-grey-mid">{t('noName')}</span>}
                  </span>
                  <span role="cell" className="min-w-0 flex-[1.4] truncate text-xs font-semibold text-grey-mid">
                    {p.email}
                  </span>
                  <span role="cell" className="flex-1 whitespace-nowrap text-[12.5px] font-bold text-navy">
                    {tr(p.role)}
                  </span>
                  <span role="cell" className="flex-[1.6]">
                    <form action={setUserRole} className="flex items-center gap-1.5">
                      <input type="hidden" name="userId" value={p.id} />
                      <select
                        name="role"
                        aria-label={t('roleFor', {name: who})}
                        defaultValue={p.role}
                        className={selectSm}
                      >
                        {ROLES.map((r) => (
                          <option key={r} value={r}>
                            {tr(r)}
                          </option>
                        ))}
                      </select>
                      {/* SubmitButton (không phải <button> trần): đổi vai trò là thao tác chạm DB
                          rồi tải lại cả trang, mất một khoảng thấy rõ. Nút trần không báo gì trong
                          lúc đó nên người thử tưởng "bấm không ăn / bị treo" rồi bấm lại nhiều lần.
                          SubmitButton khoá nút + hiện spinner ngay khi bấm. */}
                      <SubmitButton className={navyBtnSm} label={t('setRoleFor', {name: who})}>
                        {t('setRole')}
                      </SubmitButton>
                    </form>
                  </span>
                  <span role="cell" className="flex w-[130px] flex-none gap-1.5">
                    {p.id !== me.id ? (
                      <>
                        {/* Vô hiệu = đẩy người ta về vai "chờ cấp quyền", tức là đăng nhập vào chỉ
                            còn màn hình đỏ. Nút "Xoá" ngay bên cạnh thì hỏi lại, nút này thì không —
                            mà hai nút cách nhau 6px và hậu quả của cái này cũng không tự gỡ được
                            (vai cũ không được lưu ở đâu cả). Câu hỏi nêu rõ TÊN và VAI ĐANG CÓ để
                            người bấm còn đường tự khôi phục. */}
                        <form action={disableUser}>
                          <input type="hidden" name="userId" value={p.id} />
                          <ConfirmButton
                            message={t('confirmDisable', {name: who, role: tr(p.role)})}
                            label={t('disableFor', {name: who})}
                            className={outlineBtnSm}
                          >
                            {t('disable')}
                          </ConfirmButton>
                        </form>
                        <form action={deleteUser}>
                          <input type="hidden" name="userId" value={p.id} />
                          <ConfirmButton
                            message={t('confirmDelete')}
                            label={t('deleteFor', {name: who})}
                            className={dangerBtnSm}
                          >
                            {t('delete')}
                          </ConfirmButton>
                        </form>
                      </>
                    ) : (
                      // Dòng của chính mình: nói RÕ vì sao không có nút, đừng để một dấu gạch ngang
                      // đứng đó cho người ta đoán là lỗi phân quyền.
                      <span className="text-[11.5px] font-bold text-grey-mid">{t('isYou')}</span>
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

        {/* Phân trang — giữ nguyên tab và cỡ trang khi sang trang khác. */}
        {totalPages > 1 && (
          <div className="mt-3 flex items-center justify-center gap-2 text-[12.5px] font-bold text-navy">
            {upage > 1 ? (
              <Link
                href={{
                  pathname: '/admin',
                  query: {...(q ? {q} : {}), ...(tab !== 'all' ? {vai: tab} : {}), size: PAGE, upage: upage - 1},
                }}
                className={outlineBtnSm}
              >
                ← {t('prev')}
              </Link>
            ) : (
              <span className={`${outlineBtnSm} pointer-events-none opacity-40`}>← {t('prev')}</span>
            )}
            <span className="text-grey-mid">
              {t('pageOf', {page: upage, total: totalPages})}
            </span>
            {upage < totalPages ? (
              <Link
                href={{
                  pathname: '/admin',
                  query: {...(q ? {q} : {}), ...(tab !== 'all' ? {vai: tab} : {}), size: PAGE, upage: upage + 1},
                }}
                className={outlineBtnSm}
              >
                {t('next')} →
              </Link>
            ) : (
              <span className={`${outlineBtnSm} pointer-events-none opacity-40`}>{t('next')} →</span>
            )}
          </div>
        )}
      </section>

      {/* Cơ sở → Khối → Lớp: một cây mục cha/mục con, thêm mới nằm ngay trong mục nó thuộc về. */}
      <CampusTree
        campuses={activeCampuses.map((c) => ({id: c.id, name: c.name, code: c.code, level: c.level}))}
        grades={activeGrades.map((g) => ({
          id: g.id,
          name: g.name,
          campus_id: g.campus_id,
          sort_order: g.sort_order,
        }))}
        allGrades={allGradeOptions}
        classes={activeClasses.map((c) => ({
          id: c.id,
          name: c.name,
          grade_id: c.grade_id,
          grade: c.grade,
          school_year: c.school_year,
          campus_id: c.campus_id,
          homeroom_teacher_id: c.homeroom_teacher_id,
        }))}
        teachers={staffList}
        defaultYear={defaultYear}
      />

      {/* Lời mời đang chờ — xem ghi chú ở HIEN_LOI_MOI_DANG_CHO trên đầu file. */}
      {HIEN_LOI_MOI_DANG_CHO && pendingInvites.length > 0 && (
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

      {/* Điểm danh & Wifi trường — cổng IP cho check-in cảm xúc. Đặt TRÊN mục Môn: khai sai dải
          mạng thì điểm danh cả trường hỏng ngay hôm ấy, còn nhãn/màu lĩnh vực thì sửa lúc nào
          cũng được. Gấp lại, nhưng CHƯA KHAI BÁO MẠNG NÀO thì nhãn cảnh báo hiện ngay trên đầu
          mục, không cần mở ra mới thấy. */}
      <Disclosure
        title={t('networkTitle')}
        count={(networks ?? []).length}
        badge={
          activeNetworks === 0 ? (
            <span className="rounded-full border border-warn/40 bg-warn/10 px-2.5 py-1 text-[11px] font-extrabold text-navy">
              {t('networkOpenBadge')}
            </span>
          ) : undefined
        }
      >
        {/* cidr là kiểu `cidr` của Postgres, không có kiểu TS tương ứng nên bộ sinh
            database.types.ts để `unknown`. PostgREST trả về nó dạng chuỗi ("10.0.0.0/24"),
            nên ép kiểu ở đây là đúng thực tế — và phải làm ở chỗ dùng, vì file types là file
            SINH TỰ ĐỘNG, sửa tay trong đó sẽ mất khi sinh lại. */}
        <SchoolNetworkManager
          networks={(networks ?? []).map((n) => ({...n, cidr: String(n.cidr)}))}
          campuses={campusOptions}
          currentIp={currentIp}
        />
      </Disclosure>

      {/* Môn (4 lĩnh vực 4DX) — gấp lại: sửa nhãn/màu là việc vài lần một năm. */}
      <Disclosure title={t('manageAreas')} hint={t('areasHint')} count={areaRows.length}>
        <AreaConfigForm rows={areaRows} />
      </Disclosure>

      {/* Hai trang soạn thảo riêng — chỉ là lối vào, không nhét nội dung vào đây.
          Không làm tab trên thanh menu: đây là việc của một hai người mỗi tuần/mỗi năm, còn thanh
          menu thì mọi vai đều phải nhìn mỗi ngày (docs/NAV_IA.md). */}
      <section className="glass rounded-[20px] p-[18px]">
        <div className={cardTitle}>{t('otherPages')}</div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <p className="mb-2 text-xs text-grey-mid">
              Danh mục môn dùng chung toàn trường, lớp nào học môn nào, và ai dạy môn gì ở lớp nào.
              Giáo viên bộ môn chỉ nhập được điểm môn mình được phân công.
            </p>
            <Link href="/subjects" className={openLink}>
              <BookMarked size={14} strokeWidth={2.2} />
              Mở danh mục môn
            </Link>
          </div>
          <div>
            <p className="mb-2 text-xs text-grey-mid">
              Thực đơn bữa ăn soạn theo tuần cho từng cơ sở. Phụ huynh và học sinh thấy ngay trong
              trang của họ.
            </p>
            <Link href="/menu" className={openLink}>
              <UtensilsCrossed size={14} strokeWidth={2.2} />
              Mở trang thực đơn
            </Link>
          </div>
        </div>
      </section>

      {/* Đã lưu trữ — khôi phục Cơ sở / Khối / Lớp */}
      {archivedCampuses.length + archivedGrades.length + archivedClasses.length > 0 && (
        <Disclosure
          title={t('archived')}
          count={archivedCampuses.length + archivedGrades.length + archivedClasses.length}
        >
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
        </Disclosure>
      )}

      {/* Giao diện mẫu — mở mọi màn hình */}
      <Disclosure title={t('screensTitle')} hint={t('screensHint')} count={screens.length}>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {screens.map((s) => (
            <Link
              key={s.href}
              href={s.href}
              className="glass glass-hover block cursor-pointer rounded-[14px] p-3.5"
            >
              <div className="flex items-center justify-between">
                <span className="font-display text-[15px] font-bold text-navy">{s.label}</span>
                <span className="text-xs font-extrabold text-gold-text">{tcommon('open')} →</span>
              </div>
              <p className="mt-1 text-xs text-grey-mid">{s.desc}</p>
              <code className="mt-1 block text-[11px] text-grey-mid">{s.href}</code>
            </Link>
          ))}
        </div>
      </Disclosure>
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
              <SubmitButton className="h-8 shrink-0 cursor-pointer whitespace-nowrap rounded-[9px] bg-navy px-2.5 text-[11.5px] font-extrabold text-white transition-all hover:bg-navy-700">
                {restoreLabel}
              </SubmitButton>
            </form>
          </div>
        ))}
        {rows.length === 0 && <div className="px-3 py-2 text-[12px] text-grey-mid">{emptyLabel}</div>}
      </div>
    </div>
  );
}

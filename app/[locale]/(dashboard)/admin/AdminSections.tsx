import {headers} from 'next/headers';
import {getTranslations} from 'next-intl/server';
import {Link} from '@/i18n/navigation';
import {UtensilsCrossed, BookMarked} from 'lucide-react';
import {SubmitButton} from '@/components/ui/SubmitButton';
import {AREAS, buildAreaMeta} from '@/lib/areas';
import {clientIp} from '@/lib/ip';
import {schoolYearLabel} from '@/lib/dates';
import {setCampusActive, setGradeActive, setClassActive} from './actions';
import {layDanhMuc, layPhuTro} from './admin-data';
import {AreaConfigForm} from './AreaConfigForm';
import {CampusTree} from './CampusTree';
import {Disclosure} from './Disclosure';
import {SchoolNetworkManager} from './SchoolNetworkManager';

// LỜI MỜI ĐANG CHỜ — TẠM ẨN.
//
// Mục này liệt kê những email đã được khai trước vai trò, dưới cái tên "đang chờ". Nhưng hệ thống
// CHƯA GỬI EMAIL nào cho họ cả: vai trò chỉ được áp khi tự họ đăng nhập lần đầu. Một danh sách
// mang chữ "đang chờ" mà không có ai được báo là đang chờ đọc như một hàng đợi đang chạy, khiến
// người quản trị ngồi đợi một chuyện sẽ không xảy ra.
// Bật lại bằng cách đổi hằng số này thành true sau khi đường gửi mail chạy thật.
const HIEN_LOI_MOI_DANG_CHO = false;

const cardTitle = 'mb-3 font-display text-[15px] font-bold text-navy';
const openLink =
  'inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-[10px] border-[1.5px] border-navy/20 bg-white px-3 text-[12.5px] font-extrabold text-navy transition-all hover:border-navy';

// PHẦN CÒN LẠI CỦA MÀN QUẢN TRỊ — cây cơ sở, wifi, lĩnh vực, kho lưu trữ, mục lục màn hình.
//
// Tất cả đều là việc làm vài lần một năm, nên chúng chảy về SAU bảng người dùng và không giữ chân
// nó. Trước đây chúng nằm chung một Promise.all với bảng, nên bấm đổi tab là phải chờ cả chín truy
// vấn này xong mới thấy được một dòng nào.
export async function AdminSections() {
  const t = await getTranslations('admin');
  const tr = await getTranslations('roles');
  const tn = await getTranslations('nav');
  const tcommon = await getTranslations('common');

  const [{allCampuses, allGrades, allClasses, staffList}, {grants, invites, areaCfg, networks}] =
    await Promise.all([layDanhMuc(), layPhuTro()]);
  const currentIp = clientIp(await headers());

  const campusName = new Map(allCampuses.map((c) => [c.id, c.name]));
  const className = new Map(allClasses.map((c) => [c.id, c.name]));

  const activeCampuses = allCampuses.filter((c) => c.is_active);
  const archivedCampuses = allCampuses.filter((c) => !c.is_active);
  const activeGrades = allGrades.filter((g) => g.is_active);
  const archivedGrades = allGrades.filter((g) => !g.is_active);
  const activeClasses = allClasses.filter((c) => c.is_active);
  const archivedClasses = allClasses.filter((c) => !c.is_active);

  const campusOptions = activeCampuses.map((c) => ({id: c.id, name: c.name}));
  // Cho form SỬA lớp: gồm cả khối đã lưu-trữ (kèm cờ is_active) để không âm thầm mất khối khi lớp
  // đang gắn một khối đã archive.
  const allGradeOptions = allGrades.map((g) => ({
    id: g.id,
    name: g.name,
    campus_id: g.campus_id,
    is_active: g.is_active,
  }));

  const areaMeta = buildAreaMeta(areaCfg);
  const areaRows = AREAS.map((a) => ({area: a, meta: areaMeta[a]}));
  const activeNetworks = networks.filter((n) => n.is_active).length;

  const pendingInvites = [
    ...grants.map((g) => ({
      email: g.email,
      detail: `${tr(g.role)}${g.class_id ? ` · ${className.get(g.class_id) ?? ''}` : ''}`,
    })),
    ...invites
      .filter((i) => i.status === 'pending')
      // Không kèm tên học sinh: danh sách một nghìn học sinh đã tách sang ParentFormLoader nạp
      // riêng. Mục này đang tắt; khi bật lại thì cho nó tự nạp tên nó cần, đừng kéo cả nghìn dòng
      // vào đường dựng trang chỉ để ghép một chuỗi.
      .map((i) => ({email: i.email, detail: tr('parent')})),
  ];

  // Mục lục màn hình. CHỈ liệt kê những trang quản trị viên THẬT SỰ MỞ ĐƯỢC từ đây.
  //
  // Bản cũ có thêm hai thẻ dẫn tới ngõ cụt: "/report" (chỉ phụ huynh vào được — admin bấm là bị đá
  // ngược về /admin, không một lời giải thích) và "/login" kèm chú thích "đăng xuất để xem", tức
  // một cái nút chỉ dùng được sau khi làm một việc khác. Thẻ bấm vào mà không tới đâu thì lần sau
  // người ta thôi tin cả cái mục lục.
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

  return (
    <>
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
          // PostgREST trả về đếm nhúng dạng [{count: n}]; lớp rỗng vẫn có một phần tử count 0.
          soWig: c.wigs?.[0]?.count ?? 0,
          soHocSinh: c.enrollments?.[0]?.count ?? 0,
        }))}
        teachers={staffList}
        defaultYear={schoolYearLabel(new Date())}
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
          mạng thì điểm danh cả trường hỏng ngay hôm ấy, còn nhãn/màu lĩnh vực thì sửa lúc nào cũng
          được. Gấp lại, nhưng CHƯA KHAI BÁO MẠNG NÀO thì nhãn cảnh báo hiện ngay trên đầu mục. */}
      <Disclosure
        title={t('networkTitle')}
        count={networks.length}
        badge={
          activeNetworks === 0 ? (
            <span className="rounded-full border border-warn/40 bg-warn/10 px-2.5 py-1 text-[11px] font-extrabold text-navy">
              {t('networkOpenBadge')}
            </span>
          ) : undefined
        }
      >
        {/* cidr là kiểu `cidr` của Postgres, không có kiểu TS tương ứng nên bộ sinh
            database.types.ts để `unknown`. PostgREST trả về nó dạng chuỗi ("10.0.0.0/24"), nên ép
            kiểu ở đây là đúng thực tế — và phải làm ở chỗ dùng, vì file types là file SINH TỰ
            ĐỘNG, sửa tay trong đó sẽ mất khi sinh lại. */}
        <SchoolNetworkManager
          networks={networks.map((n) => ({...n, cidr: String(n.cidr)}))}
          campuses={campusOptions}
          currentIp={currentIp}
        />
      </Disclosure>

      {/* Môn (4 lĩnh vực 4DX) — gấp lại: sửa nhãn/màu là việc vài lần một năm. */}
      <Disclosure title={t('manageAreas')} hint={t('areasHint')} count={areaRows.length}>
        <AreaConfigForm rows={areaRows} />
      </Disclosure>

      {/* Hai trang soạn thảo riêng — chỉ là lối vào, không nhét nội dung vào đây. Không làm tab
          trên thanh menu: đây là việc của một hai người mỗi tuần/mỗi năm, còn thanh menu thì mọi
          vai đều phải nhìn mỗi ngày (docs/NAV_IA.md). */}
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
    </>
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
              <SubmitButton className="inline-flex h-8 shrink-0 cursor-pointer items-center justify-center whitespace-nowrap rounded-[9px] bg-navy px-2.5 text-[11.5px] font-extrabold text-white transition-all hover:bg-navy-700">
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

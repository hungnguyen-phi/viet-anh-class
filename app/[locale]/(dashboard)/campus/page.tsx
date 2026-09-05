import {after} from 'next/server';
import {getTranslations, setRequestLocale} from 'next-intl/server';
import {requireRole} from '@/lib/auth';
import {createClient} from '@/lib/supabase/server';
import {schoolYearLabel, schoolYearRangeVN, mondayOf, shiftWeeks, todayInVN} from '@/lib/dates';
import type {SchoolLevel} from '@/lib/levels';
import {GradeManager} from '@/app/[locale]/(dashboard)/admin/GradeManager';
import {ClassForm} from '@/app/[locale]/(dashboard)/admin/ClassForm';
import {ClassManager} from '@/app/[locale]/(dashboard)/admin/ClassManager';
import {SchoolRollup, type RollupRow} from './SchoolRollup';
import {LichTuanHoc} from './LichTuanHoc';
import {CongTacNhapHo} from './CongTacNhapHo';
import {getAreaMeta} from '@/lib/area-config';
import {areaLabel, type Area} from '@/lib/areas';
import {TeacherManager} from './TeacherManager';
import {CampusLevelPicker} from './CampusLevelPicker';
import {Flash} from '@/components/ui/Flash';
import {MessageHealthCard} from '@/components/inbox/MessageHealthCard';
import {Link} from '@/i18n/navigation';
import {BookMarked} from 'lucide-react';
import {BoLocCoSo} from '@/components/campus/BoLocCoSo';
import {layTrangCampus} from '@/lib/trang-gop';

// ════════════════════════════════════════════════════════════════════════════════════════════
// /campus — MÀN HÌNH CẤP CƠ SỞ CỦA BAN GIÁM HIỆU (viết lại cho mô hình mục tiêu PA2, 40-C)
// ════════════════════════════════════════════════════════════════════════════════════════════
//
// Mô hình cũ (wigs / school_wig_rollup / cuon_so_lieu) đã DROP ở 0161–0169. Trang này nay đọc:
//   · campus_rollup()      — thi đua toàn trường theo khối (giữ, cột wig_count = mục tiêu lớp đã duyệt)
//   · co_so_tong_hop()     — mỗi lớp một dòng: % tới đích · việc · cam kết · họp · chờ duyệt (C3)
//   · muc_tieu_v (cap=lop, 'gui')  — mục tiêu lớp GVCN gửi, BGH duyệt ở đây (C2)
//   · muc_tieu_v (cap=truong)      — mục tiêu của chính cơ sở (C1)
//   · tuan_hoc             — lịch nghỉ/thi của cơ sở (C4)
//   · classes.nhap_ho      — bật nhập hộ cho lớp nhỏ (C5)
//
// Luật quyền nằm ở RLS/trigger của CSDL; các hàm SECURITY DEFINER trên tự giới hạn: admin thấy
// tất cả, hiệu trưởng chỉ cơ sở mình.

export default async function CampusPage({
  params,
  searchParams,
}: {
  params: Promise<{locale: string}>;
  searchParams: Promise<{nam?: string; khoi?: string}>;
}) {
  const {locale} = await params;
  const sp = await searchParams;
  setRequestLocale(locale);
  const profile = await requireRole(['principal', 'admin']);
  const t = await getTranslations('campusReport');
  const tCo = await getTranslations('coSoMucTieu');
  const tc = await getTranslations('common');
  const supabase = await createClient();

  const laBgh = profile.role === 'principal' && !!profile.campus_id;

  // MỘT LƯỢT ĐI CSDL cho cả trang (0190): trang_campus trả mọi khối đúng tên biến bên dưới. Khi
  // CSDL chưa có hàm (deploy code trước 0190) → null → đường nhiều câu cũ chạy y nguyên.
  const areaMetaPromise = getAreaMeta();
  const gop = await layTrangCampus(supabase, {
    campusId: laBgh ? (profile.campus_id as string) : null,
    nam: sp.nam ?? null,
    khoi: sp.khoi ?? null,
  });
  // Builder supabase-js là "thenable" lười: phải gọi .then() mới thật sự bắn request đi.
  const rollupPromise = gop
    ? Promise.resolve(gop.rows as RollupRow[])
    : supabase.rpc('campus_rollup').then(
        (r) => (r.data ?? []) as RollupRow[],
        () => [] as RollupRow[],
      );
  // C3 — mỗi lớp một dòng, tuần hiện tại (p_tuan mặc định = tuần chứa hôm nay).
  const coSoPromise = gop
    ? Promise.resolve(gop.coSoTatCa)
    : supabase.rpc('co_so_tong_hop', {}).then(
        (r) => r.data ?? [],
        () => [],
      );

  // BGH quản lý Cơ sở mình (admin dùng /admin). Các truy vấn dưới đây độc lập → chạy song song.
  let mgmt: null | {
    campusId: string;
    campusName: string;
    levels: SchoolLevel[];
    gradesActive: {id: string; name: string; sort_order: number}[];
    gradeOptions: {id: string; name: string; campus_id: string}[];
    gradeAll: {id: string; name: string; campus_id: string; is_active: boolean}[];
    classes: {
      id: string;
      name: string;
      grade_id: string | null;
      grade: string | null;
      school_year: string;
      campus_id: string;
      homeroom_teacher_id: string | null;
      nhap_ho: boolean;
    }[];
    teachers: {id: string; full_name: string | null; email: string}[];
    staff: {id: string; full_name: string | null; email: string; role: string; homerooms: string[]}[];
    invites: {email: string; created_at: string}[];
    defaultYear: string;
  } = null;

  if (profile.role === 'principal' && profile.campus_id) {
    const campusId = profile.campus_id;
    type GrRow = {id: string; name: string; sort_order: number; is_active: boolean; campus_id: string};
    type ClsRow = {id: string; name: string; grade_id: string | null; grade: string | null; school_year: string; campus_id: string; homeroom_teacher_id: string | null; is_active: boolean; nhap_ho: boolean};
    type StaffRow = {id: string; full_name: string | null; email: string; role: string};
    const [{data: gr}, {data: cls}, {data: staffRows}, {data: cp}, {data: inv}] = gop
      ? [
          {data: gop.gr as GrRow[]},
          {data: gop.cls as ClsRow[]},
          {data: gop.staffRows as StaffRow[]},
          {data: gop.cp as {name: string; levels: unknown} | null},
          {data: gop.inv},
        ]
      : await Promise.all([
      supabase
        .from('grades')
        .select('id, name, sort_order, is_active, campus_id')
        .eq('campus_id', campusId)
        .order('sort_order'),
      supabase
        .from('classes')
        .select('id, name, grade_id, grade, school_year, campus_id, homeroom_teacher_id, is_active, nhap_ho')
        .eq('campus_id', campusId)
        .eq('is_active', true)
        .order('name'),
      // Nhân sự trong cơ sở: giáo viên đang hoạt động + người đang bị vô hiệu ('pending').
      supabase
        .from('profiles')
        .select('id, full_name, email, role')
        .eq('campus_id', campusId)
        .in('role', ['teacher', 'pending'])
        .order('email')
        .limit(500),
      supabase.from('campuses').select('name, levels').eq('id', campusId).maybeSingle(),
      supabase
        .from('pending_user_grants')
        .select('email, created_at')
        .eq('campus_id', campusId)
        .eq('role', 'teacher')
        .order('created_at', {ascending: false}),
    ]);

    const grades = gr ?? [];
    const classes = cls ?? [];
    const staffList = staffRows ?? [];

    mgmt = {
      campusId,
      campusName: cp?.name ?? '',
      levels: (cp?.levels ?? []) as SchoolLevel[],
      gradesActive: grades
        .filter((g) => g.is_active)
        .map((g) => ({id: g.id, name: g.name, sort_order: g.sort_order})),
      gradeOptions: grades
        .filter((g) => g.is_active)
        .map((g) => ({id: g.id, name: g.name, campus_id: g.campus_id})),
      gradeAll: grades.map((g) => ({
        id: g.id,
        name: g.name,
        campus_id: g.campus_id,
        is_active: g.is_active,
      })),
      classes: classes.map((c) => ({
        id: c.id,
        name: c.name,
        grade_id: c.grade_id,
        grade: c.grade,
        school_year: c.school_year,
        campus_id: c.campus_id,
        homeroom_teacher_id: c.homeroom_teacher_id,
        nhap_ho: c.nhap_ho,
      })),
      // Gồm CẢ người còn ở vai 'chờ cấp quyền' (vừa đăng nhập lần đầu, chưa được nâng vai).
      // Chọn xong thì createClass/updateClass tự nâng vai họ lên 'teacher'.
      teachers: staffList
        .filter((s) => s.role === 'teacher' || s.role === 'pending')
        .map((s) => ({
          id: s.id,
          full_name:
            s.role === 'pending'
              ? `${s.full_name ?? s.email} — ${t('chuaCapQuyenChon')}`
              : s.full_name,
          email: s.email,
        })),
      // Ghép sẵn tên lớp chủ nhiệm — dữ liệu đã có trong `classes`, không cần truy vấn thêm.
      staff: staffList.map((s) => ({
        id: s.id,
        full_name: s.full_name,
        email: s.email,
        role: s.role,
        homerooms: classes.filter((c) => c.homeroom_teacher_id === s.id).map((c) => c.name),
      })),
      invites: inv ?? [],
      defaultYear: schoolYearLabel(new Date()),
    };
  }

  const [rows, coSoTatCa, areaMeta] = await Promise.all([rollupPromise, coSoPromise, areaMetaPromise]);

  // BỘ LỌC Năm học → Khối (04/09/2026): "Lớp nào đi chậm" liệt kê mọi lớp một bảng — BGH cần lọc
  // được khối. Lớp lấy theo cơ sở của BGH (admin: mọi lớp); RLS tự giới hạn.
  type LopLoc = {id: string; school_year: string; grade_id: string | null; grades: {name: string; sort_order: number} | null};
  let lopRows: unknown[] | null;
  if (gop) {
    lopRows = gop.lopRows;
  } else {
    const lopQ = supabase.from('classes').select('id, school_year, grade_id, grades(name, sort_order)').eq('is_active', true);
    lopRows = (await (laBgh ? lopQ.eq('campus_id', profile.campus_id as string) : lopQ)).data;
  }
  const lopLoc = (lopRows ?? []) as unknown as LopLoc[];
  const namList = [...new Set(lopLoc.map((l) => l.school_year))].sort().reverse();
  const namChon = sp.nam && namList.includes(sp.nam) ? sp.nam : (namList[0] ?? '');
  const khoiMap = new Map<string, {id: string; name: string; sort: number}>();
  for (const l of lopLoc) {
    if (l.grade_id && l.school_year === namChon && !khoiMap.has(l.grade_id)) {
      khoiMap.set(l.grade_id, {id: l.grade_id, name: l.grades?.name ?? '', sort: l.grades?.sort_order ?? 9999});
    }
  }
  const khoiList = [...khoiMap.values()].sort((a, b) => a.sort - b.sort);
  const khoiChon = sp.khoi && khoiMap.has(sp.khoi) ? sp.khoi : '';
  const lopHopLe = new Set(lopLoc.filter((l) => l.school_year === namChon && (!khoiChon || l.grade_id === khoiChon)).map((l) => l.id));
  const coSo = (coSoTatCa as CoSoRow[]).filter((r) => lopHopLe.has(r.class_id));

  // C1 — mục tiêu của CHÍNH cơ sở. Chỉ hiệu trưởng của cơ sở này quản; admin xem qua /admin.
  type MtTruongRow = {id: string | null; ten: string | null; linh_vuc: string | null; pct: number | null; trang_thai: string | null; nguon_so: string | null};
  const mtTruong: MtTruongRow[] = !laBgh
    ? []
    : gop
      ? (gop.mtTruong as MtTruongRow[])
      : ((
          await supabase
            .from('muc_tieu_v')
            .select('id, ten, linh_vuc, pct, trang_thai, nguon_so')
            .eq('cap', 'truong')
            .neq('trang_thai', 'dong')
            .order('created_at', {ascending: false})
        ).data ?? []) as MtTruongRow[];

  // C4 — lịch tuần học của cơ sở: dựng đủ 52 tuần của năm học, tô loại từ bảng tuan_hoc.
  const lichWeeks: {monday: string; thang: number; loai: 'hoc' | 'nghi' | 'thi'; quaKhu: boolean}[] = [];
  let namHoc = '';
  if (laBgh) {
    const {start, end, label} = schoolYearRangeVN();
    namHoc = label;
    const th = gop
      ? gop.tuanHoc
      : (
          await supabase
            .from('tuan_hoc')
            .select('week_start, loai')
            .eq('campus_id', profile.campus_id as string)
            .gte('week_start', start)
            .lte('week_start', end)
        ).data;
    const loaiMap = new Map((th ?? []).map((r) => [r.week_start, r.loai]));
    const endMon = mondayOf(end);
    const todayMon = mondayOf(todayInVN());
    let m = mondayOf(start);
    // Chặn an toàn ~54 vòng: một năm học không quá 53 tuần.
    for (let i = 0; i < 54 && m <= endMon; i++) {
      const raw = loaiMap.get(m);
      const loai: 'hoc' | 'nghi' | 'thi' = raw === 'nghi' || raw === 'thi' ? raw : 'hoc';
      lichWeeks.push({monday: m, thang: Number(m.slice(5, 7)), loai, quaKhu: m < todayMon});
      m = shiftWeeks(m, 1);
    }
  }

  // Nhật ký kiểm toán không nằm trên đường tới hạn — chạy sau khi trả trang.
  after(() => {
    void supabase.rpc('log_audit', {p_action: 'view_campus_report'});
  });

  return (
    <div className="flex flex-col gap-3.5">
      <h1 className="font-display text-dau font-bold text-navy">{t('title')}</h1>

      <Flash />

      {/* C2 (mục tiêu lớp chờ BGH duyệt) đã GỠ — từ 0186 GVCN tạo mục tiêu lớp là hiệu lực ngay. */}

      {/* PHÂN BIỆT "CHƯA ĐƯỢC GÁN CƠ SỞ" VỚI "CƠ SỞ CHƯA CÓ LỚP". Hiệu trưởng chưa được gán cơ
          sở thì khối truy vấn quản lý bị bỏ qua, rồi trang rơi vào câu "chưa có lớp" trong khi
          trường đang có lớp — đổ cho dữ liệu thay vì nói đúng tình trạng của người đang đứng đó. */}
      {profile.role === 'principal' && !profile.campus_id ? (
        <p className="rounded-[12px] bg-warn/[0.10] px-4 py-3 text-sm font-semibold leading-relaxed text-navy">
          {t('noCampusAssigned')}
        </p>
      ) : rows.length === 0 ? (
        <p className="text-sm italic text-grey-mid">{t('noClasses')}</p>
      ) : (
        // THU GỌN (audit 04/09/2026): trang này dài 8487px ở 360px vì hai bảng liệt kê đủ 28 lớp.
        // Bảng tổng hợp theo khối xếp gọn, bấm mới mở — thứ BGH cần liếc mỗi ngày là "lớp nào cần
        // chú ý" ở khối ngay dưới.
        <details className="glass rounded-[20px] p-[18px]">
          <summary className="min-h-11 cursor-pointer list-none font-display text-noi-dung font-bold text-navy marker:content-none [&::-webkit-details-marker]:hidden">
            {tc('tatCaLop', {n: rows.length})} · {t('title')}
          </summary>
          <div className="mt-3">
            <SchoolRollup rows={rows} />
          </div>
        </details>
      )}

      {/* C3 — LỚP NÀO ĐI CHẬM. Bảng từ co_so_tong_hop, sắp theo trung bình các % có số (tính ở
          app, không lưu). Tô nền cảnh báo khi có ≥1 số < 50%. */}
      {(namList.length > 1 || khoiList.length > 1) && (
        <BoLocCoSo namList={namList} khoiList={khoiList.map((k) => ({id: k.id, name: k.name}))} nam={namChon} khoi={khoiChon} />
      )}
      <div data-hd="ad-co-so">
        <LopDiCham rows={coSo} t={tCo} tc={tc} />
      </div>

      {/* C1 — MỤC TIÊU CỦA CƠ SỞ. Tầng trên cùng: trường đếm lớp, lớp đếm em. Số của nó do máy
          cuộn từ mục tiêu lớp, không ai gõ. */}
      {laBgh && (
        <section className="glass rounded-[20px] p-[18px]">
          <div className="mb-3 font-display text-noi-dung font-bold text-navy">{tCo('khuMucTieu')}</div>
          {mtTruong.length === 0 ? (
            <p className="rounded-[12px] border-[1.5px] border-dashed border-navy/15 p-4 text-center text-than font-semibold italic leading-relaxed text-grey-mid">
              {tCo('mucTieuTrong')}
            </p>
          ) : (
            <div className="flex flex-col gap-3">
              {mtTruong.map((w) => {
                const meta = w.linh_vuc ? areaMeta[w.linh_vuc as Area] : null;
                const pct = Math.round((w.pct ?? 0) * 100);
                return (
                  <div key={w.id ?? ''}>
                    <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                      {meta && (
                        <span
                          className="inline-flex w-fit items-center rounded-full px-2 py-0.5 text-nhan font-extrabold"
                          style={{background: meta.soft, color: meta.hex}}
                        >
                          {areaLabel(meta, locale)}
                        </span>
                      )}
                      <span className="min-w-0 flex-1 truncate text-than font-bold text-navy" title={w.ten ?? ''}>
                        {w.ten}
                      </span>
                      <span className="shrink-0 text-than font-extrabold tabular-nums text-navy">
                        {pct}%
                      </span>
                    </div>
                    <div className="mt-1.5 h-[8px] w-full overflow-hidden rounded-[8px] bg-navy/[0.08]">
                      <div
                        className="h-full rounded-[8px]"
                        style={{
                          width: `${Math.min(100, pct)}%`,
                          background: pct >= 100 ? 'var(--color-success)' : 'var(--color-warn)',
                        }}
                      />
                    </div>
                    <p className="mt-1 text-nhan font-bold text-grey-mid">
                      {w.nguon_so === 'con' ? tCo('cuon') : tCo('tuDo')}
                    </p>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      )}

      {/* Môn riêng của cơ sở + phân công giáo viên bộ môn cho từng lớp. Hiệu trưởng sửa được môn
          RIÊNG của cơ sở mình; môn dùng chung toàn trường thì chỉ quản trị viên đổi (RLS 0069). */}
      <section className="glass rounded-[20px] p-[18px]">
        <div className="mb-3 font-display text-noi-dung font-bold text-navy">{t('subjectsCard')}</div>
        <p className="mb-3 text-xs text-grey-mid">{t('subjectsCardHint')}</p>
        <Link
          href="/subjects"
          className="inline-flex min-h-[44px] cursor-pointer items-center gap-1.5 rounded-[8px] border-[1.5px] border-navy/20 bg-white px-3 text-than font-extrabold text-navy transition-all hover:border-navy"
        >
          <BookMarked size={14} strokeWidth={2} />
          {t('openSubjects')}
        </Link>
      </section>

      <MessageHealthCard />

      {/* C4 — LỊCH TUẦN HỌC (nghỉ / thi) và C5 — NHẬP HỘ: cả hai ở cấp cơ sở, chỉ hiệu trưởng
          của chính cơ sở này đặt. */}
      {laBgh && <LichTuanHoc nam={namHoc} weeks={lichWeeks} />}
      {mgmt && <CongTacNhapHo classes={mgmt.classes.map((c) => ({id: c.id, name: c.name, nhap_ho: c.nhap_ho}))} />}

      {mgmt && (
        <>
          <section className="glass rounded-[20px] p-[18px]">
            <div className="mb-3 font-display text-noi-dung font-bold text-navy">
              {t('manageTeachers')} · {mgmt.campusName}
            </div>
            <TeacherManager teachers={mgmt.staff} invites={mgmt.invites} />
          </section>

          <section className="glass rounded-[20px] p-[18px]">
            <div className="mb-3 font-display text-noi-dung font-bold text-navy">
              {t('manageGrades')} · {mgmt.campusName}
            </div>
            {/* Chọn cấp học trước — khối sinh ra từ đây, không ai phải gõ tên khối nữa. */}
            <CampusLevelPicker levels={mgmt.levels} />
            <GradeManager campusId={mgmt.campusId} grades={mgmt.gradesActive} levels={mgmt.levels} />
          </section>

          <section className="glass rounded-[20px] p-[18px]">
            <div className="mb-3 font-display text-noi-dung font-bold text-navy">{t('createClass')}</div>
            <ClassForm
              campuses={[{id: mgmt.campusId, name: mgmt.campusName}]}
              grades={mgmt.gradeOptions}
              teachers={mgmt.teachers}
              defaultYear={mgmt.defaultYear}
            />
          </section>

          <section className="glass rounded-[20px] p-[18px]">
            <ClassManager
              classes={mgmt.classes}
              campuses={[{id: mgmt.campusId, name: mgmt.campusName}]}
              grades={mgmt.gradeAll}
              teachers={mgmt.teachers}
            />
          </section>
        </>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════════════════════
// C3 — LỚP NÀO ĐI CHẬM
// ════════════════════════════════════════════════════════════════════════════════════════════
//
// thu_tu_sap = trung bình các % CÓ SỐ (bỏ null); lớp chưa có số nào xuống cuối (chưa vào cuộc,
// không phải đang thua). Tô nền cảnh báo khi có ≥1 số < 50%. Cột null hiện "—" (chuaCoSo).
type CoSoRow = {
  class_id: string;
  class_name: string;
  gvcn_ten: string | null;
  mt_pct: number | null;
  thuoc_dat_pct: number | null;
  ck_giu_pct: number | null;
  pdr_ky_pct: number | null;
  cho_duyet: number;
};

function LopDiCham({
  rows,
  t,
  tc,
}: {
  rows: CoSoRow[];
  t: (k: string) => string;
  tc: (k: string, v?: Record<string, string | number>) => string;
}) {
  const coSo = rows.map((r) => {
    const cac = [r.mt_pct, r.thuoc_dat_pct, r.ck_giu_pct, r.pdr_ky_pct].filter(
      (x): x is number => x != null,
    );
    const tb = cac.length ? cac.reduce((a, b) => a + b, 0) / cac.length : null;
    const canhBao = cac.some((x) => x < 50);
    return {...r, thu_tu_sap: tb, canhBao};
  });
  // Có số → xếp trước theo tăng dần (chậm nhất lên đầu); chưa có số → xuống cuối.
  coSo.sort((a, b) => {
    if (a.thu_tu_sap == null) return b.thu_tu_sap == null ? 0 : 1;
    if (b.thu_tu_sap == null) return -1;
    return a.thu_tu_sap - b.thu_tu_sap;
  });

  const so = (x: number | null) => (x == null ? t('chuaCoSo') : `${Math.round(x)}%`);
  const canChuY = coSo.filter((r) => r.canhBao);
  const conLai = coSo.filter((r) => !r.canhBao);

  return (
    <section className="glass overflow-hidden rounded-[20px]">
      <div className="px-[18px] pb-1 pt-4 font-display text-noi-dung font-bold text-navy">
        {t('khuLopCham')}
      </div>
      {coSo.length === 0 ? (
        <p className="px-[18px] pb-4 text-than font-semibold italic text-grey-mid">
          {t('lopChamTrong')}
        </p>
      ) : (
        <>
          {/* Mặc định chỉ hiện lớp CẦN CHÚ Ý; số còn lại xếp trong <details> (audit 04/09/2026). */}
          {canChuY.length === 0 && (
            <p className="px-[18px] pb-3 text-than font-semibold italic text-grey-mid">{t('lopChamTrong')}</p>
          )}
          <BangLop rows={canChuY} t={t} so={so} />
          {conLai.length > 0 && (
            <details className="border-t border-navy/[0.08]">
              <summary className="min-h-11 cursor-pointer list-none px-[18px] py-2.5 text-than font-extrabold text-navy marker:content-none [&::-webkit-details-marker]:hidden">
                {tc('xemTatCa')} · {tc('tatCaLop', {n: coSo.length})}
              </summary>
              <BangLop rows={conLai} t={t} so={so} />
            </details>
          )}
        </>
      )}
    </section>
  );
}

function BangLop({
  rows,
  t,
  so,
}: {
  rows: (CoSoRow & {canhBao: boolean})[];
  t: (k: string) => string;
  so: (x: number | null) => string;
}) {
  if (rows.length === 0) return null;
  return (
    <>
      {/* ĐIỆN THOẠI: mỗi lớp một thẻ + 5 ô số — bảng 7 cột không vừa 360px. */}
      <ul className="flex flex-col gap-2 px-3 py-2 sm:hidden">
        {rows.map((r) => (
          <li key={r.class_id} className={`rounded-[12px] border-[1.5px] p-3 ${r.canhBao ? 'border-status-bad/30 bg-status-bad/[0.05]' : 'border-navy/10 bg-white'}`}>
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-noi-dung font-extrabold text-navy">{r.class_name}</span>
              <span className="truncate text-chu-thich font-semibold text-grey-mid">{r.gvcn_ten ?? '—'}</span>
            </div>
            <div className="mt-2 grid grid-cols-5 gap-1 text-center">
              {[
                [t('cotMucTieu'), so(r.mt_pct)],
                [t('cotViec'), so(r.thuoc_dat_pct)],
                [t('cotCamKet'), so(r.ck_giu_pct)],
                [t('cotHop'), so(r.pdr_ky_pct)],
                [t('cotChoDuyet'), r.cho_duyet > 0 ? String(r.cho_duyet) : '—'],
              ].map(([nhan, gia]) => (
                <div key={nhan} className="rounded-[8px] bg-navy/[0.04] px-1 py-1.5">
                  <div className="text-than font-extrabold tabular-nums text-navy">{gia}</div>
                  <div className="text-nhan font-extrabold uppercase tracking-wide text-grey-mid">{nhan}</div>
                </div>
              ))}
            </div>
          </li>
        ))}
      </ul>
        <div className="hidden overflow-x-auto sm:block">
          <div className="min-w-[560px]">
            <div className="grid grid-cols-[minmax(0,1.4fr)_minmax(0,1.2fr)_repeat(5,minmax(0,1fr))] items-center gap-2 bg-navy/[0.03] px-[18px] py-2.5 text-nhan font-extrabold uppercase tracking-wide text-grey-mid">
              <span>{t('cotLop')}</span>
              <span>{t('cotGvcn')}</span>
              <span className="text-center">{t('cotMucTieu')}</span>
              <span className="text-center">{t('cotViec')}</span>
              <span className="text-center">{t('cotCamKet')}</span>
              <span className="text-center">{t('cotHop')}</span>
              <span className="text-center">{t('cotChoDuyet')}</span>
            </div>
            {rows.map((r) => (
              <div
                key={r.class_id}
                className={`grid grid-cols-[minmax(0,1.4fr)_minmax(0,1.2fr)_repeat(5,minmax(0,1fr))] items-center gap-2 border-t border-navy/[0.08] px-[18px] py-2.5 ${
                  r.canhBao ? 'bg-status-bad/[0.06]' : ''
                }`}
              >
                <span className="truncate text-than font-bold text-navy">{r.class_name}</span>
                <span className="truncate text-than font-semibold text-grey-mid">
                  {r.gvcn_ten ?? '—'}
                </span>
                <span className="text-center text-than font-bold tabular-nums text-navy">
                  {so(r.mt_pct)}
                </span>
                <span className="text-center text-than font-semibold tabular-nums text-grey-mid">
                  {so(r.thuoc_dat_pct)}
                </span>
                <span className="text-center text-than font-semibold tabular-nums text-grey-mid">
                  {so(r.ck_giu_pct)}
                </span>
                <span className="text-center text-than font-semibold tabular-nums text-grey-mid">
                  {so(r.pdr_ky_pct)}
                </span>
                <span className="text-center text-than font-bold tabular-nums text-navy">
                  {r.cho_duyet > 0 ? r.cho_duyet : '—'}
                </span>
              </div>
            ))}
          </div>
        </div>
    </>
  );
}

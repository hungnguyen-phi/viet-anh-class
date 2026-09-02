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
import {NutDuyet} from '@/components/wig/NutDuyet';
import {NutTraLaiMtLop} from '@/components/campus/NutTraLaiMtLop';
import {duyetMucTieuLop} from './actions';
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
}: {
  params: Promise<{locale: string}>;
}) {
  const {locale} = await params;
  setRequestLocale(locale);
  const profile = await requireRole(['principal', 'admin']);
  const t = await getTranslations('campusReport');
  const tCo = await getTranslations('coSoMucTieu');
  const supabase = await createClient();

  const laBgh = profile.role === 'principal' && !!profile.campus_id;

  // MỘT ĐỢT phóng song song mọi truy vấn cấp trường — không câu nào cần kết quả câu nào. Builder
  // supabase-js là "thenable" lười: phải gọi .then() mới thật sự bắn request đi.
  const rollupPromise = supabase.rpc('campus_rollup').then(
    (r) => (r.data ?? []) as RollupRow[],
    () => [] as RollupRow[],
  );
  // C3 — mỗi lớp một dòng, tuần hiện tại (p_tuan mặc định = tuần chứa hôm nay).
  const coSoPromise = supabase.rpc('co_so_tong_hop', {}).then(
    (r) => r.data ?? [],
    () => [],
  );
  // C2 — mục tiêu LỚP đang chờ BGH duyệt (RLS giới hạn đúng cơ sở của hiệu trưởng).
  const choDuyetPromise = supabase
    .from('muc_tieu_v')
    .select('id, ten, class_id, linh_vuc, y_so, ten_don_vi, y_chu, kieu_dich')
    .eq('cap', 'lop')
    .eq('trang_thai', 'gui')
    .order('created_at', {ascending: true})
    .then(
      (r) => r.data ?? [],
      () => [],
    );
  const areaMetaPromise = getAreaMeta();

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
    const [{data: gr}, {data: cls}, {data: staffRows}, {data: cp}, {data: inv}] = await Promise.all([
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
              ? `${s.full_name ?? s.email} — chưa cấp quyền, chọn là cấp luôn`
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

  const [rows, coSo, choDuyet, areaMeta] = await Promise.all([
    rollupPromise,
    coSoPromise,
    choDuyetPromise,
    areaMetaPromise,
  ]);

  // Tên lớp cho khối Chờ duyệt (muc_tieu_v chỉ có class_id) — dựng từ chính co_so_tong_hop.
  const tenLop = new Map(coSo.map((c) => [c.class_id, c.class_name]));

  // C1 — mục tiêu của CHÍNH cơ sở. Chỉ hiệu trưởng của cơ sở này quản; admin xem qua /admin.
  const mtTruong = laBgh
    ? (
        await supabase
          .from('muc_tieu_v')
          .select('id, ten, linh_vuc, pct, trang_thai, nguon_so')
          .eq('cap', 'truong')
          .neq('trang_thai', 'dong')
          .order('created_at', {ascending: false})
      ).data ?? []
    : [];

  // C4 — lịch tuần học của cơ sở: dựng đủ 52 tuần của năm học, tô loại từ bảng tuan_hoc.
  const lichWeeks: {monday: string; thang: number; loai: 'hoc' | 'nghi' | 'thi'; quaKhu: boolean}[] = [];
  let namHoc = '';
  if (laBgh) {
    const {start, end, label} = schoolYearRangeVN();
    namHoc = label;
    const {data: th} = await supabase
      .from('tuan_hoc')
      .select('week_start, loai')
      .eq('campus_id', profile.campus_id as string)
      .gte('week_start', start)
      .lte('week_start', end);
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
      <h1 className="font-display text-[22px] font-bold text-navy">{t('title')}</h1>

      <Flash />

      {/* C2 — MỤC TIÊU LỚP CHỜ DUYỆT. GVCN gửi (trạng thái 'gui'), BGH gật ở đây. Trigger
          mt_lop_qua_tay_bgh chặn GVCN tự duyệt; RLS giới hạn đúng cơ sở. */}
      <section className="glass rounded-[20px] p-[18px]">
        <div className="mb-3 font-display text-[15px] font-bold text-navy">{tCo('khuChoDuyet')}</div>
        {choDuyet.length === 0 ? (
          <p className="text-[12.5px] font-semibold italic text-grey-mid">{tCo('choDuyetTrong')}</p>
        ) : (
          <div className="flex flex-col gap-2">
            {choDuyet.map((w) => {
              const meta = w.linh_vuc ? areaMeta[w.linh_vuc as Area] : null;
              const dich =
                w.kieu_dich === 'chu'
                  ? w.y_chu
                  : [w.y_so, w.ten_don_vi].filter(Boolean).join(' ');
              return (
                <div key={w.id ?? ''} className="flex flex-wrap items-center gap-2">
                  <span className="min-w-[80px] text-[12.5px] font-extrabold text-navy">
                    {(w.class_id && tenLop.get(w.class_id)) || '—'}
                  </span>
                  {meta && (
                    <span
                      className="inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[10px] font-extrabold"
                      style={{background: meta.soft, color: meta.hex}}
                    >
                      {areaLabel(meta, locale)}
                    </span>
                  )}
                  <span className="min-w-0 flex-1 text-[12.5px] font-semibold text-grey-mid">
                    {w.ten}
                    {dich ? ` · ${dich}` : ''}
                  </span>
                  <NutDuyet
                    hanhDong={duyetMucTieuLop}
                    o={{muc_tieu_id: w.id ?? undefined}}
                    label={`${tCo('cotChoDuyet')} — ${w.ten ?? ''}`}
                  />
                  <NutTraLaiMtLop mtId={w.id ?? ''} ten={w.ten ?? ''} />
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* PHÂN BIỆT "CHƯA ĐƯỢC GÁN CƠ SỞ" VỚI "CƠ SỞ CHƯA CÓ LỚP". Hiệu trưởng chưa được gán cơ
          sở thì khối truy vấn quản lý bị bỏ qua, rồi trang rơi vào câu "chưa có lớp" trong khi
          trường đang có lớp — đổ cho dữ liệu thay vì nói đúng tình trạng của người đang đứng đó. */}
      {profile.role === 'principal' && !profile.campus_id ? (
        <p className="rounded-[14px] bg-warn/[0.10] px-4 py-3 text-sm font-semibold leading-relaxed text-navy">
          {t('noCampusAssigned')}
        </p>
      ) : rows.length === 0 ? (
        <p className="text-sm italic text-grey-mid">{t('noClasses')}</p>
      ) : (
        <SchoolRollup rows={rows} />
      )}

      {/* C3 — LỚP NÀO ĐI CHẬM. Bảng từ co_so_tong_hop, sắp theo trung bình các % có số (tính ở
          app, không lưu). Tô nền cảnh báo khi có ≥1 số < 50%. */}
      <LopDiCham rows={coSo} t={tCo} />

      {/* C1 — MỤC TIÊU CỦA CƠ SỞ. Tầng trên cùng: trường đếm lớp, lớp đếm em. Số của nó do máy
          cuộn từ mục tiêu lớp, không ai gõ. */}
      {laBgh && (
        <section className="glass rounded-[20px] p-[18px]">
          <div className="mb-3 font-display text-[15px] font-bold text-navy">{tCo('khuMucTieu')}</div>
          {mtTruong.length === 0 ? (
            <p className="rounded-[14px] border-[1.5px] border-dashed border-navy/15 p-4 text-center text-[12.5px] font-semibold italic leading-relaxed text-grey-mid">
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
                          className="inline-flex w-fit items-center rounded-full px-2 py-0.5 text-[10.5px] font-extrabold"
                          style={{background: meta.soft, color: meta.hex}}
                        >
                          {areaLabel(meta, locale)}
                        </span>
                      )}
                      <span className="min-w-0 flex-1 truncate text-[13px] font-bold text-navy" title={w.ten ?? ''}>
                        {w.ten}
                      </span>
                      <span className="shrink-0 text-[12.5px] font-extrabold tabular-nums text-navy">
                        {pct}%
                      </span>
                    </div>
                    <div className="mt-1.5 h-[8px] w-full overflow-hidden rounded-[5px] bg-navy/[0.08]">
                      <div
                        className="h-full rounded-[5px]"
                        style={{
                          width: `${Math.min(100, pct)}%`,
                          background: pct >= 100 ? 'var(--color-success)' : 'var(--color-warn)',
                        }}
                      />
                    </div>
                    <p className="mt-1 text-[11px] font-bold text-grey-mid">
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
        <div className="mb-3 font-display text-[15px] font-bold text-navy">{t('subjectsCard')}</div>
        <p className="mb-3 text-xs text-grey-mid">{t('subjectsCardHint')}</p>
        <Link
          href="/subjects"
          className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-[10px] border-[1.5px] border-navy/20 bg-white px-3 text-[12.5px] font-extrabold text-navy transition-all hover:border-navy"
        >
          <BookMarked size={14} strokeWidth={2.2} />
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
            <div className="mb-3 font-display text-[15px] font-bold text-navy">
              {t('manageTeachers')} · {mgmt.campusName}
            </div>
            <TeacherManager teachers={mgmt.staff} invites={mgmt.invites} />
          </section>

          <section className="glass rounded-[20px] p-[18px]">
            <div className="mb-3 font-display text-[15px] font-bold text-navy">
              {t('manageGrades')} · {mgmt.campusName}
            </div>
            {/* Chọn cấp học trước — khối sinh ra từ đây, không ai phải gõ tên khối nữa. */}
            <CampusLevelPicker levels={mgmt.levels} />
            <GradeManager campusId={mgmt.campusId} grades={mgmt.gradesActive} levels={mgmt.levels} />
          </section>

          <section className="glass rounded-[20px] p-[18px]">
            <div className="mb-3 font-display text-[15px] font-bold text-navy">{t('createClass')}</div>
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
}: {
  rows: CoSoRow[];
  t: (k: string) => string;
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

  return (
    <section className="glass overflow-hidden rounded-[20px]">
      <div className="px-[18px] pb-1 pt-4 font-display text-[15px] font-bold text-navy">
        {t('khuLopCham')}
      </div>
      {coSo.length === 0 ? (
        <p className="px-[18px] pb-4 text-[12.5px] font-semibold italic text-grey-mid">
          {t('lopChamTrong')}
        </p>
      ) : (
        <div className="overflow-x-auto">
          <div className="min-w-[560px]">
            <div className="grid grid-cols-[minmax(0,1.4fr)_minmax(0,1.2fr)_repeat(5,minmax(0,1fr))] items-center gap-2 bg-navy/[0.03] px-[18px] py-2.5 text-[11px] font-extrabold uppercase tracking-wide text-grey-mid">
              <span>{t('cotLop')}</span>
              <span>{t('cotGvcn')}</span>
              <span className="text-center">{t('cotMucTieu')}</span>
              <span className="text-center">{t('cotViec')}</span>
              <span className="text-center">{t('cotCamKet')}</span>
              <span className="text-center">{t('cotHop')}</span>
              <span className="text-center">{t('cotChoDuyet')}</span>
            </div>
            {coSo.map((r) => (
              <div
                key={r.class_id}
                className={`grid grid-cols-[minmax(0,1.4fr)_minmax(0,1.2fr)_repeat(5,minmax(0,1fr))] items-center gap-2 border-t border-navy/[0.08] px-[18px] py-2.5 ${
                  r.canhBao ? 'bg-status-bad/[0.06]' : ''
                }`}
              >
                <span className="truncate text-[13px] font-bold text-navy">{r.class_name}</span>
                <span className="truncate text-[12.5px] font-semibold text-grey-mid">
                  {r.gvcn_ten ?? '—'}
                </span>
                <span className="text-center text-[12.5px] font-bold tabular-nums text-navy">
                  {so(r.mt_pct)}
                </span>
                <span className="text-center text-[12.5px] font-semibold tabular-nums text-grey-mid">
                  {so(r.thuoc_dat_pct)}
                </span>
                <span className="text-center text-[12.5px] font-semibold tabular-nums text-grey-mid">
                  {so(r.ck_giu_pct)}
                </span>
                <span className="text-center text-[12.5px] font-semibold tabular-nums text-grey-mid">
                  {so(r.pdr_ky_pct)}
                </span>
                <span className="text-center text-[12.5px] font-bold tabular-nums text-navy">
                  {r.cho_duyet > 0 ? r.cho_duyet : '—'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

import {getTranslations} from 'next-intl/server';
import {Link} from '@/i18n/navigation';
import {createClient} from '@/lib/supabase/server';
import {boDau} from '@/lib/don-vi';
import {Disclosure} from './Disclosure';
import {UsersToolbar} from './UsersToolbar';
import {UsersTable} from './UsersTable';
import {layDanhMuc} from './admin-data';
import {USER_TABS, type UserTab, type Role} from './user-tabs';

// inline-flex items-center KHÔNG phải thừa: h-8 dựng hộp cao 32px, nhưng chữ chỉ tự nằm giữa hộp
// khi phần tử là <button> (trình duyệt căn sẵn nội dung nút). Trên <a> và <span> — hai nút phân
// trang bên dưới — chữ bám mép trên, lệch 6px so với nhãn "Trang 1/5" ở giữa. Đã đo trên production.
const outlineBtnSm =
  'inline-flex h-11 min-h-[44px] cursor-pointer items-center justify-center whitespace-nowrap rounded-[12px] border-[1.5px] border-navy/20 bg-white/60 px-3 text-chu-thich font-extrabold text-navy transition-all hover:border-navy';

// BỘ LỌC THEO NƠI HỌC: cơ sở → khối → lớp. Chỉ có nghĩa với HỌC SINH (nơi học = enrollments).
// Giáo viên/BGH không "thuộc" một lớp theo cách ấy, nên khi bật bộ lọc này trang ép tab về Học sinh.
export type LocNoiHoc = {cs: string; khoi: string; lop: string};

// Cột tìm không dấu (0187: profiles.full_name_khong_dau, generated). Trước khi migration chạy, cột
// chưa có → PostgREST trả 42703; khi ấy rơi về ilike có dấu như cũ. Gỡ nhánh fallback sau 0187.
const COT_KHONG_DAU = 'full_name_khong_dau';

// BẢNG NGƯỜI DÙNG — MẢNH RIÊNG, CHẢY RIÊNG.
//
// Đây là lý do cả trang được tách ra. Trước đây bấm một cái tab "Học sinh" hay đổi 10 → 50 dòng là
// dựng lại TOÀN BỘ trang: mười một truy vấn, trong đó chín cái (cơ sở, khối, lớp, nhân sự, lời
// mời, lĩnh vực, wifi) chẳng liên quan gì tới bảng người dùng. Đo trên production: một vòng đi-về
// Supabase mất trung vị 251 ms, và trang mất 1,4–2,8 giây mới xong.
//
// Nay mảnh này chỉ chạy HAI truy vấn — dòng của trang hiện tại, và số đếm cho các tab — rồi hiện
// ngay, còn phần còn lại của trang chảy về sau mà không giữ chân nó.
export async function UsersSection({
  q,
  tab,
  page,
  upage,
  meId,
  loc,
}: {
  q: string;
  tab: UserTab;
  page: number;
  upage: number;
  meId: string;
  loc: LocNoiHoc;
}) {
  const t = await getTranslations('admin');
  const supabase = await createClient();
  const fromIdx = (upage - 1) * page;
  const coLoc = !!(loc.cs || loc.khoi || loc.lop);

  // Lọc theo nơi học đi qua enrollments!inner → chỉ ra người CÓ ghi danh khớp. Chọn cột gọn nhất
  // đủ để lọc; PostgREST lồng bảng trong CÙNG một truy vấn nên không thêm vòng đi-về.
  const cotChon = coLoc
    ? 'id, full_name, email, role, campus_id, enrollments!inner(class_id, is_active, classes!inner(campus_id, grade_id))'
    : 'id, full_name, email, role, campus_id';

  // Điều kiện tìm: KHÔNG DẤU. "Hung" phải ra "Hùng" — người quản trị gõ nhanh trên bàn phím không
  // bật Telex, và tên học sinh có dấu là chuyện cả trường. So trên cột đã bỏ dấu (CSDL) với từ khoá
  // đã bỏ dấu (cùng luật boDau ở lib/don-vi.ts). Email thì so thẳng.
  const qKhongDau = q ? boDau(q) : '';
  const dungLoc = (khongDau: boolean) => {
    let x = supabase.from('profiles').select(cotChon, {count: 'exact'}).order('email');
    if (q) {
      x = khongDau
        ? x.or(`email.ilike.%${q}%,${COT_KHONG_DAU}.ilike.%${qKhongDau}%`)
        : x.or(`email.ilike.%${q}%,full_name.ilike.%${q}%`);
    }
    if (tab !== 'all') x = x.eq('role', tab);
    if (loc.lop) x = x.eq('enrollments.class_id', loc.lop);
    if (loc.khoi) x = x.eq('enrollments.classes.grade_id', loc.khoi);
    if (loc.cs) x = x.eq('enrollments.classes.campus_id', loc.cs);
    if (coLoc) x = x.eq('enrollments.is_active', true);
    return x;
  };

  // Hai truy vấn song song: dòng của trang + số đếm cho tab.
  //
  // Số đếm PHẢI khớp đúng phép lọc của bảng, nếu không tab ghi "3" mà bấm vào có 1 — kiểu lỗi
  // người dùng không báo được thành lời, họ chỉ thôi tin cả màn hình. Không tìm/không lọc thì hàm
  // admin_user_counts (0085) đếm bằng một vòng; có tìm hoặc lọc thì đếm từ chính danh sách khớp
  // (chỉ kéo cột role, tối đa 5000 dòng — đủ cho trường 1000 người).
  const hoiTrang = (khongDau: boolean) => dungLoc(khongDau).range(fromIdx, fromIdx + page - 1);
  const hoiDem = (khongDau: boolean) =>
    q || coLoc
      ? dungLoc(khongDau).select(coLoc ? 'role, enrollments!inner(class_id, is_active, classes!inner(campus_id, grade_id))' : 'role').limit(5000)
      : supabase.rpc('admin_user_counts', {});

  let [trangRes, demRes] = await Promise.all([hoiTrang(true), hoiDem(true)]);
  // Fallback trước 0187: cột không dấu chưa tồn tại → thử lại có dấu (chỉ khi có từ khoá).
  if (q && (trangRes.error?.code === '42703' || demRes.error?.code === '42703')) {
    [trangRes, demRes] = await Promise.all([hoiTrang(false), hoiDem(false)]);
  }

  type Dong = {id: string; full_name: string | null; email: string; role: Role; campus_id: string | null};
  const dongTrang = (trangRes.data ?? []) as unknown as Dong[];

  // CỘT "LỚP" (04/09): học sinh → lớp đang ghi danh; GVCN → lớp chủ nhiệm; BGH → cơ sở.
  // Chỉ hỏi ghi danh cho đúng các id trên trang (≤ size dòng) — không tải cả bảng; lớp chủ nhiệm và
  // cơ sở lấy từ layDanhMuc (đã cache theo request).
  const {allCampuses, allGrades, allClasses} = await layDanhMuc();
  const idTrang = dongTrang.map((d) => d.id);
  const {data: ghiDanh} = idTrang.length
    ? await supabase.from('enrollments').select('student_id, classes(id, name)').in('student_id', idTrang).eq('is_active', true)
    : {data: null};
  const lopCuaEm = new Map<string, string[]>();
  const lopIdCuaEm = new Map<string, string>();
  for (const e of (ghiDanh ?? []) as unknown as {student_id: string; classes: {id: string; name: string} | {id: string; name: string}[] | null}[]) {
    const c = Array.isArray(e.classes) ? e.classes[0] : e.classes;
    if (!c) continue;
    lopCuaEm.set(e.student_id, [...(lopCuaEm.get(e.student_id) ?? []), c.name]);
    if (!lopIdCuaEm.has(e.student_id)) lopIdCuaEm.set(e.student_id, c.id);
  }
  const lopChuNhiem = new Map<string, string[]>();
  const lopIdChuNhiem = new Map<string, string>();
  for (const c of allClasses) {
    if (c.is_active && c.homeroom_teacher_id) {
      lopChuNhiem.set(c.homeroom_teacher_id, [...(lopChuNhiem.get(c.homeroom_teacher_id) ?? []), c.name]);
      if (!lopIdChuNhiem.has(c.homeroom_teacher_id)) lopIdChuNhiem.set(c.homeroom_teacher_id, c.id);
    }
  }
  const tenCoSo = new Map(allCampuses.map((c) => [c.id, c.name]));
  const sapLop = (a: string[]) => [...a].sort((x, y) => x.localeCompare(y, 'vi', {numeric: true})).join(', ');
  const rows = dongTrang.map(({id, full_name, email, role, campus_id}) => ({
    id,
    full_name,
    email,
    role,
    campus_id,
    // Lớp hiện tại theo id — để hộp Quyền chọn sẵn (học sinh: lớp ghi danh; giáo viên: lớp chủ nhiệm).
    lopId: role === 'student' ? (lopIdCuaEm.get(id) ?? null) : role === 'teacher' ? (lopIdChuNhiem.get(id) ?? null) : null,
    lop:
      role === 'student' ? (lopCuaEm.has(id) ? sapLop(lopCuaEm.get(id)!) : null)
      : role === 'teacher' ? (lopChuNhiem.has(id) ? sapLop(lopChuNhiem.get(id)!) : null)
      : role === 'principal' ? (campus_id ? (tenCoSo.get(campus_id) ?? null) : null)
      : undefined,
  }));
  const total = trangRes.count ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / page));

  // Đếm theo vai. Hàm chỉ trả về những vai CÓ người; vai rỗng không có dòng nào. Dựng đủ bảy khoá
  // với mặc định 0 để tab "Phụ huynh (0)" vẫn hiện số thay vì `undefined`. Khi tìm/lọc, số đếm của
  // tab đang chọn là chính `total` (đã lọc theo vai), còn các tab khác đếm từ danh sách chưa lọc vai
  // — nên hoiDem KHÔNG lọc theo tab: đếm lại tại đây.
  const byRole = new Map<string, number>();
  if (q || coLoc) {
    for (const r of (demRes.data ?? []) as unknown as {role: string}[]) {
      byRole.set(r.role, (byRole.get(r.role) ?? 0) + 1);
    }
  } else {
    for (const r of (demRes.data ?? []) as unknown as {role: string; n: number}[]) byRole.set(r.role, Number(r.n));
  }
  const counts = Object.fromEntries(
    USER_TABS.map((k) => [
      k,
      k === 'all' ? [...byRole.values()].reduce((a, b) => a + b, 0) : (byRole.get(k) ?? 0),
    ]),
  ) as Record<UserTab, number>;

  // Danh mục cho bộ lọc nơi học (cùng layDanhMuc ở trên).
  const danhMuc = {
    campuses: allCampuses.filter((c) => c.is_active).map((c) => ({id: c.id, name: c.name})),
    grades: allGrades.filter((g) => g.is_active).map((g) => ({id: g.id, name: g.name, campus_id: g.campus_id})),
    classes: allClasses
      .filter((c) => c.is_active)
      .map((c) => ({id: c.id, name: c.name, campus_id: c.campus_id, grade_id: c.grade_id})),
  };

  const thamSo = (them: Record<string, string | number | undefined>) => {
    const ra: Record<string, string | number> = {};
    for (const [k, v] of Object.entries({
      q: q || undefined,
      vai: tab !== 'all' ? tab : undefined,
      cs: loc.cs || undefined,
      khoi: loc.khoi || undefined,
      lop: loc.lop || undefined,
      size: page,
      ...them,
    }))
      if (v !== undefined && v !== '') ra[k] = v;
    return ra;
  };
  const trang = (n: number) => ({pathname: '/admin' as const, query: thamSo({upage: n})});

  return (
    <Disclosure title={t('users')} count={counts.all} defaultOpen>
      <UsersToolbar q={q} tab={tab} size={page} counts={counts} loc={loc} danhMuc={danhMuc} />

      <UsersTable rows={rows} meId={meId} q={q} danhMuc={{campuses: danhMuc.campuses, classes: danhMuc.classes}} />

      {/* Phân trang — giữ nguyên tab, bộ lọc và cỡ trang khi sang trang khác. */}
      {totalPages > 1 && (
        <div className="mt-3 flex items-center justify-center gap-2 text-than font-bold text-navy">
          {upage > 1 ? (
            <Link href={trang(upage - 1)} className={outlineBtnSm}>
              ← {t('prev')}
            </Link>
          ) : (
            <span className={`${outlineBtnSm} pointer-events-none opacity-40`}>← {t('prev')}</span>
          )}
          <span className="text-grey-mid">{t('pageOf', {page: upage, total: totalPages})}</span>
          {upage < totalPages ? (
            <Link href={trang(upage + 1)} className={outlineBtnSm}>
              {t('next')} →
            </Link>
          ) : (
            <span className={`${outlineBtnSm} pointer-events-none opacity-40`}>{t('next')} →</span>
          )}
        </div>
      )}
    </Disclosure>
  );
}

// Khung xương trong lúc chờ.
//
// Không dùng chấm quay giữa màn: nó nói "đang bận" mà không nói cái gì sắp hiện ra, và mỗi lần
// đổi tab lại thấy cả vùng co lại rồi bung ra. Khung xương giữ nguyên chiều cao và hình dạng bảng
// nên mắt không phải tìm lại chỗ cũ.
export function UsersSectionSkeleton({rows = 10}: {rows?: number}) {
  return (
    <section className="glass rounded-[20px] p-[18px]" aria-busy="true">
      <div className="mb-3 h-5 w-40 rounded bg-navy/[0.08]" />
      <div className="mb-2.5 flex flex-wrap gap-1.5">
        {Array.from({length: 7}, (_, i) => (
          <div key={i} className="h-10 w-24 rounded-full bg-navy/[0.06]" />
        ))}
      </div>
      <div className="mb-3 h-10 w-[280px] rounded-[12px] bg-navy/[0.06]" />
      <div className="overflow-hidden rounded-[16px] border-[1.5px] border-navy/10">
        <div className="h-9 bg-navy/[0.04]" />
        {Array.from({length: rows}, (_, i) => (
          <div key={i} className="flex items-center gap-3 border-t border-navy/[0.08] px-[14px] py-3">
            <div className="h-4 w-4 rounded bg-navy/[0.08]" />
            <div className="h-3.5 flex-[1.2] rounded bg-navy/[0.08]" />
            <div className="h-3 flex-[1.4] rounded bg-navy/[0.05]" />
            <div className="h-3 flex-1 rounded bg-navy/[0.05]" />
            <div className="h-8 flex-[1.6] rounded-[12px] bg-navy/[0.05]" />
            <div className="h-8 w-[130px] rounded-[12px] bg-navy/[0.05]" />
          </div>
        ))}
      </div>
    </section>
  );
}

// MỘT LƯỢT ĐI CSDL CHO CẢ TRANG (0189) — thay 14–20 câu PostgREST bằng một RPC trả jsonb.
//
// Vì sao (đo 04/09/2026): thời gian thuần CSDL của từng câu chỉ 0–14 ms khi ấm, nhưng qua
// PostgREST trung bình 450–550 ms/lượt; PostgREST có 11 kết nối, 10 người mở cùng lúc là
// 150–200 câu chen 11 kết nối → 7–9 s. Gộp lại: trang_wig 32 ms, trang_student 10 ms, một lượt.
//
// FALLBACK: khi CSDL chưa có hàm (deploy code trước khi chạy 0189, hoặc dev trên DB thật) trả
// null → trang tự chạy đường nhiều câu cũ. Gỡ nhánh cũ sau khi 0189 áp và ổn một tuần.
import type {SupabaseClient} from '@supabase/supabase-js';

type RpcTho = {
  rpc: (fn: string, args: Record<string, unknown>) => PromiseLike<{data: unknown; error: {message?: string; code?: string} | null}>;
};
const chuaCoHam = (e: {message?: string; code?: string} | null) =>
  !!e && (e.code === 'PGRST202' || e.code === '42883' || /does not exist|Could not find the function/i.test(e.message ?? ''));

/** Kết quả trang_wig — khoá đúng tên biến trang /wig đang dùng. */
export type TrangWig = {
  thiDua: unknown[];
  mtRows: unknown[];
  mtToiRows: unknown[] | null;
  truongRows: unknown[];
  thuocRows: unknown[];
  ckRows: unknown[] | null;
  enrolled: {student_id: string; profiles: {full_name: string | null}}[];
  mtCho: unknown[];
  haCho: unknown[];
  thuocToiRows: unknown[] | null;
  luotRows: unknown[] | null;
  buocRows: unknown[];
  noiRows: unknown[];
  noiToiRows: unknown[];
  noiTruongRows: unknown[];
  lichSu: {muc_tieu_id: string; tuan_ket: string; so: number | null}[];
};

export async function layTrangWig(
  supabase: SupabaseClient,
  a: {classId: string; monday: string; toiId: string | null; campusId: string | null; soTuan?: number},
): Promise<TrangWig | null> {
  const sb = supabase as unknown as RpcTho;
  const {data, error} = await sb.rpc('trang_wig', {
    p_class: a.classId,
    p_tuan: a.monday,
    p_toi: a.toiId,
    p_campus: a.campusId,
    p_so_tuan: a.soTuan ?? 8,
  });
  if (error) {
    if (chuaCoHam(error)) return null;
    throw new Error(error.message ?? 'trang_wig');
  }
  return (data ?? null) as TrangWig | null;
}

/** Kết quả trang_student — khoá đúng tên biến StudentScoreboard đang dùng. */
export type TrangStudent = {
  student: {id: string; full_name: string | null; email: string} | null;
  enr: {class_id: string; classes: {name: string; school_year: string; campus_id: string | null} | null} | null;
  moodRow: unknown[];
  bangRon: unknown[];
  mucTieu: unknown[];
  viec: unknown[];
  camKet: unknown[];
  donVi: unknown[];
  pdrBuddy: unknown | null;
  pdrCoach: unknown | null;
  cap: {id: string; student_id: string; buddy_id: string}[];
  lichCoach: {monthly_day: number | null} | null;
  luot: unknown[];
  noi: unknown[];
  tuanHoc: {loai: string} | null;
  mucTieuLop: unknown[];
  mau: unknown[];
  tenBuddy: unknown[];
  lichBuddy: {weekday: number | null; time_slot: string | null} | null;
  buoc: unknown[];
  tuan12: ({thuoc_id: string} & Record<string, unknown>)[];
};

/** Kết quả trang_campus (0190) — khoá đúng tên biến /campus đang dùng. */
export type TrangCampus = {
  rows: unknown[];
  coSoTatCa: unknown[];
  lopRows: unknown[];
  mtTruong: unknown[];
  tuanHoc: {week_start: string; loai: string}[];
  gr: unknown[];
  cls: unknown[];
  staffRows: unknown[];
  cp: {name: string; levels: unknown} | null;
  inv: {email: string; created_at: string}[];
  namChon: string | null;
};

export async function layTrangCampus(
  supabase: SupabaseClient,
  a: {campusId: string | null; nam: string | null; khoi: string | null},
): Promise<TrangCampus | null> {
  const sb = supabase as unknown as RpcTho;
  const {data, error} = await sb.rpc('trang_campus', {p_campus: a.campusId, p_nam: a.nam, p_khoi: a.khoi});
  if (error) {
    if (chuaCoHam(error)) return null;
    throw new Error(error.message ?? 'trang_campus');
  }
  return (data ?? null) as TrangCampus | null;
}

export async function layTrangStudent(
  supabase: SupabaseClient,
  a: {studentId: string; monday: string; today: string; nhanTuan: string},
): Promise<TrangStudent | null> {
  const sb = supabase as unknown as RpcTho;
  const {data, error} = await sb.rpc('trang_student', {
    p_student: a.studentId,
    p_tuan: a.monday,
    p_hom_nay: a.today,
    p_nhan_tuan: a.nhanTuan,
  });
  if (error) {
    if (chuaCoHam(error)) return null;
    throw new Error(error.message ?? 'trang_student');
  }
  return (data ?? null) as TrangStudent | null;
}

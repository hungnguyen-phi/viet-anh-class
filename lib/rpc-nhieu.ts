// GỌI RPC THEO MẢNG — một lượt đi máy chủ cho N mục tiêu / N thước, thay vì N lượt song song
// (audit 04/09: trên đường mạng rớt 5 % gói, N request là N cơ hội dính retransmit → đuôi trễ).
//
// Hợp đồng với migration 0187 (đang chạy song song):
//   muc_tieu_lich_su_tuan_nhieu(p_ids uuid[])                       → thêm cột muc_tieu_id
//   thuoc_12_tuan_nhieu(p_thuocs uuid[], p_chu_the, p_tuan_cuoi)     → thêm cột thuoc_id
// FALLBACK: khi CSDL chưa có hàm mới (deploy code trước 0187, hoặc chạy dev trên DB thật) thì tự
// rơi về gọi từng cái như cũ. Gỡ nhánh fallback + cast sau khi 0187 áp và regen database.types.
import type {SupabaseClient} from '@supabase/supabase-js';

type RpcTho = {
  rpc: (fn: string, args: Record<string, unknown>) => PromiseLike<{data: unknown; error: {message?: string; code?: string} | null}>;
};
const chuaCoHam = (e: {message?: string; code?: string} | null) =>
  !!e && (e.code === 'PGRST202' || e.code === '42883' || /does not exist|Could not find the function/i.test(e.message ?? ''));

export type LichSuTuanRow = {tuan_ket: string; so: number | null};

/** Lịch sử số cuối tuần của nhiều mục tiêu → Map<muc_tieu_id, dòng[]>. */
export async function lichSuTuanNhieu(
  supabase: SupabaseClient,
  ids: string[],
  soTuan = 8,
): Promise<Map<string, LichSuTuanRow[]>> {
  const ket = new Map<string, LichSuTuanRow[]>();
  if (ids.length === 0) return ket;
  const sb = supabase as unknown as RpcTho;
  const {data, error} = await sb.rpc('muc_tieu_lich_su_tuan_nhieu', {p_ids: ids, p_so_tuan: soTuan});
  if (!error) {
    for (const r of (data ?? []) as (LichSuTuanRow & {muc_tieu_id: string})[]) {
      const arr = ket.get(r.muc_tieu_id) ?? [];
      arr.push({tuan_ket: r.tuan_ket, so: r.so});
      ket.set(r.muc_tieu_id, arr);
    }
    return ket;
  }
  if (!chuaCoHam(error)) return ket;
  // Fallback (gỡ sau khi 0187 áp): từng mục tiêu một, song song.
  await Promise.all(
    ids.map(async (id) => {
      const {data: d} = await sb.rpc('muc_tieu_lich_su_tuan', {p_muc_tieu: id, p_so_tuan: soTuan});
      ket.set(id, ((d ?? []) as LichSuTuanRow[]).map((r) => ({tuan_ket: r.tuan_ket, so: r.so})));
    }),
  );
  return ket;
}

export type Tuan12Row = {tuan: string; gia: number | null; chi_tieu: number | null; dat: boolean | null; trang_thai: string | null; la_tuan_hoc?: boolean | null};

/** 12 tuần gần đây của nhiều thước → Map<thuoc_id, dòng[]> (giữ thứ tự tuần như RPC trả). */
export async function thuoc12TuanNhieu(
  supabase: SupabaseClient,
  thuocIds: string[],
  chuThe: string,
  tuanCuoi: string,
): Promise<Map<string, Tuan12Row[]>> {
  const ket = new Map<string, Tuan12Row[]>();
  if (thuocIds.length === 0) return ket;
  const sb = supabase as unknown as RpcTho;
  const {data, error} = await sb.rpc('thuoc_12_tuan_nhieu', {p_thuocs: thuocIds, p_chu_the: chuThe, p_tuan_cuoi: tuanCuoi});
  if (!error) {
    for (const r of (data ?? []) as (Tuan12Row & {thuoc_id: string})[]) {
      const arr = ket.get(r.thuoc_id) ?? [];
      const {thuoc_id: _bo, ...dong} = r;
      void _bo;
      arr.push(dong);
      ket.set(r.thuoc_id, arr);
    }
    return ket;
  }
  if (!chuaCoHam(error)) return ket;
  await Promise.all(
    thuocIds.map(async (id) => {
      const {data: d} = await sb.rpc('thuoc_12_tuan', {p_thuoc: id, p_chu_the: chuThe, p_tuan_cuoi: tuanCuoi});
      ket.set(id, (d ?? []) as Tuan12Row[]);
    }),
  );
  return ket;
}

// TÌM-HOẶC-TẠO ĐƠN VỊ theo tên người dùng gõ ("Khác…") — dùng chung cho mục tiêu (luuMucTieu)
// và thước đo dẫn dắt. TÁCH KHỎI lib/don-vi.ts vì tệp ấy được form client import, còn tệp này
// đụng createAdminClient (chỉ chạy server). Học sinh/GVCN KHÔNG có RLS chèn don_vi (H-17):
// tạo qua service-role nhưng KIỂM SOÁT — chỉ find-or-create theo slug `ma` (dedupe), gắn
// created_by để biết ai thêm.
import type {SupabaseClient} from '@supabase/supabase-js';
import {createAdminClient} from '@/lib/supabase/admin';

export function slugDonVi(ten: string): string {
  return (
    ten
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .slice(0, 40) || 'don_vi'
  );
}

/** Trả về id đơn vị (tìm theo slug, chưa có thì tạo), hoặc null kèm lỗi. */
export async function timHoacTaoDonVi(
  supabase: SupabaseClient,
  meId: string,
  tenDv: string,
): Promise<{id: string | null; error?: string}> {
  const maDv = slugDonVi(tenDv);
  const {data: coSan} = await supabase.from('don_vi').select('id').ilike('ma', maDv).maybeSingle();
  if (coSan?.id) return {id: coSan.id};
  const dvAdmin = createAdminClient();
  const {data: moi, error: eDv} = await dvAdmin
    .from('don_vi')
    .insert({ma: maDv, nhan_vi: tenDv, nhan_en: tenDv, created_by: meId})
    .select('id')
    .maybeSingle();
  if (moi?.id) return {id: moi.id};
  // Đua chèn (hai người cùng tạo một đơn vị): tìm lại lần nữa trước khi bỏ cuộc.
  const {data: lai} = await supabase.from('don_vi').select('id').ilike('ma', maDv).maybeSingle();
  if (lai?.id) return {id: lai.id};
  return {id: null, error: eDv?.message ?? 'Không tạo được đơn vị mới.'};
}

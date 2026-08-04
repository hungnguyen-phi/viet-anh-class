'use server';

import {revalidatePath} from 'next/cache';
import {redirect} from 'next/navigation';
import {createClient} from '@/lib/supabase/server';
import {requireRole} from '@/lib/auth';
import {friendlyError, loi, tachLoi} from '@/lib/errors';
import {isMealSlot} from '@/components/menu/MealMeta';

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

// Quay lại ĐÚNG cơ sở + ĐÚNG tuần vừa xem. Mất ?campus= là quản trị viên đang soạn cho cơ sở B
// bị ném về cơ sở A ngay sau khi bấm Lưu, rồi tưởng vừa lưu nhầm chỗ.
function menuFlash(campusId: string, week: string, msg: string): never {
  const q = new URLSearchParams();
  if (campusId) q.set('campus', campusId);
  if (week) q.set('week', week);
  const g = tachLoi(msg);
  q.set(g.laLoi ? 'flash_err' : 'flash', g.msg);
  redirect(`/menu?${q.toString()}`);
}

// Mọi thao tác đều đổi nội dung thẻ "thực đơn hôm nay" đang nhúng ở trang phụ huynh / học sinh,
// nên phải làm mới cả ba route chứ không riêng /menu.
function lamMoiCacTrang() {
  revalidatePath('/[locale]/menu', 'page');
  revalidatePath('/[locale]/report', 'page');
  revalidatePath('/[locale]/student', 'page');
}

// Nhập hoặc sửa thực đơn của MỘT bữa trong MỘT ngày.
//
// Vai được ghi lấy đúng theo policy rls_all_meal_menus (0062): admin mọi cơ sở, hiệu trưởng cơ sở
// của mình. GIÁO VIÊN KHÔNG có trong danh sách — cố ý: thực đơn do bếp/văn phòng quyết, để 30
// GVCN cùng sửa một dòng thì không ai chịu trách nhiệm khi sai.
export async function saveMenu(formData: FormData) {
  const me = await requireRole(['admin', 'principal']);
  const campusId = String(formData.get('campus_id') ?? '');
  const week = String(formData.get('week') ?? '');
  const date = String(formData.get('date') ?? '');
  const meal = String(formData.get('meal') ?? '');
  const items = String(formData.get('items') ?? '').trim();
  const note = String(formData.get('note') ?? '').trim();

  if (!campusId || !ISO_DATE.test(date) || !isMealSlot(meal))
    menuFlash(campusId, week, 'Thiếu thông tin: cần có cơ sở, ngày và bữa ăn.');
  // DB có `check (btrim(items) <> '')`. Chặn ở đây để người nhập đọc được câu tiếng Việt cụ thể,
  // thay vì câu chung chung "Giá trị nhập không hợp lệ" mà friendlyError trả cho mã 23514.
  if (!items) menuFlash(campusId, week, 'Hãy nhập ít nhất một món (mỗi món một dòng).');

  const supabase = await createClient();
  const {data, error} = await supabase
    .from('meal_menus')
    .upsert(
      {
        campus_id: campusId,
        date,
        meal,
        items,
        note: note || null,
        updated_by: me.id,
      },
      // Khoá chính là (campus_id, date, meal) → soạn lại cùng một bữa là ĐÈ, không tạo dòng thứ hai.
      {onConflict: 'campus_id,date,meal'},
    )
    .select('date');

  lamMoiCacTrang();
  if (error) menuFlash(campusId, week, loi(friendlyError(error)));
  // .select() để phân biệt "RLS chặn" với "đã lưu xong" — không báo thành công giả.
  if (!data || data.length === 0)
    menuFlash(campusId, week, 'Không lưu được — bạn không có quyền nhập thực đơn cho cơ sở này.');
  menuFlash(campusId, week, 'Đã lưu thực đơn');
}

// Xoá thực đơn của một bữa (dùng khi nhập nhầm ngày/bữa). Không có "xoá mềm": thực đơn quá hạn
// không có giá trị lưu vết, mà để lại thì phụ huynh mở tuần cũ vẫn thấy món đã bị huỷ.
export async function deleteMenu(formData: FormData) {
  await requireRole(['admin', 'principal']);
  const campusId = String(formData.get('campus_id') ?? '');
  const week = String(formData.get('week') ?? '');
  const date = String(formData.get('date') ?? '');
  const meal = String(formData.get('meal') ?? '');

  if (!campusId || !ISO_DATE.test(date) || !isMealSlot(meal))
    menuFlash(campusId, week, 'Thiếu thông tin: cần có cơ sở, ngày và bữa ăn.');

  const supabase = await createClient();
  const {data, error} = await supabase
    .from('meal_menus')
    .delete()
    .eq('campus_id', campusId)
    .eq('date', date)
    .eq('meal', meal)
    .select('date');

  lamMoiCacTrang();
  if (error) menuFlash(campusId, week, loi(friendlyError(error)));
  menuFlash(
    campusId,
    week,
    (data ?? []).length > 0
      ? 'Đã xoá thực đơn của bữa này'
      : 'Không xoá được — thực đơn không còn, hoặc bạn không có quyền với cơ sở này.',
  );
}

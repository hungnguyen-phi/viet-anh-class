'use server';

import {revalidatePath} from 'next/cache';
import {redirect} from 'next/navigation';
import {createClient} from '@/lib/supabase/server';
import {requireProfile} from '@/lib/auth';

// SỐ TRÊN CHUÔNG NẰM Ở LAYOUT, KHÔNG NẰM Ở TRANG NÀY.
//
// `app/[locale]/(dashboard)/layout.tsx` đếm `notifications where read = false` rồi truyền xuống
// AppNav. Nên đánh dấu đã đọc mà chỉ revalidate 'page' thì danh sách sạch còn con số trên chuông
// vẫn đứng nguyên — đúng cái người dùng nhìn vào và bảo "bấm rồi mà số vẫn còn". Phải revalidate
// LAYOUT. Gom vào một hàm để hai đường (mở trang, bấm một thông báo) không có cơ hội làm khác nhau.
async function xoaSoTrenChuong() {
  revalidatePath('/[locale]', 'layout');
}

// Đánh dấu tất cả thông báo của mình là đã đọc.
//
// requireProfile() thay cho supabase.auth.getUser(): getUser() là một vòng mạng tới Supabase
// Auth, còn requireProfile() đọc JWT cục bộ rồi lấy hồ sơ (và đã được cache theo request).
export async function markAllRead() {
  const me = await requireProfile();
  const supabase = await createClient();
  await supabase.from('notifications').update({read: true}).eq('user_id', me.id).eq('read', false);
  revalidatePath('/[locale]/notifications', 'page');
  await xoaSoTrenChuong();
  redirect('/notifications');
}

// MỞ TRANG THÔNG BÁO LÀ TẮT SỐ TRÊN CHUÔNG (yêu cầu chủ dự án 12/08/2026).
//
// Trước đây số chỉ tắt khi bấm đúng nút "Đánh dấu đã đọc hết". Người dùng vào xem hết thông báo
// rồi đi ra, con số vàng trên chuông vẫn còn — nó thôi mang nghĩa "có cái mới", thành ra một vết
// bẩn dính vĩnh viễn, và khi có thông báo mới thật thì không ai để ý nữa.
//
// Gọi từ client sau khi trang đã dựng, KHÔNG gọi trong lúc render: layout và page dựng song song,
// nên ghi CSDL giữa chừng thì layout đã đếm xong từ trước, số vẫn hiện cho tới lần chuyển trang
// sau. Từ client thì gọi xong `router.refresh()` là cả layout lẫn page cùng dựng lại.
//
// Danh sách vẫn tô đậm những cái VỪA chưa đọc: trang đọc dữ liệu trước, hàm này chạy sau, nên em
// vẫn thấy được cái nào là mới trong chính lần mở này.
export async function danhDauDaXem() {
  const me = await requireProfile();
  const supabase = await createClient();
  const {error} = await supabase
    .from('notifications')
    .update({read: true})
    .eq('user_id', me.id)
    .eq('read', false);
  // Không ném lỗi ra màn: đây là việc dọn dẹp chạy ngầm, hỏng thì cùng lắm số trên chuông còn đó
  // — không đáng để phá trang thông báo mà người dùng đang đọc.
  if (error) return {ok: false};
  await xoaSoTrenChuong();
  return {ok: true};
}

// BẤM VÀO MỘT THÔNG BÁO: đánh dấu đúng cái đó rồi mới đi tới nơi nó trỏ.
//
// Vẫn cần dù đã có danhDauDaXem ở trên: thông báo còn tới từ chỗ khác ngoài trang này (đường dẫn
// trong mail, và sau này là danh sách rút gọn ngay trên chuông). Lọc thêm user_id cho chắc — RLS
// đã chặn rồi, nhưng một câu update không có ràng buộc chủ sở hữu là thứ không nên tồn tại trong
// mã nguồn của app cho trẻ em.
export async function docMotThongBao(formData: FormData) {
  const me = await requireProfile();
  const id = String(formData.get('id') ?? '');
  const link = String(formData.get('link') ?? '') || '/notifications';
  if (id) {
    const supabase = await createClient();
    await supabase.from('notifications').update({read: true}).eq('id', id).eq('user_id', me.id);
    revalidatePath('/[locale]/notifications', 'page');
    await xoaSoTrenChuong();
  }
  // Chỉ đi tới đường dẫn NỘI BỘ. `link` là cột trong CSDL do trigger ghi, nhưng chuyển hướng theo
  // một chuỗi lấy từ bảng mà không kiểm thì chỉ cần một dòng thông báo có link ra ngoài là app tự
  // đẩy trẻ em sang trang lạ.
  redirect(link.startsWith('/') && !link.startsWith('//') ? link : '/notifications');
}

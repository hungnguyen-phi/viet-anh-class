import {createClient} from '@/lib/supabase/server';
import {ParentForm} from './ParentForm';

// Danh sách học sinh, NẠP RIÊNG VÀ NẠP SAU.
//
// Đây là truy vấn nặng nhất của màn Quản trị — tới một nghìn dòng — mà nó chỉ phục vụ đúng một ô
// chọn nằm trong hộp thoại "Mời phụ huynh", tức thứ phần lớn lượt mở trang không đụng tới. Để nó
// trong Promise.all của trang thì mọi cú bấm tab, mọi lần sang trang đều phải chờ nó xong mới
// được thấy dòng đầu tiên.
//
// Tách ra thành component server riêng rồi bọc <Suspense>: Next gửi khung trang đi ngay và truyền
// tiếp phần này khi nó về. Người quản trị thấy bảng người dùng trước, còn ô chọn học sinh thì
// hoàn thiện sau — mà lúc ấy họ vẫn chưa mở hộp thoại nào.
export async function ParentFormLoader() {
  const supabase = await createClient();
  const {data} = await supabase
    .from('profiles')
    .select('id, full_name, email')
    .eq('role', 'student')
    .order('email')
    .limit(1000);
  return <ParentForm students={data ?? []} />;
}

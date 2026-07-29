import {cache} from 'react';
import {createClient} from '@/lib/supabase/server';
import {buildAreaMeta, type Area, type AreaMeta} from '@/lib/areas';

// Cấu hình 4 lĩnh vực 4DX — LẤY MỘT LẦN CHO MỖI REQUEST.
//
// Vì sao cần: bảng area_config chỉ có 4 dòng và gần như không đổi, nhưng lại được nhiều thành
// phần cần tới cùng lúc. Trang WIG là ví dụ rõ nhất: bản thân trang truy vấn một lần, rồi
// ClassStudentWigSetup truy vấn lại đúng dữ liệu đó — hai vòng mạng cho cùng 4 dòng. Log API của
// Supabase cho thấy đúng hiện tượng lặp này.
//
// cache() của React gom mọi lời gọi TRONG CÙNG một request về một lần thật sự chạy. Phải tự dựng
// client bên trong (không nhận supabase làm tham số): cache() so khớp theo tham số, mà mỗi lời
// gọi createClient() lại ra một đối tượng khác nhau nên truyền vào là hỏng cơ chế gom.
export const getAreaMeta = cache(async (): Promise<Record<Area, AreaMeta>> => {
  const supabase = await createClient();
  const {data} = await supabase.from('area_config').select('*').order('sort_order');
  return buildAreaMeta(data);
});

import {cache} from 'react';
import {createClient} from '@/lib/supabase/server';
import {buildAreaMeta, type Area, type AreaMeta} from '@/lib/areas';

// Cấu hình 4 lĩnh vực 4DX — LẤY MỘT LẦN CHO MỖI REQUEST, VÀ GIỮ LẠI GIỮA CÁC REQUEST.
//
// Vì sao cần cache() theo request: bảng area_config chỉ có 4 dòng và gần như không đổi, nhưng lại
// được nhiều thành phần cần tới cùng lúc. Trang WIG là ví dụ rõ nhất: bản thân trang truy vấn một
// lần, rồi ClassStudentWigSetup truy vấn lại đúng dữ liệu đó — hai vòng mạng cho cùng 4 dòng. Log
// API của Supabase cho thấy đúng hiện tượng lặp này.
//
// cache() của React gom mọi lời gọi TRONG CÙNG một request về một lần thật sự chạy. Phải tự dựng
// client bên trong (không nhận supabase làm tham số): cache() so khớp theo tham số, mà mỗi lời
// gọi createClient() lại ra một đối tượng khác nhau nên truyền vào là hỏng cơ chế gom.
//
// ════════════════════════════════════════════════════════════════════════════
// VÀ GIỮ GIỮA CÁC REQUEST (audit tốc độ 10/08/2026)
// ════════════════════════════════════════════════════════════════════════════
//
// cache() chỉ sống trong một request; sang trang khác là hỏi lại từ đầu. Đo được: 5 trang hỏi
// bảng này, 59–83ms mỗi lượt, và ở /report nó nằm ĐÚNG TRÊN chuỗi chờ. Trên đường có 1,77% gói
// phải gửi lại thì mỗi câu bỏ đi vừa tiết kiệm ~80ms vừa bớt một lần rút thăm với cái đuôi 1 giây.
//
// VÌ SAO CACHE ĐƯỢC MÀ KHÔNG SỢ LẪN DỮ LIỆU: đây là cấu hình TOÀN TRƯỜNG (tên/màu/icon 4 lĩnh
// vực), giống hệt nhau với mọi người dùng, mọi vai. Không có gì của riêng ai trong đó. Đây đúng
// là ranh giới an toàn: chỉ cache thứ KHÔNG phụ thuộc người đang đăng nhập. Hồ sơ, danh sách lớp,
// điểm, tick — tuyệt đối không.
//
// Bảng này đổi khi quản trị viên sửa cấu hình lĩnh vực; 5 phút sau là mọi máy chủ thấy bản mới.
// Đổi tên một lĩnh vực mà 5 phút sau mới hiện đủ là cái giá chấp nhận được cho 80ms mỗi trang.
const HAN_MS = 5 * 60_000;
let daLuu: {luc: number; meta: Record<Area, AreaMeta>} | null = null;
// Giữ luôn lời hứa đang bay: hai request cùng lúc lúc cache nguội thì chỉ một câu đi ra ngoài.
let dangLay: Promise<Record<Area, AreaMeta>> | null = null;

export const getAreaMeta = cache(async (): Promise<Record<Area, AreaMeta>> => {
  if (daLuu && Date.now() - daLuu.luc < HAN_MS) return daLuu.meta;
  if (!dangLay) {
    dangLay = (async () => {
      const supabase = await createClient();
      const {data, error} = await supabase.from('area_config').select('*').order('sort_order');
      // Lỗi mạng thì KHÔNG ghi vào bộ nhớ: ghi lại là đóng băng bản dự phòng suốt 5 phút cho mọi
      // người. Trả bản dự phòng cho riêng lượt này rồi lần sau thử lại.
      if (error) return buildAreaMeta(null);
      daLuu = {luc: Date.now(), meta: buildAreaMeta(data)};
      return daLuu.meta;
    })().finally(() => {
      dangLay = null;
    });
  }
  return dangLay;
});

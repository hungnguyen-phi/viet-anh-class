// GIỮ KẾT NỐI ẤM TỚI SUPABASE.
//
// ════════════════════════════════════════════════════════════════════════════
// VÌ SAO CÓ FILE NÀY (audit tốc độ 10/08/2026)
// ════════════════════════════════════════════════════════════════════════════
//
// Giáo viên báo app chậm. Đo ra thì máy chủ và Supabase CÙNG ở Singapore, bắt tay TCP giữa hai
// bên chỉ 11ms, câu SQL nặng nhất chạy 9ms — vậy mà một vòng gọi REST tốn tới 225ms. Toàn bộ
// phần chênh nằm ở chỗ MỞ LẠI KẾT NỐI.
//
// Nguyên do: undici (bộ fetch có sẵn của Node) đóng kết nối rảnh sau 4 GIÂY. Một trường học
// không có lượt truy cập mỗi bốn giây, nên gần như lượt nào cũng phải bắt tay TCP + TLS lại từ
// đầu. Trên đường truyền của máy chủ này có 1,77% gói phải gửi lại, mà bắt tay chính là lúc mất
// gói đau nhất: đo được những cú bắt tay TLS từ 26ms tới 379ms.
//
// Đo bằng scripts/do-giu-ket-noi.mjs (giãn cách 5 giây, đúng nhịp người dùng bấm tab):
//
//     mặc định (đóng sau 4s)   153ms mỗi vòng gọi   ·   loạt 8 truy vấn song song: 274ms
//     giữ kết nối 60 giây       72ms mỗi vòng gọi   ·   loạt 8 truy vấn song song: 186ms
//
// Nhanh hơn 53% mỗi vòng, và quan trọng hơn: HẾT DAO ĐỘNG. Ở chế độ mặc định các mẫu nhảy từ
// 180ms tới 1142ms — chính cái đuôi ấy là thứ khiến người dùng nói "chậm quá", chứ không phải
// con số trung vị.
//
// ════════════════════════════════════════════════════════════════════════════
// VÌ SAO KHÔNG BẬT HTTP/2 (đã đo, đã cân nhắc, đã bỏ)
// ════════════════════════════════════════════════════════════════════════════
//
// HTTP/2 đo được nhanh hơn một chút (68ms mỗi vòng, loạt 8 còn 166ms) vì tám truy vấn song song
// đi chung MỘT kết nối thay vì mở tám. Nhưng đi chung một kết nối trên đường có 1,77% mất gói là
// đánh đổi tồi: một gói rơi làm nghẽn TOÀN BỘ tám truy vấn đang ghép trên đó (head-of-line
// blocking ở tầng TCP), trong khi HTTP/1.1 tám kết nối riêng thì mất gói chỉ hại một truy vấn.
// Được 20ms lúc đường sạch, đổi lấy nguy cơ khựng cả trang lúc đường bẩn — mà đường ở đây đang
// bẩn. Khi nào chữa xong mất gói thì bật lại và đo lại.
//
// ════════════════════════════════════════════════════════════════════════════
// VÌ SAO KHÔNG DÙNG instrumentation.ts (cách chính thống của Next)
// ════════════════════════════════════════════════════════════════════════════
//
// Vì /instrumentation.ts NẰM TRONG .gitignore CÓ CHỦ Ý (xem .gitignore dòng 51-54): bộ đo
// scripts/measure-query-waterfall.mjs chép đè một bản bọc global.fetch vào đúng đường dẫn ấy rồi
// xoá đi khi đo xong, và dự án đã từng có lần một bản bọc fetch như thế lọt lên production làm
// hỏng đăng nhập. Đặt cấu hình thật vào đó là hai chuyện tồi cùng lúc: bản sửa này sẽ KHÔNG bao
// giờ lên được production (git bỏ qua nó), và ai chạy bộ đo một lần là xoá mất nó.
//
// Nên gắn vào lib/supabase/server.ts — nơi mọi truy vấn Supabase phía máy chủ đều đi qua. Đặt
// một lần cho cả tiến trình, những lần sau chỉ là một phép so boolean.
let daDat = false;

export async function giuKetNoiSupabase(): Promise<void> {
  if (daDat) return;
  daDat = true; // đặt TRƯỚC khi await: hai request đến cùng lúc thì chỉ một cái đi tiếp

  // Edge runtime không có undici và cũng không giữ kết nối theo kiểu này.
  if (process.env.NEXT_RUNTIME && process.env.NEXT_RUNTIME !== 'nodejs') return;

  try {
    const {Agent, setGlobalDispatcher} = await import('undici');
    setGlobalDispatcher(
      new Agent({
        // 60 giây: đủ dài để một giáo viên bấm qua ba bốn tab mà vẫn đi lại đường cũ, và vẫn
        // ngắn hơn hạn giữ kết nối của Cloudflare đứng trước Supabase — để phía mình luôn là bên
        // chủ động đóng, không gặp cảnh gửi vào một kết nối server vừa đóng.
        keepAliveTimeout: 60_000,
        // Trần tuyệt đối cho một kết nối, kể cả khi được dùng liên tục: 10 phút thì mở lại một
        // lần cho lành, tránh giữ mãi một đường đã xấu đi.
        keepAliveMaxTimeout: 600_000,
        // Mỗi trang bắn 7–17 truy vấn song song. Để rộng tay hơn số đó nhiều lần thì lúc đông
        // người không ai phải xếp hàng chờ kết nối.
        connections: 64,
        connect: {timeout: 10_000},
      }),
    );
  } catch {
    // Không nạp được undici (bản gói thiếu, môi trường lạ) thì app vẫn chạy y như trước — chỉ là
    // không có phần giữ kết nối. Một tối ưu tốc độ không bao giờ được quyền làm sập trang.
  }
}

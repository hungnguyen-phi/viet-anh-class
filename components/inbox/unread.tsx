import {createClient} from '@/lib/supabase/server';

// ============================================================
// SỐ TIN CHƯA ĐỌC Ở HỘP THƯ LIÊN LẠC — dùng cho chấm đỏ trên thanh menu.
//
// Đây là hàm dành cho NGƯỜI ĐIỀU PHỐI gắn vào layout dashboard rồi truyền xuống AppNav dưới
// dạng một con số (đúng khuôn `unreadCount` của chuông thông báo đang có).
//
// CHỈ CHẠY PHÍA MÁY CHỦ: nó tạo Supabase client từ cookie (next/headers). Đừng import file này
// vào một component 'use client' — AppNav là client, sẽ vỡ build. Gọi ở layout (server), rồi
// truyền số xuống.
// ============================================================

type SB = Awaited<ReturnType<typeof createClient>>;

/**
 * Tổng số tin CHƯA ĐỌC của người đang đăng nhập, gộp mọi cuộc trao đổi của họ.
 *
 * Dùng thẳng RPC pt_my_threads() (0065) thay vì tự đếm: hàm đó là SECURITY INVOKER nên RLS vẫn
 * quyết định ai thấy gì — phụ huynh ra các cuộc về con mình, GVCN ra các cuộc của lớp mình, học
 * sinh/quản trị viên/hiệu trưởng ra 0 dòng. Một lượt truy vấn, không có N+1.
 *
 * `client` truyền vào được để layout tái dùng client nó đã tạo (đỡ một lần đọc cookie).
 *
 * Lỗi thì trả 0, không ném: sự cố mạng ở cái chấm đỏ không được phép làm sập thanh menu —
 * cùng cách xử lý mà layout đang dùng cho số thông báo chưa đọc.
 *
 * LƯU Ý HIỆU NĂNG: layout nằm trên MỌI trang sau đăng nhập, nên chỉ gọi hàm này khi
 * profile.role là 'parent' hoặc 'teacher'. Các vai khác chắc chắn nhận 0 — gọi cũng chỉ tốn
 * một vòng mạng vô ích.
 */
export async function getInboxUnreadCount(client?: SB): Promise<number> {
  try {
    const supabase = client ?? (await createClient());
    // Dùng pt_unread_total() (migration 0072), KHÔNG dùng pt_my_threads().
    //
    // Đo được: pt_my_threads là truy vấn LÂU NHẤT trên 15/27 lượt đo trang (158–470 ms), và nó
    // chạy trên MỌI trang của giáo viên chủ nhiệm lẫn phụ huynh vì layout gọi hàm này. Nó trả về
    // nguyên bảng cuộc trao đổi kèm join classes + join profiles + một subquery đếm cho từng
    // cuộc — tất cả để lấy đúng một con số cho chấm đỏ. pt_unread_total làm một count(*) gộp,
    // không join gì.
    const {data, error} = await supabase.rpc('pt_unread_total');
    if (error) return 0;
    return Number(data ?? 0);
  } catch {
    return 0;
  }
}

/**
 * Số CUỘC đang có tin chưa đọc (khác với tổng số tin ở trên).
 *
 * Có hai con số vì hai chỗ hiển thị khác nhau: chấm đỏ trên menu nên đếm TIN ("7"), còn câu
 * tóm tắt kiểu "3 cuộc trao đổi đang chờ bạn" thì đếm CUỘC. Tách sẵn để người điều phối khỏi
 * phải gọi RPC lần nữa chỉ để đổi cách đếm.
 */
export async function getInboxUnreadThreadCount(client?: SB): Promise<number> {
  try {
    const supabase = client ?? (await createClient());
    const {data, error} = await supabase.rpc('pt_my_threads');
    if (error || !data) return 0;
    return (data as {unread_count: number | null}[]).filter((r) => Number(r.unread_count ?? 0) > 0)
      .length;
  } catch {
    return 0;
  }
}

// Thứ tự trong mảng CHÍNH LÀ thứ tự hiển thị các hàng của lưới: sáng → trưa → xế → tối, đúng thứ
// tự trong ngày. Đừng sắp theo bảng chữ cái.
export const MEAL_SLOTS = ['breakfast', 'lunch', 'snack', 'dinner'] as const;

export type MealSlot = (typeof MEAL_SLOTS)[number];

// NHÃN NẰM Ở FILE DỊCH, không ở đây.
//
// Trước đây file này giữ luôn MEAL_LABEL với bốn chuỗi tiếng Việt cứng ("Bữa sáng"…), nên bật
// bản tiếng Anh vẫn ra tiếng Việt. Nay chỉ giữ phần KHÔNG phụ thuộc ngôn ngữ — danh sách khoá và
// thứ tự — còn chữ tra ở namespace `menu` (`menu.meals.*`, `menu.days.*`).
// Vẫn dùng chung một chỗ nên không tái diễn chuyện mỗi nơi gọi một kiểu ("xế" / "bữa phụ").

// Giá trị đến từ URL (?meal=) hoặc FormData thì luôn là chuỗi tự do — phải lọc trước khi ném
// xuống Postgres, nếu không enum sai kiểu sẽ nổ thành lỗi 22P02 mà friendlyError chưa ánh xạ.
export function isMealSlot(v: string): v is MealSlot {
  return (MEAL_SLOTS as readonly string[]).includes(v);
}

// Khoá nhãn cột của lưới tuần (chữ tra ở `menu.days.*`). Có CẢ Chủ Nhật (khác /timetable chỉ có
// T2–T7): trường có học sinh nội trú, cuối tuần vẫn ăn ở trường, mà 0062 mở sẵn cả bữa tối cho
// đúng nhóm này.
export const DAY_KEYS = ['d1', 'd2', 'd3', 'd4', 'd5', 'd6', 'd7'] as const;

// Postgres trả yyyy-mm-dd; người Việt đọc ngày/tháng/năm.
export function ngayVN(iso: string): string {
  const [y, m, d] = iso.split('-');
  return d && m && y ? `${d}/${m}/${y}` : iso;
}

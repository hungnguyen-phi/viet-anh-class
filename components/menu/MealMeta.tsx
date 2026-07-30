// Nhãn tiếng Việt cho enum meal_slot (migration 0062) — để trang /menu và thẻ "thực đơn hôm nay"
// không mỗi nơi gọi một kiểu ("xế" / "bữa phụ" / "snack").
//
// Thứ tự trong mảng CHÍNH LÀ thứ tự hiển thị các hàng của lưới: sáng → trưa → xế → tối, đúng thứ
// tự trong ngày. Đừng sắp theo bảng chữ cái.
export const MEAL_SLOTS = ['breakfast', 'lunch', 'snack', 'dinner'] as const;

export type MealSlot = (typeof MEAL_SLOTS)[number];

export const MEAL_LABEL: Record<MealSlot, string> = {
  breakfast: 'Bữa sáng',
  lunch: 'Bữa trưa',
  snack: 'Bữa xế',
  dinner: 'Bữa tối',
};

// Giá trị đến từ URL (?meal=) hoặc FormData thì luôn là chuỗi tự do — phải lọc trước khi ném
// xuống Postgres, nếu không enum sai kiểu sẽ nổ thành lỗi 22P02 mà friendlyError chưa ánh xạ.
export function isMealSlot(v: string): v is MealSlot {
  return (MEAL_SLOTS as readonly string[]).includes(v);
}

// Nhãn cột của lưới tuần. Có CẢ Chủ Nhật (khác /timetable chỉ có T2–T7): trường có học sinh nội
// trú, cuối tuần vẫn ăn ở trường, mà 0062 mở sẵn cả bữa tối cho đúng nhóm này.
export const DAY_LABELS = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'] as const;

// Postgres trả yyyy-mm-dd; người Việt đọc ngày/tháng/năm.
export function ngayVN(iso: string): string {
  const [y, m, d] = iso.split('-');
  return d && m && y ? `${d}/${m}/${y}` : iso;
}

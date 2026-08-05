// Hằng số dùng chung giữa trang /admin (server) và thanh công cụ bảng người dùng (client).
//
// VÌ SAO PHẢI LÀ FILE RIÊNG, KHÔNG ĐỂ TRONG UsersToolbar.tsx:
// UsersToolbar.tsx mở đầu bằng 'use client'. Khi một server component nhập thứ gì đó từ module
// client, Next thay module ấy bằng một PROXY THAM CHIẾU CLIENT — đúng với component (nó chỉ cần
// biết đường mà gọi ở trình duyệt), nhưng sai với dữ liệu thuần: `USER_TABS.map(...)` ở phía
// server sẽ gọi .map trên proxy chứ không phải trên mảng, và cả trang văng ra màn hình lỗi.
//
// Tệ ở chỗ nó KHÔNG lộ ra lúc `tsc` hay `next build`: kiểu vẫn đúng, còn /admin là trang render
// theo yêu cầu nên không được dựng thử lúc build. Nó chỉ nổ khi có người thật mở trang.
// File này không có directive nào nên cả hai phía đều nhập được giá trị thật.

export const USER_TABS = ['all', 'teacher', 'principal', 'admin', 'student', 'parent', 'pending'] as const;
export type UserTab = (typeof USER_TABS)[number];

export const PAGE_SIZES = [10, 25, 50, 100] as const;

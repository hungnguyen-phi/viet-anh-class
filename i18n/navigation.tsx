import {createNavigation} from 'next-intl/navigation';
import type {ComponentProps} from 'react';
import {routing} from './routing';

// Wrapper Link/redirect/usePathname/useRouter hiểu locale (dùng thay cho next/navigation).
const nav = createNavigation(routing);

export const {redirect, usePathname, useRouter, getPathname} = nav;

const IntlLink = nav.Link;
type IntlLinkProps = ComponentProps<typeof IntlLink>;

// PREFETCH MẶC ĐỊNH TẮT cho toàn app — sửa một chỗ thay vì rải `prefetch={false}` khắp nơi.
//
// Mặc định của Next là prefetch MỌI <Link> vừa lọt vào khung nhìn. Trong app này điều đó rất
// đắt: các trang danh sách render một link cho MỖI dòng (mỗi lớp ở "Báo cáo cơ sở", mỗi học
// sinh ở "Danh sách", mỗi tiết ở "Thời khoá biểu"), nên chỉ mở một trang là bắn hàng chục lượt
// prefetch, mỗi lượt bắt server render lại layout dashboard kèm truy vấn Supabase. Chúng tranh
// kết nối DB và băng thông với đúng cái trang người dùng đang ngồi chờ — càng nhiều lớp/học
// sinh thì càng chậm, đúng như phản ánh "trang Cơ sở load rất chậm".
//
// Bỏ prefetch KHÔNG mất gì ở đây: mọi trang sau đăng nhập đều `force-dynamic`, mà Next mặc định
// staleTimes.dynamic = 0 → những gì prefetch về không được dùng lại cho cú bấm thật, vẫn phải
// tải lại từ đầu. Tức là gần như toàn bộ công server bỏ ra cho prefetch là đổ đi.
//
// Chỗ nào thật sự cần prefetch (link tĩnh, hay đích chắc chắn sẽ bấm) thì truyền `prefetch`
// tường minh — prop vẫn hoạt động bình thường, đây chỉ là đổi giá trị MẶC ĐỊNH.
export function Link({prefetch = false, ...props}: IntlLinkProps) {
  return <IntlLink prefetch={prefetch} {...props} />;
}

import Link from 'next/link';

// 404 tiếng Việt. Nằm ở app/ (ngoài [locale]) nên KHÔNG dùng next-intl được — chữ để cứng.
//
// GIỚI HẠN CẦN BIẾT: trang này chỉ hiện với người ĐÃ đăng nhập. Khách chưa đăng nhập vào URL sai
// sẽ bị middleware (lib/supabase/middleware.ts:55) redirect về /login trước khi tới được đây.
// Cố ý không sửa: muốn khách lạ thấy 404 thì middleware phải biết danh sách route hợp lệ, mà giữ
// một danh sách như vậy sẽ âm thầm 404 trang thật mỗi lần thêm route mới. Đổi lại, không tiết lộ
// route nào tồn tại cho người chưa đăng nhập cũng là hành vi an toàn hơn.
export default function NotFound() {
  return (
    <main className="grid min-h-screen place-items-center px-6 py-16">
      <div className="w-full max-w-[440px] text-center">
        <div className="font-display text-[64px] font-bold leading-none text-navy/15">404</div>
        <h1 className="mt-3 font-display text-[22px] font-bold text-navy">Không tìm thấy trang</h1>
        <p className="mt-2 text-[14px] font-semibold leading-[1.6] text-grey-mid">
          Đường dẫn này không tồn tại hoặc đã được đổi. Kiểm tra lại địa chỉ, hoặc quay về trang chính.
        </p>
        <Link
          href="/vi"
          className="btn-gold mt-6 inline-flex h-11 items-center rounded-xl px-6 font-display text-[14px] font-bold"
        >
          Về trang chính
        </Link>
      </div>
    </main>
  );
}

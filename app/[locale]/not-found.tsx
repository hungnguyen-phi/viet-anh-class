import {Link} from '@/i18n/navigation';

// 404 cho URL sai BÊN TRONG một locale hợp lệ (vd /vi/khong-ton-tai).
//
// Khác với app/not-found.tsx ở gốc: file này nằm dưới app/[locale]/layout.tsx nên có sẵn
// <html>/<body>, globals.css và font — dùng được đúng giao diện app. Bản ở gốc phải viết kiểu
// inline vì nó chạy trước layout đó (xem ghi chú trong chính file kia).
export default function LocaleNotFound() {
  return (
    <main className="grid min-h-screen place-items-center px-6 py-16">
      <div className="w-full max-w-[440px] text-center">
        <div className="font-display text-[64px] font-bold leading-none text-navy/20">404</div>
        <h1 className="mt-3 font-display text-[22px] font-bold text-navy">Không tìm thấy trang</h1>
        <p className="mt-2 text-[14px] font-semibold leading-[1.6] text-navy/70">
          Đường dẫn này không tồn tại hoặc đã được đổi. Kiểm tra lại địa chỉ, hoặc quay về trang
          chính.
        </p>
        <Link
          href="/"
          className="btn-gold mt-6 inline-flex h-11 items-center rounded-xl px-6 font-display text-[14px] font-bold"
        >
          Về trang chính
        </Link>
      </div>
    </main>
  );
}

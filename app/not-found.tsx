// 404 ở GỐC — chạy khi URL không khớp locale nào (vd /xyz), tức là TRƯỚC cả
// app/[locale]/layout.tsx. Đây là điểm mấu chốt: layout đó mới là nơi dựng <html>/<body> và nạp
// globals.css, nên ở đây không có gì cả — bản trước dùng class Tailwind (`btn-gold`, `text-navy`…)
// nhưng chẳng có CSS nào được nạp, nên ra một khối chữ trần trên nền trắng, trông hệt như app hỏng.
//
// Vì vậy file này tự dựng <html>/<body> và viết kiểu dáng inline, không phụ thuộc CSS ngoài.
// Bản 404 dùng đúng giao diện app (cho URL sai bên trong một locale hợp lệ) nằm ở
// app/[locale]/not-found.tsx.
//
// GIỚI HẠN CẦN BIẾT: trang này chỉ hiện với người ĐÃ đăng nhập. Khách chưa đăng nhập vào URL sai
// sẽ bị middleware redirect về /login trước khi tới được đây. Cố ý không sửa: muốn khách lạ thấy
// 404 thì middleware phải giữ danh sách route hợp lệ, mà danh sách như vậy sẽ âm thầm 404 trang
// thật mỗi lần thêm route mới. Không tiết lộ route nào tồn tại cho người lạ cũng an toàn hơn.
export default function NotFound() {
  return (
    <html lang="vi">
      <body
        style={{
          margin: 0,
          minHeight: '100vh',
          display: 'grid',
          placeItems: 'center',
          padding: '24px',
          background: '#f7f8fc',
          fontFamily:
            'system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
          color: '#26275d',
        }}
      >
        <div style={{maxWidth: 440, textAlign: 'center'}}>
          <div style={{fontSize: 64, fontWeight: 700, lineHeight: 1, opacity: 0.15}}>404</div>
          <h1 style={{margin: '12px 0 0', fontSize: 22, fontWeight: 700}}>Không tìm thấy trang</h1>
          <p style={{margin: '10px 0 0', fontSize: 14, lineHeight: 1.65, opacity: 0.75}}>
            Đường dẫn này không tồn tại hoặc đã được đổi. Kiểm tra lại địa chỉ, hoặc quay về trang
            chính.
          </p>
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages --
              CỐ Ý dùng <a>: trang này chạy NGOÀI app/[locale]/layout.tsx, tức ngoài cả provider
              của next-intl. <Link> ở đây sẽ thiếu ngữ cảnh locale; <a> nạp lại trang từ đầu và
              để middleware quyết định locale — chắc chắn đúng trong mọi trường hợp. */}
          <a
            href="/vi"
            style={{
              display: 'inline-block',
              marginTop: 24,
              borderRadius: 12,
              padding: '12px 24px',
              fontSize: 14,
              fontWeight: 800,
              textDecoration: 'none',
              color: '#26275d',
              background: '#f9dd0e',
            }}
          >
            Về trang chính
          </a>
        </div>
      </body>
    </html>
  );
}

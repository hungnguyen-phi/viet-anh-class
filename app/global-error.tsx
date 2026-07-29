'use client';

// Lưới an toàn CUỐI CÙNG: chỉ chạy khi lỗi xảy ra ở chính root layout — lúc đó layout không
// render được nên Next thay TOÀN BỘ tài liệu bằng file này. Vì vậy nó phải tự dựng <html>/<body>,
// và KHÔNG được dựa vào globals.css (file đó nạp từ layout đã hỏng) → mọi kiểu dáng viết inline.
//
// Không có file này thì trường hợp đó ra một trang trắng hoàn toàn, không chữ nào.
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & {digest?: string};
  reset: () => void;
}) {
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
          <div style={{fontSize: 44, lineHeight: 1}}>⚠️</div>
          <h1 style={{margin: '12px 0 0', fontSize: 21, fontWeight: 700}}>
            Ứng dụng gặp sự cố
          </h1>
          <p style={{margin: '10px 0 0', fontSize: 14, lineHeight: 1.65, opacity: 0.75}}>
            Đã có lỗi ngoài dự tính. Bấm “Tải lại” để thử lại; nếu vẫn vậy, báo cho bộ phận kỹ
            thuật kèm mã lỗi bên dưới.
          </p>
          <button
            type="button"
            onClick={reset}
            style={{
              marginTop: 20,
              cursor: 'pointer',
              border: 0,
              borderRadius: 12,
              padding: '12px 24px',
              fontSize: 14,
              fontWeight: 800,
              color: '#26275d',
              background: '#f9dd0e',
            }}
          >
            Tải lại
          </button>
          {error.digest && (
            <p style={{marginTop: 16, fontSize: 11, fontWeight: 600, opacity: 0.5}}>
              Mã lỗi: {error.digest}
            </p>
          )}
        </div>
      </body>
    </html>
  );
}

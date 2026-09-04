'use client';

// Lưới an toàn CUỐI CÙNG: chỉ chạy khi lỗi xảy ra ở chính root layout — lúc đó layout không
// render được nên Next thay TOÀN BỘ tài liệu bằng file này. Vì vậy nó phải tự dựng <html>/<body>,
// và KHÔNG được dựa vào globals.css (file đó nạp từ layout đã hỏng) → mọi kiểu dáng viết inline.
//
// Không có file này thì trường hợp đó ra một trang trắng hoàn toàn, không chữ nào.
// Ngoài provider next-intl (root layout đã hỏng) → bảng chuỗi tĩnh, chọn theo <html lang> đang
// có trên tài liệu (next-intl đã đặt trước khi hỏng); mặc định vi.
const CHU = {
  vi: {title: 'Ứng dụng gặp sự cố', moTa: 'Đã có lỗi ngoài dự tính. Bấm “Tải lại” để thử lại; nếu vẫn vậy, báo cho bộ phận kỹ thuật kèm mã lỗi bên dưới.', taiLai: 'Tải lại', ma: 'Mã lỗi'},
  en: {title: 'Something went wrong', moTa: 'An unexpected error occurred. Press “Reload” to try again; if it persists, tell the tech team and quote the code below.', taiLai: 'Reload', ma: 'Error code'},
} as const;
export default function GlobalError({error}: {error: Error & {digest?: string}}) {
  const lang = typeof document !== 'undefined' && document.documentElement.lang === 'en' ? 'en' : 'vi';
  const c = CHU[lang];
  // TẢI LẠI THẬT, không gọi reset().
  //
  // reset() chỉ dựng lại cây React bằng CHÍNH mã đang có trong trình duyệt. Nhưng nguyên nhân phổ
  // biến nhất của màn hình này là lệch bản build sau khi deploy — mã trong tab đã cũ. Dựng lại
  // bằng mã cũ thì lỗi y nguyên, và người dùng bấm "Tải lại" ba lần vẫn thấy đúng một thứ.
  // location.reload() lấy lại mã mới từ máy chủ.
  const taiLai = () => {
    if (typeof window !== 'undefined') window.location.reload();
  };
  return (
    <html lang={lang}>
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
          <h1 style={{margin: '12px 0 0', fontSize: 21, fontWeight: 700}}>{c.title}</h1>
          <p style={{margin: '10px 0 0', fontSize: 14, lineHeight: 1.65, opacity: 0.75}}>{c.moTa}</p>
          <button
            type="button"
            onClick={taiLai}
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
            {c.taiLai}
          </button>
          {error.digest && (
            <p style={{marginTop: 16, fontSize: 11, fontWeight: 600, opacity: 0.5}}>
              {c.ma}: {error.digest}
            </p>
          )}
        </div>
      </body>
    </html>
  );
}

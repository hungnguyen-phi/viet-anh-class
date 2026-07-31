// MẪU — scripts/measure-query-waterfall.mjs chép file này ra gốc dự án thành `instrumentation.ts`
// lúc chạy, rồi XOÁ khi xong.
//
// ⚠ TUYỆT ĐỐI KHÔNG để bản đã chép nằm ở gốc dự án khi commit hay deploy. Nó bọc global.fetch, và
// dự án đã từng dính đúng chuyện đó: một bản bọc fetch tuỳ chỉnh làm hỏng đăng nhập trên
// production — requireProfile trả null nên mọi trang có xác thực đá về /login, trong khi trang
// công khai vẫn trả 200 nên nhìn qua tưởng vẫn ổn. .gitignore đã chặn sẵn phòng khi Ctrl-C giữa
// chừng.
//
// CHỈ bật khi MEASURE_SUPABASE=1. Không có biến đó thì file này không làm gì cả.

export async function register() {
  if (process.env.MEASURE_SUPABASE !== '1') return;
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;
  await import('./instrumentation-node');
}

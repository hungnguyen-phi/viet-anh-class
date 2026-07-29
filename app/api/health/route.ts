import {NextResponse} from 'next/server';

// Healthcheck cho container/platform (Coolify + Docker HEALTHCHECK).
// Đường dẫn /api/* nằm ngoài matcher middleware nên KHÔNG chạy i18n + refresh session Supabase
// → phản hồi nhẹ, không phụ thuộc DB, không bị redirect locale.
export const dynamic = 'force-dynamic';

// `commit` = mã commit đã được build vào ảnh đang chạy.
//
// VÌ SAO CẦN: workflow có HAI việc tách rời — build rồi đẩy ảnh lên GHCR, sau đó gọi webhook
// bảo Coolify kéo về. Việc thứ hai đã từng hỏng thật (webhook trả 520) trong khi việc thứ nhất
// vẫn thành công: ảnh mới nằm sẵn trên GHCR nhưng production vẫn chạy bản cũ, mà nhìn từ ngoài
// thì trang vẫn trả 200, không có dấu hiệu gì. Hậu quả đã xảy ra: đo hiệu năng của một bản sửa
// CHƯA HỀ được triển khai, rồi kết luận sai rằng bản sửa vô dụng.
// Có dòng này thì chỉ cần mở /api/health là biết production đang chạy đúng commit nào.
export function GET() {
  return NextResponse.json({
    status: 'ok',
    commit: process.env.NEXT_PUBLIC_GIT_SHA ?? 'unknown',
  });
}

// Cờ tính năng theo giai đoạn của PRD v3.
//
// PARENT_PORTAL (changelog #10): Giai đoạn 1 CHƯA có phiên bản phụ huynh — schema
// (parent_links, parent_invitations) giữ nguyên, chỉ tắt đường vào. Bật lại ở Giai đoạn 2
// bằng biến môi trường PARENT_PORTAL=true, không cần sửa mã.
export const PARENT_PORTAL = process.env.PARENT_PORTAL === 'true';

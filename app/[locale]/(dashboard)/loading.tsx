// Khung chờ dùng chung cho MỌI trang sau đăng nhập.
//
// Vì sao cần: layout (dashboard) là `force-dynamic` — mỗi lần bấm sang trang khác, Next phải hỏi
// server rồi mới vẽ được gì. Trước khi có file này, KHÔNG có ranh giới Suspense nào, nên trình
// duyệt giữ nguyên trang cũ và đứng im cho tới lúc server trả xong: người dùng bấm "Thời khoá
// biểu" rồi ngồi nhìn màn hình cũ vài giây, tưởng app treo hoặc bấm hụt.
//
// Có file này, Next hiện khung xám NGAY khi bấm. Thời gian server không đổi, nhưng người dùng
// thấy app phản hồi tức thì và biết chắc cú bấm đã ăn.
//
// Dựng bằng đúng token sẵn có (glass + navy) nên không tạo phong cách mới.
export default function DashboardLoading() {
  return (
    <div className="flex animate-pulse flex-col gap-4" aria-hidden>
      {/* Dòng tiêu đề */}
      <div className="h-[26px] w-[220px] rounded-[9px] bg-navy/[0.09]" />

      {/* Thẻ nội dung chính */}
      <div className="glass rounded-[20px] p-[18px]">
        <div className="flex flex-col gap-2.5">
          <div className="h-4 w-[45%] rounded-md bg-navy/[0.08]" />
          <div className="h-4 w-[70%] rounded-md bg-navy/[0.06]" />
          <div className="h-4 w-[60%] rounded-md bg-navy/[0.06]" />
          <div className="h-4 w-[38%] rounded-md bg-navy/[0.06]" />
        </div>
      </div>

      {/* Thẻ phụ */}
      <div className="glass rounded-[20px] p-[18px]">
        <div className="flex flex-col gap-2.5">
          <div className="h-4 w-[52%] rounded-md bg-navy/[0.08]" />
          <div className="h-4 w-[66%] rounded-md bg-navy/[0.06]" />
        </div>
      </div>
    </div>
  );
}

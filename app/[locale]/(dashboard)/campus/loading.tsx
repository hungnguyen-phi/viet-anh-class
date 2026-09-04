// Khung chờ RIÊNG cho màn cơ sở của ban giám hiệu — tiêu đề, khối tổng hợp thu gọn, bộ lọc,
// danh sách "lớp nào đi chậm", khu mục tiêu trường. Gần đúng hình trang thật để không nhảy bố cục
// (audit 04/09/2026 — cùng lý do như wig/loading.tsx).
export default function CampusLoading() {
  return (
    <div className="flex animate-pulse flex-col gap-3.5" aria-hidden>
      <div className="h-[30px] w-[220px] rounded-[12px] bg-navy/[0.1]" />

      <div className="glass rounded-[20px] p-[18px]">
        <div className="h-5 w-[260px] rounded-[8px] bg-navy/[0.1]" />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="h-11 w-[140px] rounded-[12px] bg-navy/[0.06]" />
        <div className="h-11 w-[120px] rounded-[12px] bg-navy/[0.06]" />
      </div>

      <div className="glass rounded-[20px] p-[18px]">
        <div className="h-5 w-[160px] rounded-[8px] bg-navy/[0.1]" />
        <div className="mt-3 flex flex-col gap-2">
          {Array.from({length: 5}).map((_, i) => (
            <div key={i} className="h-[72px] rounded-[12px] border border-navy/[0.08] bg-white/70" />
          ))}
        </div>
      </div>

      <div className="glass rounded-[20px] p-[18px]">
        <div className="h-5 w-[180px] rounded-[8px] bg-navy/[0.1]" />
        <div className="mt-3 h-[96px] rounded-[12px] border-[1.5px] border-dashed border-navy/[0.12] bg-white/50" />
      </div>
    </div>
  );
}

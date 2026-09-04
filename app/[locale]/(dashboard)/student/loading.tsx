// Khung chờ RIÊNG cho màn của em — gần đúng hình trang thật (thẻ chào + hàng cảm xúc, thanh tuần,
// thẻ mục tiêu lớp, thẻ mục tiêu của em, 4 ô lĩnh vực) để lúc dữ liệu về không nhảy bố cục.
// Bản chung (dashboard)/loading.tsx là ba khối chữ xám, khác hẳn hình trang này (audit 04/09/2026).
export default function StudentLoading() {
  return (
    <div className="flex animate-pulse flex-col gap-4" aria-hidden>
      <div className="glass rounded-[24px] p-5">
        <div className="flex items-center gap-4">
          <div className="h-[72px] w-[72px] shrink-0 rounded-[22px] bg-gold/50" />
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            <div className="h-3 w-[40%] rounded-md bg-navy/[0.08]" />
            <div className="h-7 w-[60%] rounded-md bg-navy/[0.12]" />
            <div className="h-3 w-[30%] rounded-md bg-navy/[0.06]" />
          </div>
        </div>
        <div className="mt-5 flex items-center justify-center gap-2.5">
          {Array.from({length: 6}).map((_, i) => (
            <div key={i} className="h-11 w-11 rounded-full bg-navy/[0.08]" />
          ))}
        </div>
      </div>

      <div className="flex items-center justify-between">
        <div className="h-11 w-11 rounded-full bg-navy/[0.08]" />
        <div className="h-5 w-[160px] rounded-md bg-navy/[0.1]" />
        <div className="h-11 w-11 rounded-full bg-navy/[0.08]" />
      </div>

      <div className="h-[22px] w-[150px] rounded-md bg-navy/[0.1]" />
      <div className="rounded-[16px] border-[1.5px] border-navy/[0.08] bg-white/70 p-4">
        <div className="flex items-start gap-3.5">
          <div className="h-[60px] w-[60px] shrink-0 rounded-full bg-navy/[0.08]" />
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            <div className="h-4 w-[70%] rounded-md bg-navy/[0.1]" />
            <div className="h-3 w-[45%] rounded-md bg-navy/[0.06]" />
          </div>
        </div>
      </div>

      <div className="h-[22px] w-[150px] rounded-md bg-navy/[0.1]" />
      <div className="rounded-[16px] border-[1.5px] border-navy/[0.08] bg-white/70 p-4">
        <div className="flex items-start gap-3.5">
          <div className="h-[60px] w-[60px] shrink-0 rounded-full bg-navy/[0.08]" />
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            <div className="h-4 w-[65%] rounded-md bg-navy/[0.1]" />
            <div className="h-3 w-[50%] rounded-md bg-navy/[0.06]" />
            <div className="mt-2 h-[120px] w-full rounded-[12px] bg-navy/[0.04]" />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {Array.from({length: 3}).map((_, i) => (
          <div key={i} className="h-[112px] rounded-[16px] border-[1.5px] border-dashed border-navy/10 bg-white/40" />
        ))}
      </div>
    </div>
  );
}

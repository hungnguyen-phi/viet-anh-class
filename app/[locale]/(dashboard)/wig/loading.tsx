// Khung chờ RIÊNG cho màn mục tiêu của thầy cô — tiêu đề + thanh tuần, dải ba số, khu "Mục tiêu
// của tôi", bảng các em. Gần đúng hình trang thật để không nhảy bố cục (audit 04/09/2026).
export default function WigLoading() {
  return (
    <div className="flex animate-pulse flex-col gap-4" aria-hidden>
      <div className="flex flex-wrap items-center gap-2">
        <div className="h-[26px] w-[240px] rounded-[9px] bg-navy/[0.1]" />
        <div className="ml-auto h-11 w-[140px] rounded-[12px] bg-navy/[0.07]" />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <div className="h-11 w-[110px] rounded-[12px] bg-navy/[0.06]" />
        <div className="h-11 w-[300px] max-w-full rounded-[12px] bg-navy/[0.08]" />
        <div className="h-11 w-[100px] rounded-[12px] bg-navy/[0.06]" />
      </div>

      <div className="glass rounded-[20px] p-[18px]">
        <div className="grid grid-cols-3 gap-3">
          {Array.from({length: 3}).map((_, i) => (
            <div key={i} className="h-[76px] rounded-[14px] border border-navy/[0.08] bg-white/70" />
          ))}
        </div>
      </div>

      <div className="glass rounded-[20px] p-[18px]">
        <div className="flex items-center justify-between">
          <div className="h-5 w-[150px] rounded-md bg-navy/[0.1]" />
          <div className="h-11 w-[170px] rounded-[12px] bg-gold/50" />
        </div>
        <div className="mt-4 h-[180px] rounded-[14px] border-[1.5px] border-navy/[0.08] bg-white/60" />
      </div>

      <div className="glass rounded-[20px] p-[18px]">
        <div className="h-5 w-[140px] rounded-md bg-navy/[0.1]" />
        <div className="mt-3 flex flex-col gap-2">
          {Array.from({length: 6}).map((_, i) => (
            <div key={i} className="h-11 rounded-[10px] bg-navy/[0.05]" />
          ))}
        </div>
      </div>
    </div>
  );
}

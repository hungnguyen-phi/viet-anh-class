// Donut % bằng conic-gradient (server component, không cần JS). Màu theo trạng thái 4DX.
const STATUS_COLOR: Record<string, string> = {
  on_track: 'var(--color-success)',
  mid: 'var(--color-warn)',
  off_track: 'var(--color-status-bad)',
};

export function DonutRing({pct, status}: {pct: number; status: string}) {
  const percent = Math.round((pct ?? 0) * 100);
  const color = STATUS_COLOR[status] ?? 'var(--color-grey-mid)';
  return (
    <div
      className="relative mx-auto flex h-16 w-16 items-center justify-center rounded-full"
      style={{background: `conic-gradient(${color} ${percent}%, #e8ebf5 0)`}}
    >
      <div className="absolute inset-[7px] rounded-full bg-white shadow-[inset_0_1px_3px_rgba(23,25,48,0.06)]" />
      <span className="relative font-heading text-[13px] font-black text-navy">
        {percent}%
      </span>
    </div>
  );
}

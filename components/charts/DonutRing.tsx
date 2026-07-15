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
      className="relative mx-auto flex h-14 w-14 items-center justify-center rounded-full"
      style={{background: `conic-gradient(${color} ${percent}%, #e4e7ec 0)`}}
    >
      <div className="absolute inset-[7px] rounded-full bg-white" />
      <span className="relative font-heading text-xs font-extrabold text-navy">
        {percent}%
      </span>
    </div>
  );
}

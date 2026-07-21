// Vòng tiến độ conic (server component, không cần JS) theo prototype v3.
// `color` là màu vòng (màu môn hoặc màu trạng thái); nền rãnh navy 8%.
const STATUS_COLOR: Record<string, string> = {
  on_track: 'var(--color-success)',
  mid: 'var(--color-warn)',
  off_track: 'var(--color-status-bad)',
};

export function DonutRing({
  pct,
  status,
  color,
  size = 78,
}: {
  pct: number;
  status?: string;
  color?: string;
  size?: number;
}) {
  const percent = Math.max(0, Math.min(100, Math.round((pct ?? 0) * 100)));
  const ring = color ?? STATUS_COLOR[status ?? ''] ?? 'var(--color-grey-mid)';
  const inset = Math.round(size * 0.1);
  const fontSize = Math.round(size * 0.22);
  return (
    <div
      className="relative mx-auto grid place-items-center rounded-full"
      style={{
        height: size,
        width: size,
        background: `conic-gradient(${ring} ${percent}%, rgba(38,39,93,0.08) 0)`,
      }}
    >
      <div
        className="absolute rounded-full bg-white/85"
        style={{inset}}
      />
      <span
        className="relative font-display font-bold"
        style={{color: ring, fontSize}}
      >
        {percent}%
      </span>
    </div>
  );
}

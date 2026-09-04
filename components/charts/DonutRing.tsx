// Vòng tiến độ conic (server component, không cần JS).
//
// Bản 17/08/2026: rãnh nhạt hơn, vòng dày hơn (14 % đường kính) và số ở giữa đậm — bản cũ vòng mảnh
// 10 % trên nền trắng nên ở 1 % trông như một vết xước, và người xem không đọc ra đó là "tiến độ".
// useTranslations của next-intl chạy được cả trong Server Component (không cần 'use client').
import {useTranslations} from 'next-intl';

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
  nhan,
}: {
  pct: number;
  status?: string;
  color?: string;
  size?: number;
  /** Chữ nhỏ dưới con số (vd "năm") — bỏ trống thì chỉ có %. */
  nhan?: string;
}) {
  const t = useTranslations('common');
  const percent = Math.max(0, Math.min(100, Math.round((pct ?? 0) * 100)));
  const ring = color ?? STATUS_COLOR[status ?? ''] ?? 'var(--color-navy)';
  const inset = Math.round(size * 0.14);
  const fontSize = Math.round(size * (nhan ? 0.24 : 0.26));
  return (
    <div
      role="img"
      aria-label={t('tienDoPhanTram', {pct: percent})}
      className="relative mx-auto grid shrink-0 place-items-center rounded-full"
      style={{
        height: size,
        width: size,
        background: `conic-gradient(${ring} ${percent}%, rgba(38,39,93,0.10) 0)`,
      }}
    >
      <div className="absolute rounded-full bg-white" style={{inset}} />
      <span className="relative flex flex-col items-center leading-none">
        <span className="font-display font-bold tabular-nums text-navy" style={{fontSize}}>
          {percent}%
        </span>
        {nhan && <span className="mt-0.5 text-nhan font-extrabold uppercase tracking-wide text-grey-mid">{nhan}</span>}
      </span>
    </div>
  );
}

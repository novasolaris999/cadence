import type { ReactNode } from 'react';

interface Slice {
  key: string;
  share: number; // 0..1, slices should sum to 1
  color: string; // CSS color
  label: string;
}

/** Donut chart: one arc per slice, each offset by the shares before it. */
export function Donut({ slices, size = 112, stroke = 14, children }: { slices: Slice[]; size?: number; stroke?: number; children?: ReactNode }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const gap = slices.length > 1 ? 2 : 0; // small gap between segments, in px of arc length
  let offset = 0;
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90" role="img" aria-label={slices.map((s) => `${s.label} ${Math.round(s.share * 100)}%`).join(', ')}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--c-surface-3)" strokeWidth={stroke} />
        {slices.map((s) => {
          const len = Math.max(0, s.share * c - gap);
          const el = (
            <circle
              key={s.key}
              cx={size / 2}
              cy={size / 2}
              r={r}
              fill="none"
              stroke={s.color}
              strokeWidth={stroke}
              strokeDasharray={`${len} ${c}`}
              strokeDashoffset={-offset}
            />
          );
          offset += s.share * c;
          return el;
        })}
      </svg>
      {children && <div className="absolute inset-0 flex flex-col items-center justify-center text-center">{children}</div>}
    </div>
  );
}

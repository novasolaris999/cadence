import type { ReactNode } from 'react';

interface Props {
  /** 0..1 */
  value: number;
  size?: number;
  stroke?: number;
  /** CSS color for the progress arc, e.g. 'var(--c-hit)'. */
  color: string;
  trackColor?: string;
  children?: ReactNode;
}

/** Progress ring. Hand-written SVG: a background circle plus an arc drawn with stroke-dasharray. */
export function Ring({ value, size = 32, stroke = 3, color, trackColor = 'var(--c-surface-3)', children }: Props) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const v = Math.max(0, Math.min(1, value));
  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90" aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={trackColor} strokeWidth={stroke} />
        {v > 0 && (
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke={color}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={`${c * v} ${c}`}
          />
        )}
      </svg>
      {children && <div className="absolute inset-0 flex items-center justify-center">{children}</div>}
    </div>
  );
}

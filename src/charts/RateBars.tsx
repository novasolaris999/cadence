import { useState } from 'react';
import { cx } from '../components/cx';

export interface RateBar {
  /** Short label under the bar ("W40", "Sep", "M"). */
  label: string;
  /** 0..1, or null when nothing resolved (drawn as a stub). */
  rate: number | null;
  /** Shown above the chart when the bar is selected ("Week of Sep 28 · 4 hits, 1 miss"). */
  detail: string;
}

const H = 72; // plot height in viewBox units
const GAP = 6;
const R = 4; // rounded data-end

/** A bar rounded at the top only, standing on the baseline. */
function barPath(x: number, w: number, h: number): string {
  const r = Math.min(R, w / 2, h);
  const y = H - h;
  return `M${x},${H} V${y + r} Q${x},${y} ${x + r},${y} H${x + w - r} Q${x + w},${y} ${x + w},${y + r} V${H} Z`;
}

/**
 * Hit rate per period or per weekday: one series, so no legend (the section title names it).
 * Thin single-hue bars on a quiet baseline. Tap or hover a bar to read it; the caption above
 * shows the selected bar's value, starting with `initial` (the current period).
 */
export function RateBars({ items, initial, label }: { items: RateBar[]; initial?: number; label: string }) {
  const [sel, setSel] = useState(initial ?? items.length - 1);
  const n = items.length;
  const W = 300;
  const w = (W - GAP * (n - 1)) / n;
  const cur = items[sel];
  return (
    <figure className="flex flex-col gap-1.5" aria-label={label}>
      <figcaption className="flex min-h-5 items-baseline justify-between gap-2 text-body-sm">
        <span className="truncate text-muted">{cur?.detail}</span>
        <span className="shrink-0 font-display text-headline-sm font-bold text-text">
          {cur?.rate === null || cur === undefined ? '–' : `${Math.round(cur.rate * 100)}%`}
        </span>
      </figcaption>
      <svg viewBox={`0 0 ${W} ${H + 1}`} className="h-[72px] w-full overflow-visible" preserveAspectRatio="none" role="img">
        {/* 50% and 100% guides, recessive */}
        <line x1={0} x2={W} y1={H / 2} y2={H / 2} stroke="var(--c-border)" strokeDasharray="2 3" vectorEffect="non-scaling-stroke" />
        <line x1={0} x2={W} y1={0} y2={0} stroke="var(--c-border)" strokeDasharray="2 3" vectorEffect="non-scaling-stroke" />
        {items.map((it, i) => {
          const x = i * (w + GAP);
          const h = it.rate === null ? 2 : Math.max(2, it.rate * H);
          return (
            <g key={i} onClick={() => setSel(i)} onMouseEnter={() => setSel(i)} className="cursor-pointer">
              {/* Hit target: the whole column, bigger than the bar */}
              <rect x={x - GAP / 2} y={0} width={w + GAP} height={H} fill="transparent" />
              <path
                d={barPath(x, w, h)}
                fill={it.rate === null ? 'var(--c-text-faint)' : 'var(--c-primary)'}
                opacity={it.rate === null ? 0.35 : i === sel ? 1 : 0.45}
              />
              <title>{`${it.detail}: ${it.rate === null ? 'nothing resolved' : `${Math.round(it.rate * 100)}%`}`}</title>
            </g>
          );
        })}
        <line x1={0} x2={W} y1={H} y2={H} stroke="var(--c-text-faint)" strokeOpacity={0.5} vectorEffect="non-scaling-stroke" />
      </svg>
      <div className="grid text-center text-label-sm" style={{ gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))`, columnGap: 4 }}>
        {items.map((it, i) => (
          <button
            key={i}
            type="button"
            onClick={() => setSel(i)}
            className={cx('truncate rounded', i === sel ? 'font-semibold text-text' : 'text-faint')}
          >
            {it.label}
          </button>
        ))}
      </div>
    </figure>
  );
}

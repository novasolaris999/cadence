import { cx } from '../../components/cx';
import type { CellState } from '../../domain/metrics';
import { addDays, startOfWeek, weekdayInitial, type Scope } from '../../domain/time';
import type { ISODate, Weekday } from '../../domain/types';

/** Fill for each cell state; shared by every grid and strip. */
export const CELL: Record<CellState, string> = {
  hit: 'bg-hit',
  miss: 'bg-miss',
  skipped: 'bg-miss/30 ring-1 ring-inset ring-miss',
  partial: 'bg-warn',
  pending: 'bg-primary animate-pulse',
  scheduled: 'ring-1 ring-inset ring-primary/50',
  rest: 'bg-surface-3',
  future: 'bg-surface-3/40',
};

const MONTHS = ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'];

interface Props {
  cells: { date: ISODate; state: CellState }[];
  scope: Scope;
  from: ISODate;
  to: ISODate;
  /** Weekdays to highlight in the header (the target's scheduled days). */
  highlightDays?: Weekday[];
}

/**
 * Hit / miss / rest grid for one goal (goals-dark.html "LED" panel).
 * Weekly and monthly: weekday columns, one row per week.
 * Quarterly and yearly: GitHub-style, weekday rows and one column per week.
 */
export function HitGrid({ cells, scope, from, to, highlightDays = [] }: Props) {
  const byDate = new Map(cells.map((c) => [c.date, c.state]));
  const gridStart = startOfWeek(from);
  const weeks: ISODate[][] = [];
  for (let monday = gridStart; monday <= to; monday = addDays(monday, 7)) {
    weeks.push(Array.from({ length: 7 }, (_, i) => addDays(monday, i)));
  }
  const cell = (d: ISODate, className: string) => {
    const state = d >= from && d <= to ? byDate.get(d) : undefined;
    return (
      <div
        key={d}
        title={state ? `${d}: ${state}` : undefined}
        className={cx(className, state ? CELL[state] : 'invisible')}
      />
    );
  };

  if (scope === 'weekly' || scope === 'monthly') {
    return (
      <div className="rounded-lg bg-sunken p-2.5">
        <div className="mb-1.5 grid grid-cols-7 text-center text-label-sm text-faint">
          {([1, 2, 3, 4, 5, 6, 7] as Weekday[]).map((w) => (
            <span key={w} className={cx(highlightDays.includes(w) && 'font-semibold text-hit-ink')}>
              {weekdayInitial(w)}
            </span>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1.5">{weeks.flat().map((d) => cell(d, 'h-4 rounded-[3px]'))}</div>
      </div>
    );
  }

  const gap = scope === 'yearly' ? 2 : 3;
  return (
    <div className="rounded-lg bg-sunken p-2.5">
      <div className="grid text-[9px] text-faint" style={{ gridTemplateColumns: `repeat(${weeks.length}, minmax(0, 1fr))`, columnGap: gap }}>
        {weeks.map((w) => {
          const first = w.find((d) => d.slice(8) === '01' && d >= from && d <= to);
          return <span key={w[0]} className="overflow-visible whitespace-nowrap">{first ? MONTHS[Number(first.slice(5, 7)) - 1] : ''}</span>;
        })}
      </div>
      <div
        className="mt-1 grid"
        style={{
          gridTemplateColumns: `repeat(${weeks.length}, minmax(0, 1fr))`,
          gridTemplateRows: 'repeat(7, auto)',
          gridAutoFlow: 'column',
          gap,
        }}
      >
        {weeks.flat().map((d) => cell(d, cx('aspect-square', scope === 'yearly' ? 'rounded-[1px]' : 'rounded-[2px]')))}
      </div>
    </div>
  );
}

/** `partial` adds the routine state (some of a routine's habits done). */
export function GridLegend({ partial = false }: { partial?: boolean }) {
  const items: [string, string][] = [
    ['Hit', CELL.hit],
    ...(partial ? ([['Partial', CELL.partial]] as [string, string][]) : []),
    ['Miss', CELL.miss],
    ['Skipped', CELL.skipped],
    ['Rest', CELL.rest],
    ['Today', CELL.pending],
  ];
  return (
    <div className="flex flex-wrap items-center justify-end gap-x-3 gap-y-1">
      {items.map(([label, cls]) => (
        <span key={label} className="flex items-center gap-1 text-label-sm text-muted">
          <span className={cx('h-2 w-2 rounded-[2px]', cls)} />
          {label}
        </span>
      ))}
    </div>
  );
}


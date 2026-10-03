import { useMemo, useState, type ReactNode } from 'react';
import { Link } from 'react-router';
import { cx } from '../../components/cx';
import { Icon } from '../../components/Icon';
import { PeriodNav } from '../../components/PeriodNav';
import { StatTile } from '../../components/StatTile';
import { routineCellsForRange, routineDays, weekCellsForRange } from '../../domain/history';
import { cellsForRange, overallStreak, pct, rateTier, tally, type CellState } from '../../domain/metrics';
import { targetDays } from '../../domain/schedule';
import { formatDayShort, formatPeriodShort, periodContaining, shiftPeriod, weekdayInitial, type Scope } from '../../domain/time';
import type { Block, ISODate, Routine, Target, Weekday } from '../../domain/types';
import { CELL, GridLegend, HitGrid } from './HitGrid';

const TIER: Record<ReturnType<typeof rateTier>, string> = {
  good: 'text-hit-ink',
  ok: 'text-warn-ink',
  low: 'text-miss-ink',
  none: 'text-faint',
};

/**
 * A routine's record: how many days were fully done, and each habit side by side as a strip of
 * days (weeks for quarters and years), so the one that slips stands out. `blocks` = every block of
 * the routine's habits.
 */
export function RoutineHistory({
  routine,
  habits,
  blocks,
  today,
}: {
  routine: Routine;
  /** In routine order. */
  habits: Target[];
  blocks: Block[];
  today: ISODate;
}) {
  const [scope, setScope] = useState<Scope>('monthly');
  const [offset, setOffset] = useState(0);
  const period = shiftPeriod(periodContaining(scope, today), offset);
  const prevPeriod = shiftPeriod(period, -1);
  const byWeek = scope === 'quarterly' || scope === 'yearly';

  const s = useMemo(() => {
    const ids = new Set(habits.map((h) => h.id));
    const mine = blocks.filter((b) => b.targetId && ids.has(b.targetId));
    const within = (p: { from: ISODate; to: ISODate }) => mine.filter((b) => b.date >= p.from && b.date <= p.to);
    const inPeriod = within(period);
    const strip = (list: Block[]) =>
      byWeek ? weekCellsForRange(list, period.from, period.to, today) : cellsForRange(list, period.from, period.to, today);
    return {
      inPeriod,
      tally: tally(inPeriod, today),
      prev: tally(within(prevPeriod), today),
      days: routineDays(inPeriod, period.from, period.to, today),
      streak: overallStreak(mine.filter((b) => b.date <= today), today),
      rows: habits.map((h) => {
        const own = inPeriod.filter((b) => b.targetId === h.id);
        return { habit: h, cells: strip(own), rate: tally(own, today).rate };
      }),
    };
  }, [blocks, habits, period.from, period.to, prevPeriod.from, today, byWeek]);

  const delta = s.tally.rate !== null && s.prev.rate !== null ? Math.round((s.tally.rate - s.prev.rate) * 100) : null;
  const n = s.rows[0]?.cells.length ?? 0;

  return (
    <section className="flex flex-col gap-4 rounded-2xl border border-border bg-surface p-4 shadow-card" aria-label="History">
      <h2 className="flex items-center gap-2 text-headline-sm font-bold">
        <span className="h-4 w-1.5 rounded-full bg-primary" /> History
      </h2>
      <PeriodNav
        scope={scope}
        offset={offset}
        period={period}
        onChange={(sc, o) => {
          setScope(sc);
          setOffset(Math.min(0, o));
        }}
      />

      <div className="grid grid-cols-2 gap-2 min-[420px]:grid-cols-4">
        <StatTile label="Completion" value={pct(s.tally.rate)}>
          <span className="text-muted">of every habit</span>
        </StatTile>
        <StatTile label="All done" value={<span className="text-hit-ink">{s.days.full}</span>}>
          <span className="text-muted">
            day{s.days.full === 1 ? '' : 's'} · {s.days.partial} partial
          </span>
        </StatTile>
        <StatTile
          label="Streak"
          value={
            <>
              {s.streak}
              <Icon name="local_fire_department" size={18} className={cx('ml-0.5 self-center', s.streak ? 'text-warn' : 'text-faint')} />
            </>
          }
        >
          <span className="text-muted">no-miss days</span>
        </StatTile>
        <StatTile
          label="Change"
          value={
            delta === null ? (
              '–'
            ) : (
              <span className={delta >= 0 ? 'text-hit-ink' : 'text-miss-ink'}>
                {delta > 0 ? '+' : ''}
                {delta}
                <span className="ml-0.5 text-body-sm">pts</span>
              </span>
            )
          }
        >
          <span className="text-muted">vs {formatPeriodShort(prevPeriod)}</span>
        </StatTile>
      </div>

      <div className="flex flex-col gap-2">
        <h3 className="text-label-sm font-semibold uppercase tracking-wider text-faint">Whole routine</h3>
        <HitGrid
          cells={routineCellsForRange(s.inPeriod, period.from, period.to, today)}
          scope={period.scope}
          from={period.from}
          to={period.to}
          highlightDays={targetDays(routine)}
        />
      </div>

      <div className="flex flex-col gap-2">
        <h3 className="flex items-baseline justify-between text-label-sm font-semibold uppercase tracking-wider text-faint">
          Habit by habit
          <span className="normal-case tracking-normal">{byWeek ? 'one cell per week' : 'one cell per day'}</span>
        </h3>
        <div className="flex flex-col gap-2.5 rounded-lg bg-sunken p-2.5">
          {scope === 'weekly' && (
            <Strip n={7}>
              {([1, 2, 3, 4, 5, 6, 7] as Weekday[]).map((w) => (
                <span key={w} className="text-center text-label-sm text-faint">
                  {weekdayInitial(w)}
                </span>
              ))}
            </Strip>
          )}
          {s.rows.map(({ habit, cells, rate }) => (
            <Link key={habit.id} to={`/goals/${habit.id}`} className="group flex flex-col gap-1">
              <span className="flex items-baseline justify-between gap-2">
                <span className="truncate text-body-sm text-text group-hover:underline">{habit.name}</span>
                <span className={cx('shrink-0 font-mono text-label-sm font-semibold', TIER[rateTier(rate)])}>{pct(rate)}</span>
              </span>
              <Strip n={n}>
                {cells.map((c) => (
                  <span
                    key={c.date}
                    title={`${formatDayShort(c.date)}: ${c.state}`}
                    className={cx(scope === 'weekly' ? 'h-4 rounded-[3px]' : 'h-3 rounded-[2px]', CELL[c.state as CellState])}
                  />
                ))}
              </Strip>
            </Link>
          ))}
          {scope !== 'weekly' && n > 0 && (
            <span className="flex justify-between text-label-sm text-faint">
              <span>{formatDayShort(period.from)}</span>
              <span>{formatDayShort(period.to)}</span>
            </span>
          )}
        </div>
        <GridLegend partial />
      </div>
    </section>
  );
}

/** A row of equal cells, as many as fit: days of a week or month, or weeks of a quarter or year. */
function Strip({ n, children }: { n: number; children: ReactNode }) {
  return (
    <div className="grid" style={{ gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))`, gap: n > 40 ? 1 : n > 10 ? 2 : 6 }}>
      {children}
    </div>
  );
}

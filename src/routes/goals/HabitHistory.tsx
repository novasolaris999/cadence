import { useMemo, useState } from 'react';
import { RateBars } from '../../charts/RateBars';
import { cx } from '../../components/cx';
import { Icon } from '../../components/Icon';
import { PeriodNav } from '../../components/PeriodNav';
import { StatTile } from '../../components/StatTile';
import { bestStreak, periodRates, recentResults, weekdayRates } from '../../domain/history';
import { cellsForRange, pct, tally, targetStreak } from '../../domain/metrics';
import { isAnytime } from '../../domain/routines';
import { targetDays } from '../../domain/schedule';
import {
  addDays,
  formatDayShort,
  formatPeriod,
  formatPeriodShort,
  formatTime,
  periodContaining,
  shiftPeriod,
  weekdayInitial,
  weekdayLong,
  type Scope,
} from '../../domain/time';
import type { Block, ISODate, Target } from '../../domain/types';
import { GridLegend, HitGrid } from './HitGrid';

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const counts = (hits: number, misses: number) => `${plural(hits, 'hit')}, ${plural(misses, 'miss', 'misses')}`;

/**
 * A habit's full record: any week, month, quarter, or year (step back with the arrows), its streaks,
 * how the rate moved over the last 8 periods, which weekdays are weakest, and the latest results.
 * `blocks` is the habit's whole history.
 */
export function HabitHistory({ target, blocks, today }: { target: Target; blocks: Block[]; today: ISODate }) {
  const [scope, setScope] = useState<Scope>('monthly');
  const [offset, setOffset] = useState(0);
  const period = shiftPeriod(periodContaining(scope, today), offset);

  const stats = useMemo(() => {
    const inPeriod = blocks.filter((b) => b.date >= period.from && b.date <= period.to);
    const recentWeeks = blocks.filter((b) => b.date >= addDays(today, -7 * 12));
    const weekdays = weekdayRates(recentWeeks, today);
    const withData = weekdays.filter((w) => w.rate !== null);
    const weakest = withData.length > 1 ? withData.reduce((a, b) => (b.rate! < a.rate! ? b : a)) : null;
    return {
      inPeriod,
      tally: tally(inPeriod, today),
      streak: targetStreak(blocks.filter((b) => b.date <= today), today),
      best: bestStreak(blocks, today),
      trend: periodRates(blocks, period, 8, today),
      weekdays,
      weakest: weakest && weakest.rate! < 1 ? weakest : null,
      recent: recentResults(blocks, today, 8),
    };
  }, [blocks, period.from, period.to, scope, today]);

  const anytime = isAnytime(target);
  const { tally: t } = stats;
  // The trend's second-to-last bar is the previous period.
  const prev = stats.trend[stats.trend.length - 2]!;
  const delta = t.rate !== null && prev.rate !== null ? Math.round((t.rate - prev.rate) * 100) : null;

  return (
    <section className="flex flex-col gap-4 rounded-2xl border border-border bg-surface p-4 shadow-card" aria-label="History">
      <h2 className="flex items-center gap-2 text-headline-sm font-bold">
        <span className="h-4 w-1.5 rounded-full bg-primary" /> History
      </h2>
      <PeriodNav
        scope={scope}
        offset={offset}
        period={period}
        onChange={(s, o) => {
          setScope(s);
          setOffset(Math.min(0, o));
        }}
      />

      <div className="grid grid-cols-2 gap-2 min-[420px]:grid-cols-4">
        <StatTile label="Rate" value={pct(t.rate)}>
          <span className="text-muted">{counts(t.hits, t.misses)}</span>
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
          <span className="text-muted">vs {formatPeriodShort(prev.period)}</span>
        </StatTile>
        <StatTile
          label="Streak"
          value={
            <>
              {stats.streak}
              <Icon name="local_fire_department" size={18} className={cx('ml-0.5 self-center', stats.streak ? 'text-warn' : 'text-faint')} />
            </>
          }
        >
          <span className="text-muted">in a row now</span>
        </StatTile>
        <StatTile label="Best" value={stats.best}>
          <span className="text-muted">longest run</span>
        </StatTile>
      </div>

      <div className="flex flex-col gap-2">
        <HitGrid
          cells={cellsForRange(stats.inPeriod, period.from, period.to, today)}
          scope={period.scope}
          from={period.from}
          to={period.to}
          highlightDays={targetDays(target)}
        />
        <GridLegend />
      </div>

      <div className="flex flex-col gap-1">
        <h3 className="text-label-sm font-semibold uppercase tracking-wider text-faint">Rate, last 8 {scope === 'weekly' ? 'weeks' : scope === 'monthly' ? 'months' : scope === 'quarterly' ? 'quarters' : 'years'}</h3>
        <RateBars
          key={`${scope}-${offset}`}
          label="Hit rate per period"
          items={stats.trend.map((p) => ({
            label: formatPeriodShort(p.period),
            rate: p.rate,
            detail: `${formatPeriod(p.period)} · ${counts(p.hits, p.misses)}`,
          }))}
        />
      </div>

      <div className="flex flex-col gap-1">
        <h3 className="flex items-baseline justify-between gap-2 text-label-sm font-semibold uppercase tracking-wider text-faint">
          By weekday, last 12 weeks
          {stats.weakest && (
            <span className="normal-case tracking-normal text-muted">Weakest: {weekdayLong(stats.weakest.weekday)}</span>
          )}
        </h3>
        <RateBars
          label="Hit rate per weekday"
          initial={stats.weakest ? stats.weakest.weekday - 1 : undefined}
          items={stats.weekdays.map((w) => ({
            label: weekdayInitial(w.weekday),
            rate: w.rate,
            detail: `${weekdayLong(w.weekday)}s · ${w.rate === null ? 'not scheduled' : counts(w.hits, w.misses)}`,
          }))}
        />
      </div>

      <div className="flex flex-col gap-1">
        <h3 className="text-label-sm font-semibold uppercase tracking-wider text-faint">Latest</h3>
        {stats.recent.length === 0 ? (
          <p className="text-body-sm text-faint">No results yet. They appear here once days pass.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-border">
            {stats.recent.map((r) => (
              <li key={`${r.date}-${r.start}`} className="flex items-center justify-between gap-2 py-1.5 text-body-sm">
                <span className="text-text">
                  {formatDayShort(r.date)}
                  {!anytime && <span className="font-mono text-label-sm text-faint"> · {formatTime(r.start)}</span>}
                </span>
                <Outcome outcome={r.outcome} completedAt={r.completedAt} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

/** A result as icon plus words, never color alone. */
function Outcome({ outcome, completedAt }: { outcome: string; completedAt: string | null }) {
  if (outcome === 'hit')
    return (
      <span className="flex items-center gap-1 rounded-full bg-hit/15 px-2 py-0.5 text-label-sm font-semibold text-hit-ink">
        <Icon name="check" size={14} /> Done{completedAt ? ` ${completedAt.slice(11, 16)}` : ''}
      </span>
    );
  if (outcome === 'skipped')
    return (
      <span className="flex items-center gap-1 rounded-full bg-surface-3 px-2 py-0.5 text-label-sm font-semibold text-muted">
        <Icon name="skip_next" size={14} /> Skipped
      </span>
    );
  return (
    <span className="flex items-center gap-1 rounded-full bg-miss/15 px-2 py-0.5 text-label-sm font-semibold text-miss-ink">
      <Icon name="close" size={14} /> Missed
    </span>
  );
}

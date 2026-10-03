import { useMemo, useState, type ReactNode } from 'react';
import { Link, useSearchParams } from 'react-router';
import { cx } from '../../components/cx';
import { Icon } from '../../components/Icon';
import { Page } from '../../components/Page';
import { SegmentedControl } from '../../components/SegmentedControl';
import { useBlocks, useCategories, useTargets } from '../../data/queries';
import { overallStreak, pct, tally } from '../../domain/metrics';
import { addDays, formatDateSpan, formatPeriod, periodContaining, shiftPeriod, type Scope } from '../../domain/time';
import { useNow } from '../../theme/useNow';
import { GoalCard } from './GoalCard';
import { GridLegend } from './HitGrid';

const SCOPES: { value: Scope; label: string }[] = [
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'quarterly', label: 'Quarterly' },
  { value: 'yearly', label: 'Yearly' },
];

/** Goals: every target's hit / miss / rest history for a period (goals-dark.html). */
export function GoalsScreen() {
  const now = useNow();
  const [params, setParams] = useSearchParams();
  const scope = (SCOPES.find((s) => s.value === params.get('scope'))?.value ?? 'monthly') as Scope;
  const offset = Math.min(0, Number(params.get('offset') ?? 0) || 0);
  const period = shiftPeriod(periodContaining(scope, now.today), offset);
  const prev = shiftPeriod(period, -1);
  const set = (s: Scope, o: number) => setParams({ scope: s, ...(o ? { offset: String(o) } : {}) }, { replace: true });

  const { data: targets = [] } = useTargets();
  const { data: categories = [] } = useCategories();
  // One read covers this period, the previous one (for the trend), and a year of streak history.
  const historyFrom = [prev.from, addDays(now.today, -366)].sort()[0]!;
  const historyTo = [period.to, addDays(now.today, 14)].sort().at(-1)!;
  const { data: blocks = [] } = useBlocks(historyFrom, historyTo);

  const inPeriod = useMemo(() => blocks.filter((b) => b.date >= period.from && b.date <= period.to), [blocks, period.from, period.to]);
  const inPrev = useMemo(() => blocks.filter((b) => b.date >= prev.from && b.date <= prev.to), [blocks, prev.from, prev.to]);
  const linked = (list: typeof blocks) => list.filter((b) => b.targetId);

  const current = tally(linked(inPeriod), now.today);
  const before = tally(linked(inPrev), now.today);
  const delta = current.rate !== null && before.rate !== null ? Math.round((current.rate - before.rate) * 100) : null;
  const streak = overallStreak(linked(blocks.filter((b) => b.date <= now.today)), now.today);

  // Archived targets are always listed (folded away), so you can open and restore them.
  const active = targets.filter((t) => t.active);
  const archived = targets.filter((t) => !t.active);
  const [showArchived, setShowArchived] = useState(false);
  const catById = new Map(categories.map((c) => [c.id, c]));

  const card = (t: (typeof targets)[number]) => (
    <GoalCard
      key={t.id}
      target={t}
      category={t.categoryId ? (catById.get(t.categoryId) ?? null) : null}
      periodBlocks={inPeriod.filter((b) => b.targetId === t.id)}
      historyBlocks={blocks.filter((b) => b.targetId === t.id)}
      period={period}
      today={now.today}
    />
  );

  return (
    <Page>
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h1 className="text-headline-lg font-semibold">Goals</h1>
          <Link
            to="/goals/new"
            className="flex h-9 items-center gap-1 rounded-full bg-primary px-3.5 text-label-lg font-semibold text-on-primary shadow-card active:scale-95"
          >
            <Icon name="add" size={18} /> New target
          </Link>
        </div>

        <SegmentedControl label="Scope" value={scope} options={SCOPES} onChange={(s) => set(s, 0)} />

        <div className="flex items-center justify-between">
          <button aria-label="Previous period" onClick={() => set(scope, offset - 1)} className="rounded-full p-1 text-faint hover:bg-surface-2 hover:text-text">
            <Icon name="chevron_left" />
          </button>
          <span className="text-label-lg font-semibold">{formatPeriod(period)}</span>
          <button
            aria-label="Next period"
            disabled={offset === 0}
            onClick={() => set(scope, offset + 1)}
            className="rounded-full p-1 text-faint hover:bg-surface-2 hover:text-text disabled:opacity-30"
          >
            <Icon name="chevron_right" />
          </button>
        </div>

        {/* Summary strip */}
        <section className="flex flex-col gap-2.5 rounded-xl bg-surface p-3.5 shadow-card">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-2 text-label-md uppercase tracking-wider">
              <span className="h-2 w-2 rounded-full bg-hit" /> Summary
            </span>
            <span className="rounded-full bg-surface-3 px-2 py-0.5 text-label-sm text-hit-ink">
              {formatDateSpan(period.from, period.to)}
            </span>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <Metric label="Consistency" value={pct(current.rate)}>
              {delta !== null && (
                <span className={cx(delta >= 0 ? 'text-hit-ink' : 'text-miss-ink')}>
                  {delta >= 0 ? '+' : ''}
                  {delta} pts vs prev
                </span>
              )}
            </Metric>
            <Metric
              label="Streak"
              value={
                <>
                  {streak}
                  <span className="ml-0.5 text-body-sm text-faint">d</span>
                </>
              }
            >
              <span className="text-muted">No-miss days</span>
            </Metric>
            <Metric
              label="Hits / misses"
              value={
                <span className="flex items-baseline gap-1 text-headline-lg">
                  <span className="text-hit-ink">{current.hits}</span>
                  <span className="text-body-sm text-faint">/</span>
                  <span className="text-miss-ink">{current.misses}</span>
                </span>
              }
            >
              <span className="text-muted">{current.pending + current.upcoming} still ahead</span>
            </Metric>
          </div>
        </section>

        <GridLegend />

        {active.length === 0 ? (
          <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-border px-4 py-8 text-center">
            <Icon name="event_repeat" size={28} className="text-faint" />
            <p className="text-body-md text-muted">No routines yet. Add the first thing you want to do every week.</p>
            <Link to="/goals/new" className="mt-1 rounded-full bg-primary px-4 py-2 text-label-lg font-semibold text-on-primary">
              New target
            </Link>
          </div>
        ) : (
          <div className="flex flex-col gap-3">{active.map(card)}</div>
        )}

        {archived.length > 0 && (
          <>
            <button
              type="button"
              onClick={() => setShowArchived((v) => !v)}
              aria-expanded={showArchived}
              className="flex items-center gap-1.5 pt-2 text-label-md font-semibold uppercase tracking-wider text-faint hover:text-muted"
            >
              <Icon name="archive" size={16} /> Archived ({archived.length})
              <Icon name={showArchived ? 'keyboard_arrow_up' : 'keyboard_arrow_down'} size={16} />
            </button>
            {showArchived && <div className="flex flex-col gap-3">{archived.map(card)}</div>}
          </>
        )}
      </div>
    </Page>
  );
}

function Metric({ label, value, children }: { label: string; value: ReactNode; children?: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col rounded-lg bg-surface-2 p-2.5">
      <span className="truncate text-label-sm uppercase text-faint">{label}</span>
      <span className="mt-0.5 flex h-8 items-baseline font-display text-metric font-bold">{value}</span>
      <span className="mt-0.5 truncate text-label-sm">{children}</span>
    </div>
  );
}

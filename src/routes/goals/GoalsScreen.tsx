import { useMemo, useState, type ReactNode } from 'react';
import { Link, useSearchParams } from 'react-router';
import { cx } from '../../components/cx';
import { Icon } from '../../components/Icon';
import { Page } from '../../components/Page';
import { SegmentedControl } from '../../components/SegmentedControl';
import { Sheet } from '../../components/Sheet';
import { RoutineIcon } from '../../components/RoutineParts';
import { useBlocks, useCategories, useRoutines, useTargets } from '../../data/queries';
import { ROUTINE_TEMPLATES, habitLength, routineMinutes } from '../../domain/routines';
import { formatDuration } from '../../domain/time';
import { overallStreak, pct, tally } from '../../domain/metrics';
import { addDays, formatDateSpan, formatPeriod, periodContaining, shiftPeriod, type Scope } from '../../domain/time';
import { useNow } from '../../theme/useNow';
import { GoalCard } from './GoalCard';
import { RoutineGoalCard } from './RoutineGoalCard';
import { GridLegend } from './HitGrid';

const SCOPES: { value: Scope; label: string }[] = [
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'quarterly', label: 'Quarterly' },
  { value: 'yearly', label: 'Yearly' },
];

/** Habits: routines (as supersets) and habits, with hit / miss / rest history for a period (goals-dark.html). */
export function GoalsScreen() {
  const now = useNow();
  const [params, setParams] = useSearchParams();
  const scope = (SCOPES.find((s) => s.value === params.get('scope'))?.value ?? 'monthly') as Scope;
  const offset = Math.min(0, Number(params.get('offset') ?? 0) || 0);
  const period = shiftPeriod(periodContaining(scope, now.today), offset);
  const prev = shiftPeriod(period, -1);
  const set = (s: Scope, o: number) => setParams({ scope: s, ...(o ? { offset: String(o) } : {}) }, { replace: true });

  const { data: targets = [] } = useTargets();
  const { data: routines = [] } = useRoutines();
  const [adding, setAdding] = useState(false);
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

  // Habits inside a routine are shown in their routine's card. Archived ones are always listed
  // (folded away), so you can open and restore them.
  const routineIds = new Set(routines.map((r) => r.id));
  const inRoutine = (t: (typeof targets)[number]) => t.routineId !== null && routineIds.has(t.routineId);
  const active = targets.filter((t) => t.active && !inRoutine(t));
  const archived = targets.filter((t) => !t.active && !inRoutine(t));
  const activeRoutines = routines.filter((r) => r.active);
  const archivedRoutines = routines.filter((r) => !r.active);
  const routineCard = (r: (typeof routines)[number]) => (
    <RoutineGoalCard
      key={r.id}
      routine={r}
      habits={targets
        .filter((t) => t.routineId === r.id && (t.active || !r.active))
        .sort((a, b) => a.routineOrder - b.routineOrder)}
      category={r.categoryId ? (catById.get(r.categoryId) ?? null) : null}
      periodBlocks={inPeriod}
      historyBlocks={blocks}
      today={now.today}
    />
  );
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
          <h1 className="text-headline-lg font-semibold">Habits</h1>
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="flex h-9 items-center gap-1 rounded-full bg-primary px-3.5 text-label-lg font-semibold text-on-primary shadow-card active:scale-95"
          >
            <Icon name="add" size={18} /> New
          </button>
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

        {active.length === 0 && activeRoutines.length === 0 ? (
          <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-border px-4 py-8 text-center">
            <Icon name="event_repeat" size={28} className="text-faint" />
            <p className="text-body-md text-muted">No habits yet. Add the first thing you want to do every week, or start from a routine.</p>
            <button type="button" onClick={() => setAdding(true)} className="mt-1 rounded-full bg-primary px-4 py-2 text-label-lg font-semibold text-on-primary">
              New
            </button>
          </div>
        ) : (
          <>
            {activeRoutines.length > 0 && (
              <>
                <ListTitle icon="event_repeat">Routines</ListTitle>
                <div className="flex flex-col gap-3">{activeRoutines.map(routineCard)}</div>
              </>
            )}
            {active.length > 0 && (
              <>
                {activeRoutines.length > 0 && <ListTitle icon="check_circle">Habits</ListTitle>}
                <div className="flex flex-col gap-3">{active.map(card)}</div>
              </>
            )}
          </>
        )}

        {archived.length + archivedRoutines.length > 0 && (
          <>
            <button
              type="button"
              onClick={() => setShowArchived((v) => !v)}
              aria-expanded={showArchived}
              className="flex items-center gap-1.5 pt-2 text-label-md font-semibold uppercase tracking-wider text-faint hover:text-muted"
            >
              <Icon name="archive" size={16} /> Archived ({archived.length + archivedRoutines.length})
              <Icon name={showArchived ? 'keyboard_arrow_up' : 'keyboard_arrow_down'} size={16} />
            </button>
            {showArchived && (
              <div className="flex flex-col gap-3">
                {archivedRoutines.map(routineCard)}
                {archived.map(card)}
              </div>
            )}
          </>
        )}
      </div>
      <NewSheet open={adding} onClose={() => setAdding(false)} />
    </Page>
  );
}

function ListTitle({ icon, children }: { icon: 'event_repeat' | 'check_circle'; children: ReactNode }) {
  return (
    <h2 className="-mb-1 flex items-center gap-1.5 pt-1 text-label-md font-semibold uppercase tracking-wider text-faint">
      <Icon name={icon} size={16} /> {children}
    </h2>
  );
}

/** "New": one habit, or a routine (blank or from a starter you then edit). */
function NewSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Sheet open={open} onClose={onClose} title="New">
      <div className="flex flex-col gap-2">
        <Link
          to="/goals/new"
          onClick={onClose}
          className="flex items-center gap-3 rounded-xl border border-border bg-surface-2 p-3 hover:border-primary"
        >
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary-ink">
            <Icon name="check_circle" size={22} />
          </span>
          <span className="flex min-w-0 flex-col">
            <span className="text-label-lg font-semibold">Habit</span>
            <span className="text-body-sm text-muted">One thing on its days: Gym, Padel, or a quick tick like Vitamin D</span>
          </span>
        </Link>
        <Link
          to="/goals/routine/new"
          onClick={onClose}
          className="flex items-center gap-3 rounded-xl border border-border bg-surface-2 p-3 hover:border-primary"
        >
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary-ink">
            <Icon name="event_repeat" size={22} />
          </span>
          <span className="flex min-w-0 flex-col">
            <span className="text-label-lg font-semibold">Routine</span>
            <span className="text-body-sm text-muted">Habits you do together, in order, like a superset</span>
          </span>
        </Link>

        <span className="mt-2 text-label-sm font-semibold uppercase tracking-wider text-faint">Start from a routine</span>
        <div className="grid gap-2 sm:grid-cols-2">
          {ROUTINE_TEMPLATES.map((t) => {
            const minutes = routineMinutes(t.habits);
            return (
              <Link
                key={t.key}
                to={`/goals/routine/new?template=${t.key}`}
                onClick={onClose}
                className="flex flex-col gap-2 rounded-xl border border-border bg-surface p-3 shadow-card hover:border-primary"
              >
                <span className="flex items-center gap-2.5">
                  <RoutineIcon icon={t.icon} category={null} size={32} />
                  <span className="flex min-w-0 flex-col">
                    <span className="text-label-lg font-semibold">{t.name}</span>
                    <span className="text-label-sm text-faint">
                      {t.habits.length} habits · {minutes ? formatDuration(minutes) : 'quick'}
                    </span>
                  </span>
                </span>
                <span className="flex flex-wrap gap-1">
                  {t.habits.map((h) => (
                    <span key={h.name} className="rounded-full bg-surface-2 px-2 py-0.5 text-label-sm text-muted">
                      {h.name}
                      <span className="text-faint"> · {habitLength(h.durationMin)}</span>
                    </span>
                  ))}
                </span>
              </Link>
            );
          })}
        </div>
        <p className="mt-1 text-label-sm text-faint">Starters are a first draft: rename, reorder, or remove anything before you save.</p>
      </div>
    </Sheet>
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

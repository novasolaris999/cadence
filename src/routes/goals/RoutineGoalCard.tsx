import { Link } from 'react-router';
import { cx } from '../../components/cx';
import { catBg } from '../../components/categoryColor';
import { NewBadge } from '../../components/NewBadge';
import { Icon } from '../../components/Icon';
import { RoutineIcon } from '../../components/RoutineParts';
import { pct, rateTier, tally, targetStreak } from '../../domain/metrics';
import { isNewTarget } from '../../domain/novelty';
import { habitLength, routineMinutes } from '../../domain/routines';
import { targetDays } from '../../domain/schedule';
import { formatDays, formatDuration, formatTime } from '../../domain/time';
import type { Block, Category, ISODate, Routine, Target } from '../../domain/types';

const TIER: Record<ReturnType<typeof rateTier>, string> = {
  good: 'bg-hit/15 text-hit-ink',
  ok: 'bg-warn/15 text-warn-ink',
  low: 'bg-miss/15 text-miss-ink',
  none: 'bg-surface-3 text-muted',
};

/**
 * A routine on the Habits tab, drawn as a superset: the routine's header (tap to edit it) over its
 * habits in order, joined by a rail. Each habit keeps its own rate and streak; tap one for its page.
 */
export function RoutineGoalCard({
  routine,
  habits,
  category,
  periodBlocks,
  historyBlocks,
  today,
}: {
  routine: Routine;
  /** In routine order. */
  habits: Target[];
  category: Category | null;
  periodBlocks: Block[];
  historyBlocks: Block[];
  today: ISODate;
}) {
  const ids = new Set(habits.map((h) => h.id));
  const all = tally(periodBlocks.filter((b) => ids.has(b.targetId ?? '')), today);
  const minutes = routineMinutes(habits);
  const isNew = routine.active && isNewTarget(routine.createdAt, today);
  return (
    <section
      className={cx(
        'relative overflow-hidden rounded-xl border border-border bg-surface shadow-card',
        !routine.active && 'opacity-70',
        isNew && 'glow-new',
      )}
    >
      <span className={cx('absolute inset-y-0 left-0 w-1', catBg(category))} aria-hidden />
      <Link to={`/goals/routine/${routine.id}`} className="flex items-center gap-3 p-3.5 pb-2 hover:bg-surface-2/60">
        <RoutineIcon icon={routine.icon} category={category} size={40} />
        <div className="min-w-0 flex-1">
          <h3 className="flex items-center gap-1.5 text-headline-sm font-semibold">
            <span className="truncate">{routine.name}</span>
            {isNew && <NewBadge />}
            {routine.protected && <Icon name="lock" size={14} className="shrink-0 text-faint" />}
          </h3>
          <p className="truncate text-label-sm text-faint">
            {formatDays(targetDays(routine), routine.frequencyPerWeek)} · {formatTime(routine.preferredStart)} · {habits.length} habit
            {habits.length === 1 ? '' : 's'}
            {minutes ? ` · ${formatDuration(minutes)}` : ''}
          </p>
        </div>
        <span className={cx('shrink-0 rounded-full px-2 py-0.5 text-label-sm font-semibold', TIER[rateTier(all.rate)])}>{pct(all.rate)}</span>
      </Link>

      <ol className="relative flex flex-col px-3.5 pb-3">
        <span className={cx('absolute top-3 bottom-6 left-[25px] w-0.5 rounded-full opacity-30', catBg(category))} aria-hidden />
        {habits.map((h, i) => {
          const t = tally(periodBlocks.filter((b) => b.targetId === h.id), today);
          const streak = targetStreak(historyBlocks.filter((b) => b.targetId === h.id), today);
          return (
            <li key={h.id}>
              <Link to={`/goals/${h.id}`} className="flex items-center gap-2.5 rounded-lg py-1.5 pr-1 hover:bg-surface-2">
                <span
                  className={cx(
                    'z-10 flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full font-mono text-label-sm font-bold text-on-primary ring-2 ring-surface',
                    catBg(category),
                  )}
                >
                  {i + 1}
                </span>
                <span className="min-w-0 flex-1 truncate text-body-md">{h.name}</span>
                <span className="shrink-0 text-label-sm text-faint">{habitLength(h.durationMin)}</span>
                {streak > 1 && (
                  <span className="flex shrink-0 items-center text-label-sm text-muted">
                    <Icon name="local_fire_department" size={13} className="text-warn" />
                    {streak}
                  </span>
                )}
                <span className={cx('w-11 shrink-0 rounded-full py-0.5 text-center text-label-sm font-semibold', TIER[rateTier(t.rate)])}>
                  {pct(t.rate)}
                </span>
              </Link>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

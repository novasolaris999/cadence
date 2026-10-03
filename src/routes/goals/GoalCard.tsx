import { Link } from 'react-router';
import { cx } from '../../components/cx';
import { catSoft } from '../../components/categoryColor';
import { Icon, isIconName } from '../../components/Icon';
import { cellsForRange, pct, rateTier, tally, targetStreak } from '../../domain/metrics';
import { targetDays } from '../../domain/schedule';
import { formatDays, formatDuration, formatTime, isoWeekday, weekdayShort, type Period } from '../../domain/time';
import type { Block, Category, ISODate, Target } from '../../domain/types';
import { HitGrid } from './HitGrid';

const TIER: Record<ReturnType<typeof rateTier>, string> = {
  good: 'bg-hit/15 text-hit-ink',
  ok: 'bg-warn/15 text-warn-ink',
  low: 'bg-miss/15 text-miss-ink',
  none: 'bg-surface-3 text-muted',
};

interface Props {
  target: Target;
  category: Category | null;
  periodBlocks: Block[];
  historyBlocks: Block[];
  period: Period;
  today: ISODate;
}

/** One goal: header, rate, hit/miss/rest grid, and streak. Tapping opens its rules. */
export function GoalCard({ target, category, periodBlocks, historyBlocks, period, today }: Props) {
  const t = tally(periodBlocks, today);
  const streak = targetStreak(historyBlocks, today);
  const days = targetDays(target);
  const next = historyBlocks.find((b) => b.status === 'planned' && b.date >= today);
  return (
    <Link
      to={`/goals/${target.id}`}
      className={cx(
        'flex flex-col gap-3 rounded-xl border border-border bg-surface p-3.5 shadow-card transition-colors hover:border-faint',
        !target.active && 'opacity-70',
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2.5">
          <div className={cx('flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-text', catSoft(category))}>
            <Icon name={isIconName(target.icon) ? target.icon : 'check_circle'} size={18} />
          </div>
          <div className="min-w-0">
            <h3 className="truncate text-headline-sm font-semibold">{target.name}</h3>
            <p className="truncate text-label-sm text-faint">
              {formatDays(days, target.frequencyPerWeek)} · {formatDuration(target.durationMin)}
              {category ? ` · ${category.name}` : ''}
            </p>
          </div>
        </div>
        <div className="flex shrink-0 flex-col items-end">
          <span className={cx('rounded-full px-2 py-0.5 text-label-sm font-semibold', TIER[rateTier(t.rate)])}>
            {pct(t.rate)}
          </span>
          <span className="mt-0.5 text-label-sm text-muted">
            {t.hits} hit{t.hits === 1 ? '' : 's'} · {t.misses} miss{t.misses === 1 ? '' : 'es'}
          </span>
        </div>
      </div>

      <HitGrid
        cells={cellsForRange(periodBlocks, period.from, period.to, today)}
        scope={period.scope}
        from={period.from}
        to={period.to}
        highlightDays={days}
      />

      <div className="flex items-center justify-between text-label-sm text-faint">
        <span className="flex items-center gap-1">
          <Icon name="local_fire_department" size={14} className={streak > 0 ? 'text-warn' : ''} />
          Streak {streak}
        </span>
        {target.protected && (
          <span className="flex items-center gap-1">
            <Icon name="lock" size={14} /> Protected
          </span>
        )}
        <span>
          {!target.active
            ? 'Archived'
            : next
              ? `Next: ${next.date === today ? 'Today' : weekdayShort(isoWeekday(next.date))} ${formatTime(next.start)}`
              : ''}
        </span>
      </div>
    </Link>
  );
}

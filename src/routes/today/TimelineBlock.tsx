import type { ReactNode } from 'react';
import { CheckButton } from '../../components/CheckButton';
import { cx } from '../../components/cx';
import { catBg } from '../../components/categoryColor';
import { Icon } from '../../components/Icon';
import { NewBadge } from '../../components/NewBadge';
import { CHECK_ROW_H, Pips, RoutineChecklist, RoutineIcon } from '../../components/RoutineParts';
import type { BlockView } from '../../components/blockView';
import { formatDuration, formatTimeRange } from '../../domain/time';
import type { Minutes } from '../../domain/types';

interface Props {
  view: BlockView;
  /** Current minute if the block is happening right now, else null. */
  nowInBlock: Minutes | null;
  /** Planned on a past day and never done. */
  missed: boolean;
  onToggle: () => void;
  /** Ticks one habit inside a routine card. */
  onToggleId: (id: string) => void;
}

/**
 * A block on the Today timeline. Its look depends on its height (duration) and state:
 * 15 min = one line; 30-45 min = title and time; 60+ min = full card;
 * happening now = progress bar and a Complete button (today-dark.html).
 */
export function TimelineBlock({ view, nowInBlock, missed, onToggle, onToggleId }: Props) {
  if (view.group) return <RoutineBlock view={view} nowInBlock={nowInBlock} missed={missed} onToggleId={onToggleId} />;
  const { block, category, title } = view;
  const done = block.status === 'done';
  const skipped = block.status === 'skipped';
  const size = block.durationMin <= 15 ? 'xs' : block.durationMin < 60 ? 'md' : 'lg';
  const isNow = nowInBlock !== null && block.status === 'planned';
  const bar = <span className={cx('w-1.5 shrink-0 self-stretch rounded-full', catBg(category))} />;
  const titleCls = cx(
    'truncate text-text',
    (done || skipped) && 'line-through opacity-60',
  );

  if (size === 'xs') {
    return (
      <Card isNow={isNow} isNew={view.isNew} className="items-center gap-2 px-2">
        <span className={cx('h-3.5 w-1.5 shrink-0 rounded-full', catBg(category))} />
        <span className={cx('flex-1 text-label-md', titleCls)}>{title}</span>
        {view.isNew && <NewBadge />}
        {missed && <span className="text-label-sm font-semibold text-miss-ink">Missed</span>}
        <span className="font-mono text-label-sm text-primary-ink">{formatDuration(block.durationMin)}</span>
        <CheckButton status={block.status} onToggle={onToggle} title={title} size={18} />
      </Card>
    );
  }

  if (size === 'md') {
    return (
      <Card isNow={isNow} isNew={view.isNew} className="items-center gap-2 p-2">
        {bar}
        <div className="flex min-w-0 flex-1 flex-col">
          <span className={cx('text-label-lg', titleCls)}>
            {title}
            {view.protected && <Icon name="lock" size={12} className="ml-1 inline align-[-1px] text-faint" />}
            {view.isNew && (
              <span className="ml-1.5 inline-block align-[1px]">
                <NewBadge />
              </span>
            )}
          </span>
          <span className={cx('font-mono text-label-sm', done ? 'text-hit-ink' : 'text-muted')}>
            {formatTimeRange(block.start, block.durationMin)} · {formatDuration(block.durationMin)}
            {missed && <span className="font-sans font-semibold text-miss-ink"> · Missed</span>}
            {skipped && <span className="font-sans"> · Skipped</span>}
          </span>
        </div>
        <CheckButton status={block.status} onToggle={onToggle} title={title} />
      </Card>
    );
  }

  const elapsed = isNow ? Math.min(block.durationMin, nowInBlock - block.start) : 0;
  return (
    <Card isNow={isNow} isNew={view.isNew} className="flex-col justify-between gap-1 p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 flex-col">
          {isNow ? (
            <span className="flex items-center gap-1.5 text-label-sm font-semibold uppercase tracking-wider text-primary-ink">
              <span className="h-2 w-2 animate-pulse rounded-full bg-primary" /> Now
            </span>
          ) : (
            <span className="flex items-center gap-1 text-label-sm font-semibold uppercase tracking-wider text-muted">
              <span className={cx('h-2 w-2 rounded-full', catBg(category))} />
              {view.protected ? 'Protected' : (category?.name ?? (view.target ? 'Habit' : 'One-off'))}
              {view.protected && <Icon name="lock" size={12} />}
              {view.isNew && <NewBadge />}
            </span>
          )}
          <h3 className={cx('mt-0.5 text-headline-md font-semibold', titleCls)}>{title}</h3>
          {block.note && <span className="truncate text-label-sm text-muted">{block.note}</span>}
        </div>
        {!isNow && <CheckButton status={block.status} onToggle={onToggle} title={title} />}
      </div>

      {isNow && block.durationMin >= 60 && (
        <div className="rounded-lg bg-surface-3/60 p-2">
          <div className="flex justify-between text-label-sm">
            <span className="font-mono text-muted">
              Elapsed {formatDuration(elapsed)} / {formatDuration(block.durationMin)}
            </span>
            <span className="font-bold text-primary-ink">{Math.round((elapsed / block.durationMin) * 100)}%</span>
          </div>
          <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-sunken">
            <div className="h-full rounded-full bg-primary" style={{ width: `${(elapsed / block.durationMin) * 100}%` }} />
          </div>
        </div>
      )}

      <div className="flex items-center justify-between gap-2">
        <span className={cx('flex items-center gap-1 font-mono text-label-sm', done ? 'text-hit-ink' : 'text-muted')}>
          <Icon name="schedule" size={14} />
          {formatTimeRange(block.start, block.durationMin)} ({formatDuration(block.durationMin)})
        </span>
        {isNow ? (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onToggle();
            }}
            className="flex items-center gap-1 rounded-full bg-primary px-3 py-1.5 text-label-sm font-semibold text-on-primary shadow-card active:scale-95"
          >
            <Icon name="check" size={16} /> Complete
          </button>
        ) : skipped ? (
          <span className="text-label-sm text-muted">Skipped</span>
        ) : missed ? (
          <span className="text-label-sm font-semibold text-miss-ink">Missed</span>
        ) : null}
      </div>
    </Card>
  );
}

function Card({ isNow, isNew, className, children }: { isNow: boolean; isNew: boolean; className: string; children: ReactNode }) {
  return (
    <div
      className={cx(
        'flex h-full w-full overflow-hidden rounded-lg shadow-card',
        isNow ? 'bg-surface-2 ring-2 ring-primary/50' : 'bg-surface-3/70',
        isNew && 'glow-new',
        className,
      )}
    >
      {children}
    </div>
  );
}

/**
 * Pixels a routine card needs: wrapper padding, card padding, the header, and one row per habit.
 * The timeline stretches the card's rows to at least this, so nothing is ever clipped.
 */
export const routineCardPx = (habits: number) => 4 + 12 + 26 + 4 + habits * CHECK_ROW_H;

/**
 * A routine on the timeline: a superset card. Header with icon, name, and one pip per habit, then
 * the habits as a checklist you can tick right there. Tap the header for the full view.
 */
function RoutineBlock({
  view,
  nowInBlock,
  missed,
  onToggleId,
}: Pick<Props, 'view' | 'nowInBlock' | 'missed' | 'onToggleId'>) {
  const { block, category, group } = view;
  const { routine, members, done } = group!;
  const isNow = nowInBlock !== null && block.status === 'planned';
  const allDone = done === members.length;
  return (
    <Card isNow={isNow} isNew={view.isNew} className="relative flex-col gap-1 py-1.5 pr-2 pl-2.5 [--ring-bg:var(--c-surface-3)]">
      {/* The left rail marks a routine: several habits in one card. */}
      <span className={cx('absolute inset-y-1.5 left-0 w-1 rounded-r-full', catBg(category))} aria-hidden />
      <div className="flex h-[26px] min-w-0 shrink-0 items-center gap-1.5">
        <RoutineIcon icon={routine.icon} category={category} size={22} />
        <span className={cx('min-w-0 flex-1 truncate text-label-lg font-semibold text-text', allDone && 'opacity-60')}>
          {routine.name}
          {view.protected && <Icon name="lock" size={12} className="ml-1 inline align-[-1px] text-faint" />}
          {view.isNew && (
            <span className="ml-1.5 inline-block align-[1px]">
              <NewBadge />
            </span>
          )}
        </span>
        <Pips blocks={members.map((m) => m.block)} category={category} />
        <span className={cx('font-mono text-label-sm font-semibold', allDone ? 'text-hit-ink' : 'text-muted')}>
          {done}/{members.length}
        </span>
      </div>
      <RoutineChecklist members={members} category={category} missed={missed} onToggleId={onToggleId} />
    </Card>
  );
}

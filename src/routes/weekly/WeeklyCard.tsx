import { CheckButton } from '../../components/CheckButton';
import { cx } from '../../components/cx';
import { catBg, catSoft } from '../../components/categoryColor';
import { Icon } from '../../components/Icon';
import { NewBadge } from '../../components/NewBadge';
import { Pips, RoutineChecklist, RoutineIcon } from '../../components/RoutineParts';
import { habitLength, isAnytime } from '../../domain/routines';
import type { BlockView } from '../../components/blockView';
import { targetDays } from '../../domain/schedule';
import { formatDays, formatTime } from '../../domain/time';

/**
 * A block in the Weekly view (weekly-light.html "pocket" card).
 * Phones: one row with check, title, recurrence badge, and time.
 * Narrow 7-column layout (fold inner screen, tablets): stacked, with the check in the corner.
 * Wide desktop (xl): back to one row.
 */
export function WeeklyCard({
  view,
  missed,
  onToggle,
  onToggleId,
  onOpen,
}: {
  view: BlockView;
  missed: boolean;
  onToggle: () => void;
  /** Ticks one habit inside a routine card. */
  onToggleId: (id: string) => void;
  onOpen: () => void;
}) {
  if (view.group) return <RoutineWeeklyCard view={view} missed={missed} onToggleId={onToggleId} onOpen={onOpen} />;
  const { block, target, category, title } = view;
  const done = block.status === 'done';
  const skipped = block.status === 'skipped';
  const end = formatTime(block.start + block.durationMin);
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && onOpen()}
      className={cx(
        'relative flex cursor-pointer items-center gap-2 rounded-xl border border-border bg-surface p-2.5 shadow-card transition-colors hover:border-faint md:block md:p-2 md:pr-7 xl:flex xl:p-2.5 xl:pr-2.5',
        view.isNew && 'glow-new',
      )}
    >
      <span className="md:absolute md:top-0.5 md:right-0.5 xl:static">
        <CheckButton status={block.status} onToggle={onToggle} title={title} size={20} />
      </span>
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex min-w-0 items-center gap-1.5">
          <span
            className={cx(
              'truncate text-label-lg font-semibold md:line-clamp-2 md:whitespace-normal md:text-label-md',
              (done || skipped) && 'text-faint line-through',
            )}
          >
            {title}
            {view.protected && <Icon name="lock" size={12} className="ml-1 hidden align-[-1px] text-faint md:inline" />}
          </span>
          {view.isNew && <NewBadge />}
          <span className={cx('shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase text-muted md:hidden', catSoft(category))}>
            {target ? (target.durationMin === 0 ? 'Quick' : formatDays(targetDays(target), target.frequencyPerWeek)) : 'One-off'}
          </span>
        </div>
        <span className="truncate text-body-sm text-muted md:whitespace-normal md:text-label-sm">
          <span className={cx('font-medium', done ? 'text-hit-ink' : missed ? 'text-miss-ink' : 'text-primary-ink')}>
            {target && isAnytime(target) ? (
              'Anytime'
            ) : (
              <>
                {formatTime(block.start)}
                <span className="md:hidden xl:inline"> – {end}</span>
              </>
            )}
          </span>
          {skipped && ' · Skipped'}
          {missed && <span className="font-semibold text-miss-ink"> · Missed</span>}
          {block.note && <span className="md:hidden"> · {block.note}</span>}
        </span>
      </div>
      <span className="text-faint md:hidden">
        {view.protected ? <Icon name="lock" size={18} title="Protected" /> : <Icon name="drag_indicator" size={18} />}
      </span>
    </div>
  );
}

/**
 * A routine in the Weekly view: header with icon, name, time, and progress pips, then its habits as a
 * short checklist joined by a rail (the superset look). Tap a habit to tick it; tap the header to open.
 */
function RoutineWeeklyCard({
  view,
  missed,
  onToggleId,
  onOpen,
}: {
  view: BlockView;
  missed: boolean;
  onToggleId: (id: string) => void;
  onOpen: () => void;
}) {
  const { block, category, group } = view;
  const { routine, members, minutes, done } = group!;
  const allDone = done === members.length;
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && onOpen()}
      className={cx(
        'relative flex cursor-pointer flex-col gap-1.5 overflow-hidden rounded-xl border border-border bg-surface p-2.5 pl-3 shadow-card transition-colors hover:border-faint md:p-2 md:pl-2.5 [--ring-bg:var(--c-surface)]',
        view.isNew && 'glow-new',
      )}
    >
      <span className={cx('absolute inset-y-0 left-0 w-1', catBg(category))} aria-hidden />
      {/* Narrow columns (768px+) give the name its own line; phones keep one row with progress pips. */}
      <div className="flex min-w-0 items-start gap-2">
        <RoutineIcon icon={routine.icon} category={category} size={28} />
        <div className="flex min-w-0 flex-1 flex-col">
          <span
            className={cx(
              'truncate text-label-lg font-semibold md:line-clamp-2 md:whitespace-normal md:text-label-md md:leading-tight',
              allDone && 'text-faint',
            )}
          >
            {routine.name}
            {view.protected && <Icon name="lock" size={12} className="ml-1 inline align-[-1px] text-faint" />}
            {view.isNew && (
              <span className="ml-1.5 inline-block align-[1px]">
                <NewBadge />
              </span>
            )}
          </span>
          <span className="flex items-center justify-between gap-1 text-body-sm md:text-label-sm">
            <span className={cx('truncate font-medium', allDone ? 'text-hit-ink' : missed ? 'text-miss-ink' : 'text-primary-ink')}>
              {formatTime(block.start)}
              <span className="font-normal text-muted md:hidden xl:inline"> · {minutes ? habitLength(minutes) : 'quick'}</span>
            </span>
            <span className={cx('hidden shrink-0 font-mono font-semibold md:inline', allDone ? 'text-hit-ink' : 'text-muted')}>
              {done}/{members.length}
            </span>
          </span>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1 md:hidden">
          <span className={cx('font-mono text-label-sm font-semibold', allDone ? 'text-hit-ink' : 'text-muted')}>
            {done}/{members.length}
          </span>
          <Pips blocks={members.map((m) => m.block)} category={category} />
        </div>
      </div>
      <RoutineChecklist members={members} category={category} missed={missed} onToggleId={onToggleId} />
    </div>
  );
}

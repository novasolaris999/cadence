import { CheckButton } from '../../components/CheckButton';
import { cx } from '../../components/cx';
import { catSoft } from '../../components/categoryColor';
import { Icon } from '../../components/Icon';
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
  onOpen,
}: {
  view: BlockView;
  missed: boolean;
  onToggle: () => void;
  onOpen: () => void;
}) {
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
      className="relative flex cursor-pointer items-center gap-2 rounded-xl border border-border bg-surface p-2.5 shadow-card transition-colors hover:border-faint md:block md:p-2 md:pr-7 xl:flex xl:p-2.5 xl:pr-2.5"
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
          <span className={cx('shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase text-muted md:hidden', catSoft(category))}>
            {target ? formatDays(targetDays(target), target.frequencyPerWeek) : 'One-off'}
          </span>
        </div>
        <span className="truncate text-body-sm text-muted md:whitespace-normal md:text-label-sm">
          <span className={cx('font-medium', done ? 'text-hit-ink' : missed ? 'text-miss-ink' : 'text-primary-ink')}>
            {formatTime(block.start)}
            <span className="md:hidden xl:inline"> – {end}</span>
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

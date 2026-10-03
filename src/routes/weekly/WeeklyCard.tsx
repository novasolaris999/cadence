import { CheckButton } from '../../components/CheckButton';
import { cx } from '../../components/cx';
import { catSoft } from '../../components/categoryColor';
import { Icon } from '../../components/Icon';
import type { BlockView } from '../../components/blockView';
import { targetDays } from '../../domain/schedule';
import { formatDays, formatTimeRange } from '../../domain/time';

/** A block in the Weekly list (weekly-light.html "pocket" card). */
export function WeeklyCard({ view, missed, onToggle }: { view: BlockView; missed: boolean; onToggle: () => void }) {
  const { block, target, category, title } = view;
  const done = block.status === 'done';
  const skipped = block.status === 'skipped';
  return (
    <div className="flex items-center gap-2 rounded-xl border border-border bg-surface p-2.5 shadow-card lg:gap-1 lg:p-2">
      <CheckButton status={block.status} onToggle={onToggle} title={title} size={20} />
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex min-w-0 items-center gap-1.5">
          <span className={cx('truncate text-label-lg font-semibold lg:line-clamp-2 lg:whitespace-normal', (done || skipped) && 'text-faint line-through')}>
            {title}
            {view.protected && <Icon name="lock" size={12} className="ml-1 hidden align-[-1px] text-faint lg:inline" />}
          </span>
          {(
            <span className={cx('shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase text-muted lg:hidden', catSoft(category))}>
              {target ? formatDays(targetDays(target), target.frequencyPerWeek) : 'One-off'}
            </span>
          )}
        </div>
        <span className="truncate text-body-sm text-muted lg:whitespace-normal">
          <span className={cx('font-medium', done ? 'text-hit-ink' : missed ? 'text-miss-ink' : 'text-primary-ink')}>
            {formatTimeRange(block.start, block.durationMin)}
          </span>
          {skipped && ' · Skipped'}
          {missed && <span className="font-semibold text-miss-ink"> · Missed</span>}
          {block.note && <span className="lg:hidden"> · {block.note}</span>}
        </span>
      </div>
      <span className="text-faint lg:hidden">
        {view.protected ? <Icon name="lock" size={18} title="Protected" /> : <Icon name="drag_indicator" size={18} />}
      </span>
    </div>
  );
}

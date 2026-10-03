import { cx } from '../../components/cx';
import { Icon } from '../../components/Icon';
import { addDays, isoWeekday, weekDates, weekdayInitial } from '../../domain/time';
import type { ISODate } from '../../domain/types';

/** Seven day chips for the selected week, with arrows to step a week back or forward. */
export function WeekStrip({
  selected,
  today,
  onSelect,
}: {
  selected: ISODate;
  today: ISODate;
  onSelect: (d: ISODate) => void;
}) {
  return (
    <div className="flex items-center gap-1">
      <StepButton label="Previous week" icon="chevron_left" onClick={() => onSelect(addDays(selected, -7))} />
      <div className="grid flex-1 grid-cols-7 gap-1.5">
        {weekDates(selected).map((d) => {
          const isSel = d === selected;
          const isToday = d === today;
          return (
            <button
              key={d}
              type="button"
              onClick={() => onSelect(d)}
              aria-current={isSel ? 'date' : undefined}
              className={cx(
                'relative flex flex-col items-center rounded-lg py-1.5 transition-colors',
                isSel ? 'bg-primary text-on-primary shadow-card' : 'bg-sunken text-muted hover:bg-surface-2',
              )}
            >
              <span className={cx('text-label-sm', isSel ? 'font-semibold' : 'text-faint')}>
                {weekdayInitial(isoWeekday(d))}
              </span>
              <span className={cx('mt-0.5 text-label-md', isSel && 'font-bold')}>{Number(d.slice(8))}</span>
              {isToday && !isSel && <span className="absolute bottom-0.5 h-1 w-1 rounded-full bg-primary" />}
            </button>
          );
        })}
      </div>
      <StepButton label="Next week" icon="chevron_right" onClick={() => onSelect(addDays(selected, 7))} />
    </div>
  );
}

function StepButton({ label, icon, onClick }: { label: string; icon: 'chevron_left' | 'chevron_right'; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} aria-label={label} className="rounded-full p-1 text-faint hover:bg-surface-2 hover:text-text">
      <Icon name={icon} size={20} />
    </button>
  );
}

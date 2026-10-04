import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { withBack } from '../domain/navigation';
import { ROUTINE_TEMPLATES, habitLength, routineMinutes } from '../domain/routines';
import { formatDuration } from '../domain/time';
import { Icon, type IconName } from './Icon';
import { RoutineIcon } from './RoutineParts';
import { Sheet } from './Sheet';

/**
 * "What are you adding?": the + on Today and Weekly, and New on Habits. Habit and Routine open their
 * forms (returning to `back` after saving); To-do and One-off open their sheets right here.
 */
export function NewSheet({
  open,
  onClose,
  title = 'New',
  back,
  onTodo,
  onBlock,
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
  /** Where the habit and routine forms return after saving (the screen you came from). */
  back?: string;
  onTodo?: () => void;
  onBlock?: () => void;
}) {
  return (
    <Sheet open={open} onClose={onClose} title={title}>
      <div className="flex flex-col gap-2">
        <Option to={withBack('/goals/new', back)} onClose={onClose} icon="check_circle" title="Habit">
          One thing on its days: Gym, Padel, or a quick tick like Vitamin D
        </Option>
        <Option to={withBack('/goals/routine/new', back)} onClose={onClose} icon="event_repeat" title="Routine">
          Habits you do together, in order, like a superset
        </Option>
        {onTodo && (
          <Option
            onClick={() => {
              onClose();
              onTodo();
            }}
            icon="checklist"
            title="To-do"
          >
            Something to get done once: a purchase, an errand, a call
          </Option>
        )}
        {onBlock && (
          <Option
            onClick={() => {
              onClose();
              onBlock();
            }}
            icon="event"
            title="One-off block"
          >
            Time for something on this day only, like a dentist visit
          </Option>
        )}

        <span className="mt-2 text-label-sm font-semibold uppercase tracking-wider text-faint">Start from a routine</span>
        <div className="grid gap-2 sm:grid-cols-2">
          {ROUTINE_TEMPLATES.map((t) => {
            const minutes = routineMinutes(t.habits);
            return (
              <Link
                key={t.key}
                to={withBack(`/goals/routine/new?template=${t.key}`, back)}
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

const optionCls = 'flex w-full items-center gap-3 rounded-xl border border-border bg-surface-2 p-3 text-left hover:border-primary';

/** One choice: a link to a form, or a button that opens a sheet. */
function Option({
  to,
  onClose,
  onClick,
  icon,
  title,
  children,
}: {
  to?: string;
  onClose?: () => void;
  onClick?: () => void;
  icon: IconName;
  title: string;
  children: ReactNode;
}) {
  const body = (
    <>
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary-ink">
        <Icon name={icon} size={22} />
      </span>
      <span className="flex min-w-0 flex-col">
        <span className="text-label-lg font-semibold">{title}</span>
        <span className="text-body-sm text-muted">{children}</span>
      </span>
    </>
  );
  return to ? (
    <Link to={to} onClick={onClose} className={optionCls}>
      {body}
    </Link>
  ) : (
    <button type="button" onClick={onClick} className={optionCls}>
      {body}
    </button>
  );
}

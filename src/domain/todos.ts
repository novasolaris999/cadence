// To-do rules: which to-dos belong to a day, rollover, ordering, and labels. Pure functions.
//
// Rollover is derived when the screen is drawn: an unfinished to-do from an earlier day shows on
// today's list ("from Mon"). Its stored day is never rewritten, so nothing changes until you act on it.

import { addDays, daysBetween, formatDayShort, formatTime, isoWeekday, weekdayShort } from './time';
import type { ISODate, Todo } from './types';

export const isDone = (t: Pick<Todo, 'completedAt'>) => t.completedAt !== null;

/** Still to do, and planned for a day before today. */
export const isOverdue = (t: Todo, today: ISODate) => !isDone(t) && t.dueDate !== null && t.dueDate < today;

export interface DayTodos {
  /** Have a time on this day: drawn on the timeline. */
  timed: Todo[];
  /** No time (or rolled over from an earlier day): the day's To-dos checklist. */
  untimed: Todo[];
}

/**
 * The to-dos that belong to `date`. Today also collects every unfinished to-do from earlier days
 * (rolled over); a rolled-over timed to-do joins the checklist, since its time has passed.
 * Other days show exactly what was planned for them, done or not.
 */
export function todosForDay(todos: Todo[], date: ISODate, today: ISODate): DayTodos {
  const timed: Todo[] = [];
  const untimed: Todo[] = [];
  for (const t of todos) {
    if (t.dueDate === date) (t.dueTime !== null ? timed : untimed).push(t);
    else if (date === today && isOverdue(t, today)) untimed.push(t);
  }
  return { timed: timed.sort((a, b) => a.dueTime! - b.dueTime!), untimed: sortTodos(untimed) };
}

/**
 * List order: open first (rolled over oldest first, then by day and time, then undated in the order you
 * added them), done last (most recently done first). Within a group, starred ones lead.
 */
export function sortTodos(todos: Todo[]): Todo[] {
  const rank = (t: Todo) => (isDone(t) ? 2 : t.dueDate === null ? 1 : 0);
  return [...todos].sort((a, b) => {
    if (rank(a) !== rank(b)) return rank(a) - rank(b);
    if (isDone(a)) return (b.completedAt ?? '').localeCompare(a.completedAt ?? '');
    if (a.starred !== b.starred) return a.starred ? -1 : 1;
    if (a.dueDate !== b.dueDate) return (a.dueDate ?? '').localeCompare(b.dueDate ?? '');
    if ((a.dueTime ?? -1) !== (b.dueTime ?? -1)) return (a.dueTime ?? -1) - (b.dueTime ?? -1);
    return a.sortOrder - b.sortOrder || (a.createdAt ?? '').localeCompare(b.createdAt ?? '');
  });
}

/** The Priority view: every starred to-do still to do, across lists. */
export const priorityTodos = (todos: Todo[]) => sortTodos(todos.filter((t) => t.starred && !isDone(t)));

/** "Today", "Tomorrow", "Sat", "Oct 12", or "From Mon" when rolled over; plus the time when set. */
export function dueLabel(t: Todo, today: ISODate): string | null {
  if (t.dueDate === null) return null;
  const time = t.dueTime !== null ? ` ${formatTime(t.dueTime)}` : '';
  if (isOverdue(t, today)) {
    const ago = daysBetween(t.dueDate, today);
    return `From ${ago < 7 ? weekdayShort(isoWeekday(t.dueDate)) : formatDayShort(t.dueDate)}`;
  }
  if (t.dueDate === today) return `Today${time}`;
  if (t.dueDate === addDays(today, 1)) return `Tomorrow${time}`;
  const ahead = daysBetween(today, t.dueDate);
  if (ahead > 1 && ahead < 7) return `${weekdayShort(isoWeekday(t.dueDate))}${time}`;
  return `${formatDayShort(t.dueDate)}${time}`;
}

/** Quick picks for a to-do's day: today, tomorrow, and the coming Saturday (or next week's, if today is the weekend). */
export function dayChoices(today: ISODate): { label: string; date: ISODate }[] {
  const w = isoWeekday(today);
  const saturday = addDays(today, w <= 5 ? 6 - w : 13 - w);
  return [
    { label: 'Today', date: today },
    { label: 'Tomorrow', date: addDays(today, 1) },
    { label: w <= 5 ? 'Saturday' : 'Next Sat', date: saturday },
  ];
}

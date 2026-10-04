import { describe, expect, it } from 'vitest';
import { dayChoices, dueLabel, isOverdue, priorityTodos, sortTodos, todosForDay } from './todos';
import type { Todo } from './types';

const TODAY = '2026-10-07'; // Wednesday
let n = 0;
const todo = (p: Partial<Todo> = {}): Todo => ({
  id: `t${++n}`,
  listId: 'l1',
  title: 'Milk',
  note: null,
  starred: false,
  dueDate: null,
  dueTime: null,
  durationMin: null,
  completedAt: null,
  sortOrder: 0,
  createdAt: `2026-10-0${(n % 9) + 1}T10:00:00Z`,
  ...p,
});

describe('todosForDay', () => {
  it('puts timed to-dos on the timeline and the rest in the checklist', () => {
    const coffee = todo({ dueDate: TODAY, dueTime: 600, durationMin: 60 });
    const milk = todo({ dueDate: TODAY });
    const later = todo({ dueDate: '2026-10-09' });
    expect(todosForDay([coffee, milk, later], TODAY, TODAY)).toEqual({ timed: [coffee], untimed: [milk] });
  });

  it('rolls unfinished to-dos from earlier days over to today, timed ones into the checklist', () => {
    const monday = todo({ dueDate: '2026-10-05' });
    const mondayTimed = todo({ dueDate: '2026-10-05', dueTime: 540, durationMin: 30 });
    const doneMonday = todo({ dueDate: '2026-10-05', completedAt: '2026-10-05T09:00' });
    const day = todosForDay([monday, mondayTimed, doneMonday], TODAY, TODAY);
    expect(day.timed).toEqual([]);
    expect(day.untimed.map((t) => t.id)).toEqual([monday.id, mondayTimed.id].sort((a, b) => (a < b ? -1 : 1)));
  });

  it('shows other days exactly as planned, done or not, with no rollover', () => {
    const doneMonday = todo({ dueDate: '2026-10-05', completedAt: '2026-10-05T09:00' });
    const openSunday = todo({ dueDate: '2026-10-04' });
    expect(todosForDay([doneMonday, openSunday], '2026-10-05', TODAY).untimed).toEqual([doneMonday]);
  });
});

describe('sortTodos', () => {
  it('puts open before done, rolled-over and dated before someday, and stars first within a group', () => {
    const someday = todo({ title: 'someday' });
    const star = todo({ title: 'star', starred: true });
    const overdue = todo({ title: 'overdue', dueDate: '2026-10-01' });
    const tomorrow = todo({ title: 'tomorrow', dueDate: '2026-10-08' });
    const done = todo({ title: 'done', completedAt: '2026-10-07T08:00' });
    expect(sortTodos([done, someday, tomorrow, star, overdue]).map((t) => t.title)).toEqual([
      'overdue',
      'tomorrow',
      'star',
      'someday',
      'done',
    ]);
  });
});

describe('priorityTodos', () => {
  it('collects starred to-dos still to do, from every list', () => {
    const a = todo({ starred: true, listId: 'shop' });
    const b = todo({ starred: true, listId: 'errands' });
    const doneStar = todo({ starred: true, completedAt: '2026-10-06T10:00' });
    expect(priorityTodos([a, b, doneStar, todo()]).map((t) => t.id).sort()).toEqual([a.id, b.id].sort());
  });
});

describe('dueLabel', () => {
  it('names the day plainly, with the time when set', () => {
    expect(dueLabel(todo(), TODAY)).toBeNull();
    expect(dueLabel(todo({ dueDate: TODAY }), TODAY)).toBe('Today');
    expect(dueLabel(todo({ dueDate: '2026-10-08', dueTime: 600, durationMin: 60 }), TODAY)).toBe('Tomorrow 10:00');
    expect(dueLabel(todo({ dueDate: '2026-10-10' }), TODAY)).toBe('Sat');
    expect(dueLabel(todo({ dueDate: '2026-10-20' }), TODAY)).toBe('Tue, Oct 20');
    expect(dueLabel(todo({ dueDate: '2026-10-05' }), TODAY)).toBe('From Mon');
  });
  it('does not call a finished to-do rolled over', () => {
    const done = todo({ dueDate: '2026-10-05', completedAt: '2026-10-05T09:00' });
    expect(isOverdue(done, TODAY)).toBe(false);
  });
});

describe('dayChoices', () => {
  it('offers today, tomorrow, and the coming Saturday', () => {
    expect(dayChoices(TODAY).map((c) => c.date)).toEqual(['2026-10-07', '2026-10-08', '2026-10-10']);
    expect(dayChoices('2026-10-10').map((c) => [c.label, c.date])[2]).toEqual(['Next Sat', '2026-10-17']);
  });
});

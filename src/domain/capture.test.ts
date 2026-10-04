import { describe, expect, it } from 'vitest';
import { buildBlock, buildHabit, buildRoutine, buildTodo, readDate, readDays, readProposal, readProposals, readTime, type CaptureContext } from './capture';
import type { Routine } from './types';

const morning: Routine = {
  id: 'r1', categoryId: 'c-health', name: 'Morning routine', icon: null, frequencyPerWeek: 5,
  preferredDays: [1, 2, 3, 4, 5], preferredStart: 7 * 60, protected: false, active: true, createdAt: null,
};
const ctx: CaptureContext = {
  lists: [
    { id: 'l-shop', name: 'Shopping', icon: 'shopping_cart', sortOrder: 0 },
    { id: 'l-err', name: 'Errands', icon: 'directions_car', sortOrder: 1 },
  ],
  categories: [{ id: 'c-health', name: 'Health', color: 'cat-1', sortOrder: 0 }],
  routines: [morning],
};

describe('reading values', () => {
  it('accepts only real dates', () => {
    expect(readDate('2026-10-07')).toBe('2026-10-07');
    expect(readDate('2026-02-30')).toBeNull();
    expect(readDate('10/07/2026')).toBeNull();
    expect(readDate(null)).toBeNull();
  });
  it('reads times onto the 15-minute grid', () => {
    expect(readTime('09:00')).toBe(540);
    expect(readTime('7:08')).toBe(7 * 60 + 15);
    expect(readTime('23:58')).toBe(23 * 60 + 45);
    expect(readTime('25:00')).toBeNull();
    expect(readTime('9am')).toBeNull();
  });
  it('keeps valid weekdays once, in order', () => {
    expect(readDays([5, 1, 1, 9, 0, 3.5, 7])).toEqual([1, 5, 7]);
    expect(readDays('daily')).toEqual([]);
  });
});

describe('readProposal', () => {
  it('reads a to-do and matches its list by name', () => {
    const p = readProposal('add_todo', { title: '  Oat  milk ', list: 'shopping', due_date: null, due_time: '10:00', duration_min: null, starred: false, note: null }, ctx);
    expect(p).toEqual({ kind: 'todo', title: 'Oat milk', listId: 'l-shop', dueDate: null, dueTime: null, durationMin: null, starred: false, note: null });
  });
  it('gives a timed to-do a length, and puts an unknown list into the first list', () => {
    const p = readProposal('add_todo', { title: 'Post office', list: 'Chores', due_date: '2026-10-08', due_time: '13:00', duration_min: 20, starred: true, note: 'parcel' }, ctx);
    expect(p).toMatchObject({ listId: 'l-shop', dueDate: '2026-10-08', dueTime: 780, durationMin: 15, starred: true, note: 'parcel' });
  });
  it('reads a timed habit, and a quick one as Anytime', () => {
    expect(readProposal('add_habit', { name: 'Gym', days: [1, 3, 5], times_per_week: null, start_time: '18:00', duration_min: 60, category: 'Health', routine: null }, ctx)).toEqual({
      kind: 'habit', name: 'Gym', days: [1, 3, 5], timesPerWeek: 3, start: 1080, durationMin: 60, categoryId: 'c-health', routineId: null,
    });
    expect(readProposal('add_habit', { name: 'Water', days: [], times_per_week: 7, start_time: '09:00', duration_min: 0, category: null, routine: null }, ctx)).toMatchObject({
      days: [], timesPerWeek: 7, start: null, durationMin: 0,
    });
  });
  it('drops habits Claude should have asked about', () => {
    expect(readProposal('add_habit', { name: 'Read', days: [], times_per_week: null, start_time: '21:00', duration_min: 30, category: null, routine: null }, ctx)).toBeNull();
    expect(readProposal('add_habit', { name: 'Read', days: [1], times_per_week: null, start_time: null, duration_min: 30, category: null, routine: null }, ctx)).toBeNull();
  });
  it('puts a habit into an existing routine with the routine schedule and 5-minute steps', () => {
    expect(readProposal('add_habit', { name: 'Vitamin D', days: [6], times_per_week: null, start_time: '12:00', duration_min: 7, category: null, routine: 'morning ROUTINE' }, ctx)).toEqual({
      kind: 'habit', name: 'Vitamin D', days: [1, 2, 3, 4, 5], timesPerWeek: 5, start: null, durationMin: 5, categoryId: null, routineId: 'r1',
    });
  });
  it('reads a routine and needs days, a time, and habits', () => {
    expect(readProposal('add_routine', { name: 'Evening', days: [1, 2, 3, 4, 5, 6, 7], start_time: '21:30', category: null, habits: [{ name: 'Stretch', duration_min: 10 }, { name: '', duration_min: 5 }] }, ctx)).toEqual({
      kind: 'routine', name: 'Evening', days: [1, 2, 3, 4, 5, 6, 7], start: 1290, categoryId: null, habits: [{ name: 'Stretch', durationMin: 10 }],
    });
    expect(readProposal('add_routine', { name: 'Evening', days: [], start_time: '21:30', category: null, habits: [{ name: 'Stretch', duration_min: 10 }] }, ctx)).toBeNull();
  });
  it('reads a one-off block and keeps it inside the day', () => {
    expect(readProposal('add_block', { title: 'Dentist', date: '2026-10-13', start_time: '15:00', duration_min: null, category: null, note: null }, ctx)).toMatchObject({ start: 900, durationMin: 60 });
    expect(readProposal('add_block', { title: 'Late', date: '2026-10-13', start_time: '23:30', duration_min: 120, category: null, note: null }, ctx)).toMatchObject({ durationMin: 30 });
    expect(readProposal('add_block', { title: 'Dentist', date: 'Tuesday', start_time: '15:00', duration_min: 60, category: null, note: null }, ctx)).toBeNull();
  });
  it('ignores unknown tools and counts what it drops', () => {
    const r = readProposals({ actions: [{ tool: 'delete_everything', input: {} }, { tool: 'add_todo', input: { title: 'Milk' } }, { tool: 'add_todo', input: {} }] }, ctx);
    expect(r.proposals).toHaveLength(1);
    expect(r.dropped).toBe(2);
  });
});

describe('building records', () => {
  it('builds a to-do', () => {
    const p = readProposal('add_todo', { title: 'Milk', list: 'Shopping' }, ctx);
    expect(buildTodo(p as never, 'id1', 'now')).toMatchObject({ id: 'id1', listId: 'l-shop', title: 'Milk', completedAt: null, dueTime: null, durationMin: null });
  });
  it('builds a habit on its own, and one placed last in a routine', () => {
    const own = readProposal('add_habit', { name: 'Gym', days: [1, 3, 5], start_time: '18:00', duration_min: 60 }, ctx);
    expect(buildHabit(own as never, 'h1', 'now', null, 0)).toMatchObject({ preferredDays: [1, 3, 5], frequencyPerWeek: 3, preferredStart: 1080, routineId: null, icon: 'check_circle' });
    const joined = readProposal('add_habit', { name: 'Vitamin D', duration_min: 0, routine: 'Morning routine' }, ctx);
    expect(buildHabit(joined as never, 'h2', 'now', morning, 4)).toMatchObject({
      routineId: 'r1', routineOrder: 4, preferredDays: [1, 2, 3, 4, 5], preferredStart: 420, frequencyPerWeek: 5, categoryId: 'c-health',
    });
  });
  it('builds a routine with its habits in order', () => {
    let n = 0;
    const p = readProposal('add_routine', { name: 'Evening', days: [1, 3], start_time: '21:30', habits: [{ name: 'Stretch', duration_min: 10 }, { name: 'Read', duration_min: 20 }] }, ctx);
    const { routine, habits } = buildRoutine(p as never, () => `id${++n}`, 'now');
    expect(routine).toMatchObject({ id: 'id1', frequencyPerWeek: 2, preferredDays: [1, 3], preferredStart: 1290 });
    expect(habits.map((h) => [h.id, h.name, h.routineId, h.routineOrder, h.preferredStart])).toEqual([
      ['id2', 'Stretch', 'id1', 0, 1290],
      ['id3', 'Read', 'id1', 1, 1290],
    ]);
  });
  it('builds a one-off block', () => {
    const p = readProposal('add_block', { title: 'Dentist', date: '2026-10-13', start_time: '15:00', duration_min: 45 }, ctx);
    expect(buildBlock(p as never, 'b1')).toMatchObject({ id: 'b1', targetId: null, date: '2026-10-13', start: 900, durationMin: 45, status: 'planned', origin: 'manual' });
  });
});

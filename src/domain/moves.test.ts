import { describe, expect, it } from 'vitest';
import { clampStart, planMove, siblingsInScope } from './moves';
import { block, target } from './test-helpers';

// Week of Mon 2026-09-28 .. Sun 2026-10-04, next week starts 2026-10-05.
const gym = target({ id: 't1', preferredStart: 690, windowEnd: 840 }); // 11:30, window to 14:00
const wed = block({ id: 'wed', date: '2026-09-30', start: 690 });
const mon = block({ id: 'mon', date: '2026-09-28', start: 690 });
const fri = block({ id: 'fri', date: '2026-10-02', start: 690 });
const friDone = block({ id: 'friDone', date: '2026-10-02', start: 690, status: 'done', targetId: 't1' });
const nextMon = block({ id: 'nextMon', date: '2026-10-05', start: 690 });
const movedDay = block({ id: 'movedDay', date: '2026-10-08', scheduledFor: '2026-10-07', start: 690, moved: true });
const other = block({ id: 'other', date: '2026-10-02', start: 690, targetId: 't2' });
const all = [mon, wed, fri, friDone, nextMon, movedDay, other];

describe('siblingsInScope', () => {
  it('week: later planned blocks of the same target in the same week', () => {
    expect(siblingsInScope(wed, all, 'week').map((b) => b.id)).toEqual(['fri']);
  });
  it('future: every later planned block of the same target', () => {
    expect(siblingsInScope(wed, all, 'future').map((b) => b.id)).toEqual(['fri', 'nextMon', 'movedDay']);
  });
  it('day: nothing else', () => {
    expect(siblingsInScope(wed, all, 'day')).toEqual([]);
  });
});

describe('planMove', () => {
  it('moves only this block for day scope and marks it moved', () => {
    expect(planMove(wed, 750, 'day', all, gym)).toEqual({ blocks: [{ id: 'wed', start: 750, moved: true }] });
  });

  it('moves the rest of the week for week scope', () => {
    expect(planMove(wed, 750, 'week', all, gym).blocks.map((b) => b.id)).toEqual(['wed', 'fri']);
  });

  it('shifts the target and keeps day-moved blocks marked for future scope', () => {
    const plan = planMove(wed, 750, 'future', all, gym);
    expect(plan.target).toEqual({ id: 't1', preferredStart: 750, windowEnd: 900 });
    expect(plan.blocks).toEqual([
      { id: 'wed', start: 750, moved: false },
      { id: 'fri', start: 750, moved: false },
      { id: 'nextMon', start: 750, moved: false },
      { id: 'movedDay', start: 750, moved: true },
    ]);
  });

  it('treats one-off blocks as day scope', () => {
    const oneOff = block({ id: 'x', date: '2026-09-30', targetId: null, title: 'Dentist' });
    expect(planMove(oneOff, 600, 'future', all, null)).toEqual({ blocks: [{ id: 'x', start: 600, moved: true }] });
  });

  it('keeps blocks inside the day', () => {
    expect(clampStart(1430, 60)).toBe(1380);
    expect(clampStart(-30, 60)).toBe(0);
  });
});

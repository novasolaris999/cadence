import { describe, expect, it } from 'vitest';
import { canMoveRoutineWeekly, canMoveWeekly, clampStart, planDayMove, planGroupDayMove, planGroupMove, planMove, siblingsInScope } from './moves';
import { block, routine, target } from './test-helpers';

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
    expect(plan.targets).toEqual([{ id: 't1', preferredStart: 750, windowEnd: 900 }]);
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

describe('planDayMove', () => {
  // Gym Mon/Wed/Fri at 18:00. Week of Mon 2026-10-05.
  const gymMWF = target({ id: 't1', preferredDays: [1, 3, 5], frequencyPerWeek: 3, preferredStart: 1080 });
  const wedGym = block({ id: 'w', date: '2026-10-07', start: 1080 });
  const thu = '2026-10-08';

  it('once: moves only this block and marks it moved', () => {
    expect(planDayMove(wedGym, thu, 'once', gymMWF, [wedGym])).toEqual({
      block: { id: 'w', date: thu, scheduledFor: '2026-10-07', moved: true },
    });
  });

  it('once: dragging a block back to its own day and time clears the moved mark', () => {
    const away = { ...wedGym, date: thu, moved: true };
    expect(planDayMove(away, '2026-10-07', 'once', gymMWF, [away]).block.moved).toBe(false);
  });

  it('weekly: swaps the day in the target and the block takes the new slot', () => {
    expect(planDayMove(wedGym, thu, 'weekly', gymMWF, [wedGym])).toEqual({
      block: { id: 'w', date: thu, scheduledFor: thu, moved: false },
      target: { id: 't1', preferredDays: [1, 4, 5], frequencyPerWeek: 3 },
    });
  });

  it('weekly: turns a spread target (no picked days) into picked days', () => {
    const spread = target({ id: 't1', preferredDays: [], frequencyPerWeek: 3, preferredStart: 1080 });
    expect(planDayMove(wedGym, thu, 'weekly', spread, [wedGym]).target?.preferredDays).toEqual([1, 4, 5]);
  });

  it('weekly: keeps the moved mark when the time was also changed by hand', () => {
    const late = { ...wedGym, start: 1140, moved: true };
    expect(planDayMove(late, thu, 'weekly', gymMWF, [late]).block.moved).toBe(true);
  });

  it('weekly: if the new day slot is already held, the block keeps its slot and stays moved', () => {
    const thuDone = block({ id: 'td', date: thu, scheduledFor: thu, status: 'done' });
    const plan = planDayMove(wedGym, thu, 'weekly', gymMWF, [wedGym, thuDone]);
    expect(plan.block).toEqual({ id: 'w', date: thu, scheduledFor: '2026-10-07', moved: true });
    expect(plan.target?.preferredDays).toEqual([1, 4, 5]);
  });

  it('weekly is not offered onto a day the target already uses, for one-offs, or for finished blocks', () => {
    expect(canMoveWeekly(wedGym, '2026-10-09', gymMWF)).toBe(false); // Friday is already a gym day
    expect(canMoveWeekly({ ...wedGym, targetId: null }, thu, null)).toBe(false);
    expect(canMoveWeekly({ ...wedGym, status: 'done' }, thu, gymMWF)).toBe(false);
    expect(canMoveWeekly(wedGym, thu, gymMWF)).toBe(true);
    // Falls back to 'once' when weekly is not possible.
    expect(planDayMove(wedGym, '2026-10-09', 'weekly', gymMWF, [wedGym]).target).toBeUndefined();
  });
});

describe('routine card moves', () => {
  // Sleep routine Mon/Wed/Fri 22:00 with two habits. Week of Mon 2026-10-05.
  const sleep = routine({ id: 'sleep', preferredDays: [1, 3, 5], frequencyPerWeek: 3, preferredStart: 1320 });
  const teeth = target({ id: 'teeth', routineId: 'sleep', durationMin: 0, preferredDays: [1, 3, 5], frequencyPerWeek: 3, preferredStart: 1320 });
  const read = target({ id: 'read', routineId: 'sleep', durationMin: 20, preferredDays: [1, 3, 5], frequencyPerWeek: 3, preferredStart: 1320 });
  const wedT = block({ id: 'wt', targetId: 'teeth', date: '2026-10-07', start: 1320, durationMin: 0 });
  const wedR = block({ id: 'wr', targetId: 'read', date: '2026-10-07', start: 1320, durationMin: 20 });
  const friT = block({ id: 'ft', targetId: 'teeth', date: '2026-10-09', start: 1320, durationMin: 0 });
  const friR = block({ id: 'fr', targetId: 'read', date: '2026-10-09', start: 1320, durationMin: 20 });
  const all = [wedT, wedR, friT, friR];

  it('moves every habit in the card for one day', () => {
    expect(planGroupMove([wedT, wedR], 1290, 'day', all, [teeth, read], sleep)).toEqual({
      blocks: [
        { id: 'wt', start: 1290, moved: true },
        { id: 'wr', start: 1290, moved: true },
      ],
    });
  });

  it('rest of week moves later cards of the routine too, once each', () => {
    expect(planGroupMove([wedT, wedR], 1290, 'week', all, [teeth, read], sleep).blocks.map((b) => b.id)).toEqual(['wt', 'ft', 'wr', 'fr']);
  });

  it('all future moves the routine start and every habit', () => {
    const plan = planGroupMove([wedT, wedR], 1290, 'future', all, [teeth, read], sleep);
    expect(plan.routine).toEqual({ id: 'sleep', preferredStart: 1290 });
    expect(plan.targets?.map((t) => [t.id, t.preferredStart])).toEqual([
      ['teeth', 1290],
      ['read', 1290],
    ]);
  });

  it('moves a card to another day every week by changing the routine days', () => {
    const plan = planGroupDayMove([wedT, wedR], '2026-10-08', 'weekly', [teeth, read], sleep, all);
    expect(plan.routine).toEqual({ id: 'sleep', preferredDays: [1, 4, 5], frequencyPerWeek: 3 });
    expect(plan.blocks).toEqual([
      { id: 'wt', date: '2026-10-08', scheduledFor: '2026-10-08', moved: false },
      { id: 'wr', date: '2026-10-08', scheduledFor: '2026-10-08', moved: false },
    ]);
  });

  it('moves only this week when the routine already runs on the new day', () => {
    expect(canMoveRoutineWeekly([wedT, wedR], '2026-10-09', sleep)).toBe(false);
    const plan = planGroupDayMove([wedT, wedR], '2026-10-09', 'weekly', [teeth, read], sleep, all);
    expect(plan.routine).toBeUndefined();
    expect(plan.blocks.every((b) => b.moved && b.date === '2026-10-09')).toBe(true);
  });
});

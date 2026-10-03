import { describe, expect, it } from 'vitest';
import { groupByRoutine, isAnytime, routineMinutes, routineSpan, withRoutine } from './routines';
import { planFill } from './schedule';
import { block, routine, target } from './test-helpers';

const sleep = routine({ id: 'sleep', preferredDays: [1, 2, 3, 4, 5], frequencyPerWeek: 5, preferredStart: 22 * 60, protected: true });

describe('withRoutine', () => {
  it('copies the routine schedule onto the habit and keeps its own name, length, and category', () => {
    const teeth = target({ id: 'teeth', name: 'Brush teeth', durationMin: 0, categoryId: 'c9', preferredStart: 7 * 60, windowEnd: 8 * 60 });
    expect(withRoutine(teeth, sleep, 2)).toMatchObject({
      name: 'Brush teeth',
      durationMin: 0,
      categoryId: 'c9',
      routineId: 'sleep',
      routineOrder: 2,
      preferredDays: [1, 2, 3, 4, 5],
      frequencyPerWeek: 5,
      preferredStart: 22 * 60,
      windowEnd: null,
      protected: true,
      active: true,
    });
  });
});

describe('routine length', () => {
  it('adds up habit minutes, quick ones count zero', () => {
    expect(routineMinutes([{ durationMin: 0 }, { durationMin: 10 }, { durationMin: 15 }])).toBe(25);
  });
  it('rounds up to the 15-minute grid, at least one slot', () => {
    expect(routineSpan(0)).toBe(15);
    expect(routineSpan(25)).toBe(30);
    expect(routineSpan(30)).toBe(30);
  });
});

describe('isAnytime', () => {
  it('is a quick habit outside any routine', () => {
    expect(isAnytime({ durationMin: 0, routineId: null })).toBe(true);
    expect(isAnytime({ durationMin: 0, routineId: 'r' })).toBe(false);
    expect(isAnytime({ durationMin: 15, routineId: null })).toBe(false);
  });
});

describe('groupByRoutine', () => {
  const teeth = target({ id: 'teeth', routineId: 'sleep', routineOrder: 0 });
  const read = target({ id: 'read', routineId: 'sleep', routineOrder: 1 });
  const gym = target({ id: 'gym' });
  const day = '2026-10-05';

  it('draws a routine’s blocks on one day as one card, in routine order', () => {
    const r = block({ id: 'r', targetId: 'read', date: day, start: 1320 });
    const t = block({ id: 't', targetId: 'teeth', date: day, start: 1320 });
    const g = block({ id: 'g', targetId: 'gym', date: day, start: 600 });
    const items = groupByRoutine([g, r, t], [teeth, read, gym], new Set(['sleep']));
    expect(items.map((i) => (i.kind === 'block' ? i.block.id : i.group.blocks.map((b) => b.id).join('+')))).toEqual(['g', 't+r']);
  });

  it('shows a habit block moved to another time on its own', () => {
    const r = block({ id: 'r', targetId: 'read', date: day, start: 1350 });
    const t = block({ id: 't', targetId: 'teeth', date: day, start: 1320 });
    expect(groupByRoutine([t, r], [teeth, read], new Set(['sleep']))).toHaveLength(2);
  });

  it('shows blocks of an unknown routine on their own', () => {
    const t = block({ id: 't', targetId: 'teeth', date: day });
    expect(groupByRoutine([t], [teeth], new Set())[0]!.kind).toBe('block');
  });
});

describe('anytime habits in planFill', () => {
  it('creates today’s slot even late in the day, because it has no time', () => {
    const water = target({ id: 'water', durationMin: 0, preferredStart: 0, preferredDays: [1, 2, 3, 4, 5, 6, 7], frequencyPerWeek: 7 });
    const ctx = { today: '2026-10-07', nowMin: 20 * 60, newId: () => 'x' };
    expect(planFill([water], '2026-10-05', [], ctx).map((b) => b.date)).toEqual([
      '2026-10-07',
      '2026-10-08',
      '2026-10-09',
      '2026-10-10',
      '2026-10-11',
    ]);
  });
});

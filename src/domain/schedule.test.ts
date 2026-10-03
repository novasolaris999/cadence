import { describe, expect, it } from 'vitest';
import { planFill, planTargetReplan, targetDays } from './schedule';
import { block, target } from './test-helpers';

describe('targetDays', () => {
  it('uses preferred days when set, sorted', () => {
    expect(targetDays({ preferredDays: [5, 1, 3], frequencyPerWeek: 3 })).toEqual([1, 3, 5]);
  });

  it('spreads frequency across the week when no days are set', () => {
    expect(targetDays({ preferredDays: [], frequencyPerWeek: 3 })).toEqual([1, 3, 5]);
    expect(targetDays({ preferredDays: [], frequencyPerWeek: 2 })).toEqual([2, 4]);
    expect(targetDays({ preferredDays: [], frequencyPerWeek: 7 })).toHaveLength(7);
  });
});

describe('planFill', () => {
  // Week of Mon 2026-10-05. "Today" is Wednesday 2026-10-07 at 12:00.
  const WEEK = '2026-10-05';
  let n = 0;
  const ctx = { today: '2026-10-07', nowMin: 12 * 60, newId: () => `new${++n}` };
  const gym = target({ id: 'gym', preferredDays: [1, 3, 5], frequencyPerWeek: 3, preferredStart: 18 * 60, durationMin: 60 });
  const meds = target({ id: 'meds', preferredDays: [1, 2, 3, 4, 5, 6, 7], frequencyPerWeek: 7, preferredStart: 7 * 60 + 30, durationMin: 15 });

  it('creates only upcoming slots: no instant misses when starting mid-week', () => {
    const out = planFill([gym, meds], WEEK, [], ctx);
    // gym: Wed 18:00 (later today) and Fri; meds: Thu-Sun (Wed 07:30 already passed)
    expect(out.map((b) => `${b.targetId} ${b.date}`)).toEqual([
      'gym 2026-10-07',
      'gym 2026-10-09',
      'meds 2026-10-08',
      'meds 2026-10-09',
      'meds 2026-10-10',
      'meds 2026-10-11',
    ]);
    expect(out[0]).toMatchObject({ origin: 'generated', status: 'planned', scheduledFor: '2026-10-07', start: 1080, durationMin: 60, moved: false });
  });

  it('never fills a slot that already has a block, even a moved or finished one', () => {
    const existing = [
      block({ targetId: 'gym', date: '2026-10-08', scheduledFor: '2026-10-07', moved: true }),
      block({ targetId: 'gym', date: '2026-10-09', scheduledFor: '2026-10-09', status: 'done', completedAt: '2026-10-09T19:00' }),
    ];
    expect(planFill([gym], WEEK, existing, ctx)).toEqual([]);
  });

  it('skips archived targets', () => {
    expect(planFill([{ ...gym, active: false }], WEEK, [], ctx)).toEqual([]);
  });
});

describe('planTargetReplan', () => {
  let n = 0;
  const ctx = { today: '2026-10-07', nowMin: 12 * 60, newId: () => `r${++n}` };
  const weeks = ['2026-10-05', '2026-10-12'];
  const gym = target({ id: 'gym', preferredDays: [1, 3, 5], frequencyPerWeek: 3, preferredStart: 18 * 60, durationMin: 60 });
  const gen = (date: string, extra: Partial<Parameters<typeof block>[0]> = {}) =>
    block({ id: `b-${date}`, targetId: 'gym', date, scheduledFor: date, start: 18 * 60, durationMin: 60, ...extra });

  it('changes nothing when the blocks already match (e.g. after a rename)', () => {
    const blocks = ['2026-10-07', '2026-10-09', '2026-10-12', '2026-10-14', '2026-10-16'].map((d) => gen(d));
    expect(planTargetReplan(gym, blocks, weeks, ctx)).toEqual({ deleteIds: [], insert: [] });
  });

  it('moves upcoming unmoved blocks to new days and time, keeping moved and finished ones', () => {
    const blocks = [
      gen('2026-10-07'),
      gen('2026-10-09', { moved: true, start: 19 * 60 }),
      gen('2026-10-12', { status: 'done', completedAt: '2026-10-12T19:00' }),
      gen('2026-10-14'),
    ];
    const tueThu = { ...gym, preferredDays: [2, 4] as const, frequencyPerWeek: 2, preferredStart: 17 * 60 };
    const plan = planTargetReplan({ ...tueThu, preferredDays: [2, 4] }, blocks, weeks, ctx);
    expect(plan.deleteIds).toEqual(['b-2026-10-07', 'b-2026-10-14']);
    expect(plan.insert.map((b) => `${b.date} ${b.start}`)).toEqual(['2026-10-08 1020', '2026-10-13 1020', '2026-10-15 1020']);
  });

  it('archiving removes upcoming unmoved blocks and creates none', () => {
    const blocks = [gen('2026-10-07'), gen('2026-10-09', { moved: true })];
    expect(planTargetReplan({ ...gym, active: false }, blocks, weeks, ctx)).toEqual({ deleteIds: ['b-2026-10-07'], insert: [] });
  });
});

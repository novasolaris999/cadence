import { describe, expect, it } from 'vitest';
import { categoryBalance, lateNights, missClusterDays, normalizeSleep, onTimeStats, struggles, wins } from './insights';
import type { Settings } from './types';
import { addDays } from './time';
import { block, target } from './test-helpers';

const TODAY = '2026-10-07'; // Wednesday
const settings: Settings = { wakeAnchor: 420, sleepAnchor: 23 * 60, theme: 'system', onTimeToleranceMin: 30 };

describe('sleep and wake', () => {
  it('treats bedtimes before noon as after midnight', () => {
    expect(normalizeSleep(30)).toBe(1470);
    expect(normalizeSleep(23 * 60)).toBe(1380);
  });

  it('counts on-time days within the tolerance', () => {
    const logs = [
      { date: '2026-10-05', wake: 425, sleep: 23 * 60 + 20 },
      { date: '2026-10-06', wake: 470, sleep: 45 }, // wake 50m late; 00:45 is 1h45m late
      { date: '2026-10-07', wake: null, sleep: null },
    ];
    expect(onTimeStats(logs, settings, 'wake')).toEqual({ onTime: 1, logged: 2, rate: 0.5 });
    expect(onTimeStats(logs, settings, 'sleep')).toEqual({ onTime: 1, logged: 2, rate: 0.5 });
    expect(lateNights(logs, settings)).toEqual(['2026-10-06']);
  });
});

describe('category balance', () => {
  it('sums done minutes, falling back to the target category', () => {
    const t = target({ id: 't1', categoryId: 'fit' });
    const blocks = [
      block({ date: '2026-10-05', status: 'done', durationMin: 90 }),
      block({ date: '2026-10-06', status: 'done', durationMin: 30, targetId: null, title: 'Call', categoryId: 'rel' }),
      block({ date: '2026-10-06', status: 'planned', durationMin: 600 }),
    ];
    const cats = [
      { id: 'fit', name: 'Fitness', color: 'cat-1' as const, sortOrder: 0 },
      { id: 'rel', name: 'People', color: 'cat-2' as const, sortOrder: 1 },
    ];
    const { slices, totalMinutes } = categoryBalance(blocks, [t], cats);
    expect(totalMinutes).toBe(120);
    expect(slices.map((s) => [s.category?.name, s.share])).toEqual([
      ['Fitness', 0.75],
      ['People', 0.25],
    ]);
  });
});

describe('wins and struggles', () => {
  it('flags weekdays where misses cluster', () => {
    // Thursdays missed 3 of 3, Mondays missed 1 of 3.
    const thursdays = ['2026-09-17', '2026-09-24', '2026-10-01'];
    const mondays = ['2026-09-21', '2026-09-28', '2026-10-05'];
    const blocks = [
      ...thursdays.map((d) => block({ date: d })),
      ...mondays.map((d, i) => block({ date: d, status: i === 0 ? 'planned' : 'done' })),
    ];
    expect(missClusterDays(blocks, TODAY)).toEqual([4]);
  });

  it('lists low-rate targets lowest first and perfect targets as wins', () => {
    const journal = target({ id: 'j', name: 'Journal' });
    const gym = target({ id: 'g', name: 'Gym' });
    const reading = target({ id: 'r', name: 'Reading' });
    const days = [-6, -5, -4, -3, -2, -1].map((n) => addDays(TODAY, n));
    const blocks = [
      ...days.map((d, i) => block({ targetId: 'j', date: d, status: i < 3 ? 'done' : 'planned' })), // 50%
      ...days.map((d) => block({ targetId: 'g', date: d, status: 'done' })), // 100%
      ...days.map((d, i) => block({ targetId: 'r', date: d, status: i < 1 ? 'done' : 'skipped' })), // 17%
    ];
    expect(struggles([journal, gym, reading], blocks, blocks, TODAY).map((s) => s.target.name)).toEqual([
      'Reading',
      'Journal',
    ]);
    expect(wins([journal, gym, reading], blocks, blocks, TODAY).map((w) => w.target.name)).toEqual(['Gym']);
  });
});

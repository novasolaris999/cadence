import { describe, expect, it } from 'vitest';
import { blockOutcome, cellsForRange, dayProgress, overallStreak, tally, targetStreak } from './metrics';
import { block } from './test-helpers';

const TODAY = '2026-10-07';

describe('blockOutcome', () => {
  it('applies the hit / miss / pending / upcoming rules', () => {
    expect(blockOutcome(block({ date: '2026-10-01', status: 'done' }), TODAY)).toBe('hit');
    expect(blockOutcome(block({ date: '2026-10-01' }), TODAY)).toBe('miss');
    expect(blockOutcome(block({ date: '2026-10-01', status: 'skipped' }), TODAY)).toBe('skipped');
    expect(blockOutcome(block({ date: TODAY }), TODAY)).toBe('pending');
    expect(blockOutcome(block({ date: '2026-10-09' }), TODAY)).toBe('upcoming');
  });
});

describe('tally', () => {
  it('counts skipped as a miss and leaves pending out of the rate', () => {
    const t = tally(
      [
        block({ date: '2026-10-05', status: 'done' }),
        block({ date: '2026-10-05', status: 'done' }),
        block({ date: '2026-10-06', status: 'skipped' }),
        block({ date: '2026-10-06' }),
        block({ date: TODAY }),
        block({ date: '2026-10-09' }),
      ],
      TODAY,
    );
    expect(t).toEqual({ hits: 2, misses: 2, pending: 1, upcoming: 1, rate: 0.5 });
  });

  it('returns a null rate when nothing has resolved', () => {
    expect(tally([block({ date: TODAY })], TODAY).rate).toBeNull();
  });
});

describe('dayProgress', () => {
  it('rounds the percentage', () => {
    const blocks = [1, 2, 3, 4, 5, 6, 7].map((i) => block({ date: TODAY, status: i <= 5 ? 'done' : 'planned' }));
    expect(dayProgress(blocks)).toEqual({ done: 5, total: 7, pct: 71 });
  });
});

describe('cells', () => {
  it('marks rest, future, and scheduled days', () => {
    const cells = cellsForRange(
      [block({ date: '2026-10-06', status: 'done' }), block({ date: '2026-10-08' })],
      '2026-10-05',
      '2026-10-09',
      TODAY,
    ).map((c) => c.state);
    expect(cells).toEqual(['rest', 'hit', 'rest', 'scheduled', 'future']);
  });
});

describe('streaks', () => {
  it('counts consecutive hits for a target and ignores today pending', () => {
    const blocks = [
      block({ date: '2026-09-30', status: 'done' }),
      block({ date: '2026-10-01' }), // miss
      block({ date: '2026-10-03', status: 'done' }),
      block({ date: '2026-10-05', status: 'done' }),
      block({ date: TODAY }), // pending
    ];
    expect(targetStreak(blocks, TODAY)).toBe(2);
  });

  it('counts days with hits and no misses; empty days are neutral', () => {
    const blocks = [
      block({ date: '2026-10-02' }), // miss: stops here
      block({ date: '2026-10-03', status: 'done' }),
      // 10-04 empty
      block({ date: '2026-10-05', status: 'done' }),
      block({ date: '2026-10-06', status: 'done' }),
      block({ date: TODAY }), // pending today: neutral
    ];
    expect(overallStreak(blocks, TODAY)).toBe(3);
  });
});

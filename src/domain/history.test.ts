import { describe, expect, it } from 'vitest';
import { bestStreak, periodRates, recentResults, routineDayCell, routineDays, weekCellsForRange, weekdayRates } from './history';
import { periodContaining } from './time';
import { block } from './test-helpers';

const TODAY = '2026-10-07'; // Wednesday
const hit = (date: string) => block({ date, status: 'done', completedAt: `${date}T09:10` });
const miss = (date: string) => block({ date });
const skip = (date: string) => block({ date, status: 'skipped' });

describe('bestStreak', () => {
  it('finds the longest run of hits, broken by misses and skips', () => {
    const blocks = [hit('2026-09-01'), hit('2026-09-02'), miss('2026-09-03'), hit('2026-09-04'), hit('2026-09-05'), hit('2026-09-06'), skip('2026-09-07'), hit('2026-09-08')];
    expect(bestStreak(blocks, TODAY)).toBe(3);
  });
  it('ignores today and the future', () => {
    expect(bestStreak([hit('2026-10-06'), miss(TODAY), miss('2026-10-09')], TODAY)).toBe(1);
  });
});

describe('recentResults', () => {
  it('lists resolved results newest first, without pending or upcoming ones', () => {
    const r = recentResults([hit('2026-10-01'), miss('2026-10-05'), skip('2026-10-06'), miss(TODAY), miss('2026-10-08')], TODAY, 2);
    expect(r.map((x) => [x.date, x.outcome])).toEqual([
      ['2026-10-06', 'skipped'],
      ['2026-10-05', 'miss'],
    ]);
  });
});

describe('weekdayRates', () => {
  it('rates each weekday by where blocks landed', () => {
    const rates = weekdayRates([hit('2026-10-05'), miss('2026-09-28'), hit('2026-10-01')], TODAY);
    expect(rates[0]).toMatchObject({ weekday: 1, hits: 1, misses: 1, rate: 0.5 });
    expect(rates[3]).toMatchObject({ weekday: 4, rate: 1 });
    expect(rates[6]!.rate).toBeNull();
  });
});

describe('periodRates', () => {
  it('gives one rate per period, oldest first, ending with the shown one', () => {
    const last = periodContaining('weekly', TODAY);
    const r = periodRates([hit('2026-09-22'), miss('2026-09-30'), hit('2026-10-05')], last, 3, TODAY);
    expect(r.map((x) => [x.period.from, x.rate])).toEqual([
      ['2026-09-21', 1],
      ['2026-09-28', 0],
      ['2026-10-05', 1],
    ]);
  });
});

describe('routine days', () => {
  it('is done when every habit is ticked, partial when some are, missed when none', () => {
    expect(routineDayCell([hit('2026-10-05'), hit('2026-10-05')], '2026-10-05', TODAY)).toBe('hit');
    expect(routineDayCell([hit('2026-10-05'), miss('2026-10-05')], '2026-10-05', TODAY)).toBe('partial');
    expect(routineDayCell([miss('2026-10-05'), miss('2026-10-05')], '2026-10-05', TODAY)).toBe('miss');
    expect(routineDayCell([], '2026-10-05', TODAY)).toBe('rest');
  });
  it('keeps today in progress until everything is done', () => {
    expect(routineDayCell([miss(TODAY)], TODAY, TODAY)).toBe('pending');
    expect(routineDayCell([hit(TODAY), miss(TODAY)], TODAY, TODAY)).toBe('partial');
  });
  it('counts full, partial, and missed days; today’s partial is not a result yet', () => {
    const blocks = [hit('2026-10-05'), hit('2026-10-05'), hit('2026-10-06'), miss('2026-10-06'), miss('2026-10-04'), hit(TODAY), miss(TODAY)];
    expect(routineDays(blocks, '2026-10-04', TODAY, TODAY)).toEqual({ full: 1, partial: 1, missed: 1 });
  });
});

describe('weekCellsForRange', () => {
  it('rates whole weeks: all done, some done, none done, this week in progress', () => {
    const blocks = [
      hit('2026-09-14'), hit('2026-09-16'), // all done
      hit('2026-09-21'), miss('2026-09-23'), // some
      miss('2026-09-30'), // none
      miss(TODAY), // this week, today
    ];
    expect(weekCellsForRange(blocks, '2026-09-14', '2026-10-11', TODAY).map((c) => [c.date, c.state])).toEqual([
      ['2026-09-14', 'hit'],
      ['2026-09-21', 'partial'],
      ['2026-09-28', 'miss'],
      ['2026-10-05', 'pending'],
    ]);
  });
});

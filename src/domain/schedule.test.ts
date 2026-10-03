import { describe, expect, it } from 'vitest';
import { targetDays } from './schedule';

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

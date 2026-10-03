import { describe, expect, it } from 'vitest';
import { isNewTarget } from './novelty';
import { toISODate } from './time';

describe('isNewTarget', () => {
  // Build the creation instant from local components, so the test works in any time zone.
  const createdLate = new Date(2026, 9, 5, 23, 0).toISOString(); // Mon Oct 5, 23:00 local

  it('stays new through the end of the next day', () => {
    expect(isNewTarget(createdLate, '2026-10-05')).toBe(true);
    expect(isNewTarget(createdLate, '2026-10-06')).toBe(true);
    expect(isNewTarget(createdLate, '2026-10-07')).toBe(false);
  });

  it('is never new without a creation time', () => {
    expect(isNewTarget(null, toISODate(new Date()))).toBe(false);
    expect(isNewTarget('not a date', '2026-10-05')).toBe(false);
  });
});

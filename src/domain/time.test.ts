import { describe, expect, it } from 'vitest';
import {
  addDays,
  daysBetween,
  formatDays,
  formatDuration,
  isoWeekNumber,
  isoWeekday,
  parseTime,
  periodContaining,
  shiftPeriod,
  startOfWeek,
  toISODate,
} from './time';

describe('time', () => {
  it('formats local dates without UTC shifting', () => {
    // 23:30 local on Oct 3 must stay Oct 3, whatever the machine time zone.
    expect(toISODate(new Date(2026, 9, 3, 23, 30))).toBe('2026-10-03');
  });

  it('adds days across month and year ends', () => {
    expect(addDays('2026-10-31', 1)).toBe('2026-11-01');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
  });

  it('counts days across a DST change', () => {
    expect(daysBetween('2026-03-07', '2026-03-09')).toBe(2);
    expect(daysBetween('2026-11-02', '2026-10-31')).toBe(-2);
  });

  it('uses ISO weekdays and Monday week starts', () => {
    expect(isoWeekday('2026-10-03')).toBe(6); // Saturday
    expect(isoWeekday('2026-10-04')).toBe(7); // Sunday
    expect(startOfWeek('2026-10-04')).toBe('2026-09-28');
    expect(startOfWeek('2026-09-28')).toBe('2026-09-28');
  });

  it('computes ISO week numbers', () => {
    expect(isoWeekNumber('2026-10-03')).toBe(40);
    expect(isoWeekNumber('2027-01-01')).toBe(53); // belongs to 2026's last week
    expect(isoWeekNumber('2026-01-01')).toBe(1);
  });

  it('builds periods and steps through them', () => {
    expect(periodContaining('monthly', '2026-02-14')).toMatchObject({ from: '2026-02-01', to: '2026-02-28' });
    expect(periodContaining('quarterly', '2026-10-03')).toMatchObject({ from: '2026-10-01', to: '2026-12-31' });
    const q = periodContaining('quarterly', '2026-01-15');
    expect(shiftPeriod(q, -1)).toMatchObject({ from: '2025-10-01', to: '2025-12-31' });
    const w = periodContaining('weekly', '2026-10-03');
    expect(shiftPeriod(w, 1)).toMatchObject({ from: '2026-10-05', to: '2026-10-11' });
  });

  it('parses and formats times and durations', () => {
    expect(parseTime('07:30:00')).toBe(450);
    expect(formatDuration(165)).toBe('2h 45m');
    expect(formatDuration(120)).toBe('2h');
    expect(formatDuration(15)).toBe('15m');
  });

  it('describes target days', () => {
    expect(formatDays([5, 1, 3], 3)).toBe('Mon · Wed · Fri');
    expect(formatDays([1, 2, 3, 4, 5, 6, 7], 7)).toBe('Daily');
    expect(formatDays([], 3)).toBe('3x / week');
  });
});

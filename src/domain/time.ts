// Local date and time helpers.
// Dates are 'YYYY-MM-DD' strings and times are minutes since midnight. Both are local wall-clock
// values with no time zone, so a 07:30 routine stays 07:30 wherever you are.
// We build Date objects only from local components (new Date(y, m, d)), never from UTC, which
// avoids the classic bug where toISOString() shifts the day in the evening.

import type { ISODate, Minutes, Weekday } from './types';

const pad = (n: number) => String(n).padStart(2, '0');

export function toISODate(d: Date): ISODate {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function parseISODate(s: ISODate): Date {
  const [y, m, d] = s.split('-').map(Number) as [number, number, number];
  return new Date(y, m - 1, d);
}

export function today(now: Date = new Date()): ISODate {
  return toISODate(now);
}

export function minutesOfDay(now: Date = new Date()): Minutes {
  return now.getHours() * 60 + now.getMinutes();
}

export function addDays(s: ISODate, n: number): ISODate {
  const d = parseISODate(s);
  return toISODate(new Date(d.getFullYear(), d.getMonth(), d.getDate() + n));
}

/** Whole days from a to b (b - a). Uses UTC math on the date parts, so DST cannot skew it. */
export function daysBetween(a: ISODate, b: ISODate): number {
  const [ay, am, ad] = a.split('-').map(Number) as [number, number, number];
  const [by, bm, bd] = b.split('-').map(Number) as [number, number, number];
  return Math.round((Date.UTC(by, bm - 1, bd) - Date.UTC(ay, am - 1, ad)) / 86_400_000);
}

export function isoWeekday(s: ISODate): Weekday {
  const js = parseISODate(s).getDay(); // 0 = Sunday
  return (js === 0 ? 7 : js) as Weekday;
}

/** Monday of the week containing s. Weeks start on Monday. */
export function startOfWeek(s: ISODate): ISODate {
  return addDays(s, 1 - isoWeekday(s));
}

export function weekDates(s: ISODate): ISODate[] {
  const monday = startOfWeek(s);
  return Array.from({ length: 7 }, (_, i) => addDays(monday, i));
}

/** Inclusive list of dates from `from` to `to`. */
export function dateRange(from: ISODate, to: ISODate): ISODate[] {
  const n = daysBetween(from, to);
  return Array.from({ length: Math.max(0, n + 1) }, (_, i) => addDays(from, i));
}

/** ISO 8601 week number (weeks start Monday; week 1 contains the first Thursday). */
export function isoWeekNumber(s: ISODate): number {
  const thursday = addDays(s, 4 - isoWeekday(s));
  const jan1 = `${thursday.slice(0, 4)}-01-01`;
  return Math.floor(daysBetween(jan1, thursday) / 7) + 1;
}

export type Scope = 'weekly' | 'monthly' | 'quarterly' | 'yearly';

export interface Period {
  scope: Scope;
  from: ISODate;
  to: ISODate;
}

/** The period of the given scope that contains `s`. */
export function periodContaining(scope: Scope, s: ISODate): Period {
  const y = Number(s.slice(0, 4));
  const m = Number(s.slice(5, 7)); // 1-12
  switch (scope) {
    case 'weekly': {
      const from = startOfWeek(s);
      return { scope, from, to: addDays(from, 6) };
    }
    case 'monthly':
      return { scope, from: `${y}-${pad(m)}-01`, to: lastDayOfMonth(y, m) };
    case 'quarterly': {
      const qStart = Math.floor((m - 1) / 3) * 3 + 1;
      return { scope, from: `${y}-${pad(qStart)}-01`, to: lastDayOfMonth(y, qStart + 2) };
    }
    case 'yearly':
      return { scope, from: `${y}-01-01`, to: `${y}-12-31` };
  }
}

/** The period `offset` steps away (-1 = previous). */
export function shiftPeriod(p: Period, offset: number): Period {
  if (offset === 0) return p;
  if (p.scope === 'weekly') return periodContaining('weekly', addDays(p.from, 7 * offset));
  const months = p.scope === 'monthly' ? 1 : p.scope === 'quarterly' ? 3 : 12;
  const y = Number(p.from.slice(0, 4));
  const m = Number(p.from.slice(5, 7)) - 1 + months * offset;
  const ny = y + Math.floor(m / 12);
  const nm = (((m % 12) + 12) % 12) + 1;
  return periodContaining(p.scope, `${ny}-${pad(nm)}-01`);
}

function lastDayOfMonth(y: number, m: number): ISODate {
  return toISODate(new Date(y, m, 0));
}

export function formatTime(min: Minutes): string {
  const m = ((min % 1440) + 1440) % 1440;
  return `${pad(Math.floor(m / 60))}:${pad(m % 60)}`;
}

/** Parses 'HH:MM' or 'HH:MM:SS' (Postgres time) into minutes. */
export function parseTime(s: string): Minutes {
  const [h, m] = s.split(':').map(Number) as [number, number];
  return h * 60 + m;
}

/** 90 -> '1h 30m', 45 -> '45m', 120 -> '2h'. */
export function formatDuration(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h === 0) return `${m}m`;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

export function formatTimeRange(start: Minutes, durationMin: number): string {
  return `${formatTime(start)} – ${formatTime(start + durationMin)}`;
}

const WEEKDAY_SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;
const WEEKDAY_LONG = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
] as const;
const MONTH_SHORT = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
] as const;
const MONTH_LONG = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
] as const;

export const weekdayShort = (w: Weekday) => WEEKDAY_SHORT[w - 1]!;
export const weekdayLong = (w: Weekday) => WEEKDAY_LONG[w - 1]!;
export const weekdayInitial = (w: Weekday) => WEEKDAY_SHORT[w - 1]![0]!;

const monthShort = (s: ISODate) => MONTH_SHORT[Number(s.slice(5, 7)) - 1]!;
const dayNum = (s: ISODate) => Number(s.slice(8, 10));

/** 'Wed, Oct 25' */
export function formatDayShort(s: ISODate): string {
  return `${weekdayShort(isoWeekday(s))}, ${monthShort(s)} ${dayNum(s)}`;
}

/** 'Wednesday, Oct 25' */
export function formatDayLong(s: ISODate): string {
  return `${weekdayLong(isoWeekday(s))}, ${monthShort(s)} ${dayNum(s)}`;
}

/** 'Oct 23 – 29' or 'Oct 30 – Nov 5' */
export function formatDateSpan(from: ISODate, to: ISODate): string {
  const sameMonth = from.slice(0, 7) === to.slice(0, 7);
  return sameMonth
    ? `${monthShort(from)} ${dayNum(from)} – ${dayNum(to)}`
    : `${monthShort(from)} ${dayNum(from)} – ${monthShort(to)} ${dayNum(to)}`;
}

/** Short period label for chart axes: "W40", "Sep", "Q3", "2026". */
export function formatPeriodShort(p: Period): string {
  switch (p.scope) {
    case 'weekly':
      return `W${isoWeekNumber(p.from)}`;
    case 'monthly':
      return monthShort(p.from);
    case 'quarterly':
      return `Q${Math.floor((Number(p.from.slice(5, 7)) - 1) / 3) + 1}`;
    case 'yearly':
      return p.from.slice(0, 4);
  }
}

export function formatPeriod(p: Period): string {
  const y = p.from.slice(0, 4);
  switch (p.scope) {
    case 'weekly':
      return `Week ${isoWeekNumber(p.from)} · ${formatDateSpan(p.from, p.to)}`;
    case 'monthly':
      return `${MONTH_LONG[Number(p.from.slice(5, 7)) - 1]} ${y}`;
    case 'quarterly':
      return `Q${Math.floor((Number(p.from.slice(5, 7)) - 1) / 3) + 1} ${y}`;
    case 'yearly':
      return y;
  }
}

/** 'Mon · Wed · Fri', 'Daily', 'Weekdays', or '3x / week' when no days are set. */
export function formatDays(days: Weekday[], frequencyPerWeek: number): string {
  if (days.length === 0) return `${frequencyPerWeek}x / week`;
  if (days.length === 7) return 'Daily';
  const sorted = [...days].sort();
  if (sorted.join() === '1,2,3,4,5') return 'Weekdays';
  if (sorted.join() === '6,7') return 'Weekends';
  return sorted.map(weekdayShort).join(' · ');
}

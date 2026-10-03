// History views (Habits tab, habit and routine pages): longer-range numbers, all derived from blocks
// at read time, never stored. Outcome rules live in metrics.ts.

import { blockOutcome, groupByDate, isMiss, tally, type CellState, type Outcome } from './metrics';
import { addDays, dateRange, isoWeekday, shiftPeriod, startOfWeek, type Period } from './time';
import type { Block, ISODate, Minutes, Weekday } from './types';

/** Resolved results (hit or miss), oldest first. */
function resolvedInOrder(blocks: Block[], today: ISODate) {
  return blocks
    .map((b) => ({ b, o: blockOutcome(b, today) }))
    .filter((x) => x.o === 'hit' || isMiss(x.o))
    .sort((x, y) => (x.b.date === y.b.date ? x.b.start - y.b.start : x.b.date < y.b.date ? -1 : 1));
}

/** The longest run of hits in a habit's history, misses and skips breaking it. */
export function bestStreak(blocks: Block[], today: ISODate): number {
  let best = 0;
  let run = 0;
  for (const { o } of resolvedInOrder(blocks, today)) {
    run = o === 'hit' ? run + 1 : 0;
    best = Math.max(best, run);
  }
  return best;
}

export interface Result {
  date: ISODate;
  start: Minutes;
  outcome: Outcome;
  /** 'YYYY-MM-DDTHH:MM' when done. */
  completedAt: string | null;
}

/** The latest resolved results, newest first. */
export function recentResults(blocks: Block[], today: ISODate, count: number): Result[] {
  return resolvedInOrder(blocks, today)
    .slice(-count)
    .reverse()
    .map(({ b, o }) => ({ date: b.date, start: b.start, outcome: o, completedAt: b.completedAt }));
}

export interface WeekdayRate {
  weekday: Weekday;
  hits: number;
  misses: number;
  rate: number | null;
}

/** Hit rate per weekday (Mon..Sun), by the day a block actually landed on. */
export function weekdayRates(blocks: Block[], today: ISODate): WeekdayRate[] {
  return ([1, 2, 3, 4, 5, 6, 7] as Weekday[]).map((weekday) => {
    const t = tally(blocks.filter((b) => isoWeekday(b.date) === weekday), today);
    return { weekday, hits: t.hits, misses: t.misses, rate: t.rate };
  });
}

export interface PeriodRate {
  period: Period;
  hits: number;
  misses: number;
  rate: number | null;
}

/** Rates for `count` periods ending with `last`, oldest first (for the trend chart). */
export function periodRates(blocks: Block[], last: Period, count: number, today: ISODate): PeriodRate[] {
  return Array.from({ length: count }, (_, i) => {
    const period = shiftPeriod(last, i - count + 1);
    const t = tally(blocks.filter((b) => b.date >= period.from && b.date <= period.to), today);
    return { period, hits: t.hits, misses: t.misses, rate: t.rate };
  });
}

/**
 * One day of a routine: done = every habit ticked, partial = some, miss = none (on a past day).
 * Today stays pending until every habit is done. Days without the routine are rest.
 */
export function routineDayCell(blocksOnDay: Block[], date: ISODate, today: ISODate): CellState {
  if (blocksOnDay.length === 0) return date > today ? 'future' : 'rest';
  const done = blocksOnDay.filter((b) => b.status === 'done').length;
  if (done === blocksOnDay.length) return 'hit';
  if (date > today) return 'scheduled';
  if (date === today) return done > 0 ? 'partial' : 'pending';
  if (done > 0) return 'partial';
  return blocksOnDay.every((b) => b.status === 'skipped') ? 'skipped' : 'miss';
}

export function routineCellsForRange(blocks: Block[], from: ISODate, to: ISODate, today: ISODate) {
  const byDate = groupByDate(blocks);
  return dateRange(from, to).map((date) => ({ date, state: routineDayCell(byDate.get(date) ?? [], date, today) }));
}

export interface RoutineDays {
  /** Days every habit was done. */
  full: number;
  /** Past days with some, but not all, done. */
  partial: number;
  /** Past days with nothing done. */
  missed: number;
}

/** Routine days in a range, by how complete they were. */
export function routineDays(blocks: Block[], from: ISODate, to: ISODate, today: ISODate): RoutineDays {
  const out: RoutineDays = { full: 0, partial: 0, missed: 0 };
  for (const { date, state } of routineCellsForRange(blocks, from, to, today)) {
    if (state === 'hit') out.full++;
    // Today's partial is still in progress, not a result.
    else if (state === 'partial' && date < today) out.partial++;
    else if (state === 'miss' || state === 'skipped') out.missed++;
  }
  return out;
}

/**
 * One cell per week (for quarter and year strips): every block done = hit, some = partial,
 * none = miss, judged like a routine day. The current week is still in progress.
 */
export function weekCellsForRange(blocks: Block[], from: ISODate, to: ISODate, today: ISODate): { date: ISODate; state: CellState }[] {
  const out: { date: ISODate; state: CellState }[] = [];
  for (let monday = startOfWeek(from); monday <= to; monday = addDays(monday, 7)) {
    const sunday = addDays(monday, 6);
    const inWeek = blocks.filter((b) => b.date >= monday && b.date <= sunday && b.date >= from && b.date <= to);
    // Judge a past week as past, a future week as future, and this week as today.
    const asOf = sunday < today ? sunday : monday > today ? monday : today;
    out.push({ date: monday, state: routineDayCell(inWeek, asOf, today) });
  }
  return out;
}

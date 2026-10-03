// Hit / miss / rest rules, rates, and streaks. All derived from blocks at read time;
// nothing here is ever stored (SPEC: "Never store percentages, streaks, or hit and miss counts").
//
// The rules, in one place:
// - done                          -> hit
// - skipped                       -> miss (counts against the rate, drawn differently)
// - planned on a past date        -> miss
// - planned today                 -> pending (not a miss until the day ends)
// - planned on a future date      -> upcoming
// - rate = hits / (hits + misses), or null when nothing has resolved yet

import type { Block, ISODate } from './types';
import { addDays, dateRange } from './time';

export type Outcome = 'hit' | 'miss' | 'skipped' | 'pending' | 'upcoming';

export function blockOutcome(b: Block, today: ISODate): Outcome {
  if (b.status === 'done') return 'hit';
  if (b.status === 'skipped') return 'skipped';
  if (b.date < today) return 'miss';
  if (b.date === today) return 'pending';
  return 'upcoming';
}

export const isMiss = (o: Outcome) => o === 'miss' || o === 'skipped';

export interface Tally {
  hits: number;
  misses: number;
  pending: number;
  upcoming: number;
  /** hits / (hits + misses), 0..1, or null when nothing has resolved. */
  rate: number | null;
}

export function tally(blocks: Block[], today: ISODate): Tally {
  let hits = 0;
  let misses = 0;
  let pending = 0;
  let upcoming = 0;
  for (const b of blocks) {
    const o = blockOutcome(b, today);
    if (o === 'hit') hits++;
    else if (isMiss(o)) misses++;
    else if (o === 'pending') pending++;
    else upcoming++;
  }
  const resolved = hits + misses;
  return { hits, misses, pending, upcoming, rate: resolved ? hits / resolved : null };
}

/** Done count for a single day, as shown in "5 of 7 done · 71%". */
export function dayProgress(blocks: Block[]): { done: number; total: number; pct: number } {
  const total = blocks.length;
  const done = blocks.filter((b) => b.status === 'done').length;
  return { done, total, pct: total ? Math.round((done / total) * 100) : 0 };
}

export type CellState =
  | 'hit'
  | 'miss'
  | 'skipped'
  | 'partial' // a routine day with some of its habits done
  | 'pending' // scheduled today, not done yet
  | 'scheduled' // scheduled on a future date
  | 'rest' // nothing scheduled, past or today
  | 'future'; // nothing scheduled, future

/** One cell of a goal's hit/miss/rest grid. A day with any hit counts as a hit. */
export function dayCell(blocksOnDay: Block[], date: ISODate, today: ISODate): CellState {
  if (blocksOnDay.length === 0) return date > today ? 'future' : 'rest';
  const outcomes = blocksOnDay.map((b) => blockOutcome(b, today));
  if (outcomes.includes('hit')) return 'hit';
  if (outcomes.includes('miss')) return 'miss';
  if (outcomes.includes('skipped')) return 'skipped';
  if (outcomes.includes('pending')) return 'pending';
  return 'scheduled';
}

export function groupByDate(blocks: Block[]): Map<ISODate, Block[]> {
  const map = new Map<ISODate, Block[]>();
  for (const b of blocks) {
    const list = map.get(b.date);
    if (list) list.push(b);
    else map.set(b.date, [b]);
  }
  return map;
}

export function cellsForRange(
  blocks: Block[],
  from: ISODate,
  to: ISODate,
  today: ISODate,
): { date: ISODate; state: CellState }[] {
  const byDate = groupByDate(blocks);
  return dateRange(from, to).map((date) => ({
    date,
    state: dayCell(byDate.get(date) ?? [], date, today),
  }));
}

/**
 * Consecutive hits for one target, counting back from its most recent resolved occurrence.
 * Today's pending block does not break the streak; a hit today extends it.
 */
export function targetStreak(targetBlocks: Block[], today: ISODate): number {
  const resolved = targetBlocks
    .map((b) => ({ date: b.date, start: b.start, o: blockOutcome(b, today) }))
    .filter((x) => x.o === 'hit' || isMiss(x.o))
    .sort((a, b) => (a.date === b.date ? b.start - a.start : a.date < b.date ? 1 : -1));
  let streak = 0;
  for (const x of resolved) {
    if (x.o !== 'hit') break;
    streak++;
  }
  return streak;
}

/**
 * Consecutive days with at least one hit and zero misses, counting back from today.
 * Days with nothing resolved (empty days, or today before anything is done) are neutral:
 * they neither count nor break the streak.
 */
export function overallStreak(blocks: Block[], today: ISODate): number {
  if (blocks.length === 0) return 0;
  const byDate = groupByDate(blocks);
  const earliest = blocks.reduce((min, b) => (b.date < min ? b.date : min), today);
  let streak = 0;
  for (let d = today; d >= earliest; d = addDays(d, -1)) {
    const outcomes = (byDate.get(d) ?? []).map((b) => blockOutcome(b, today));
    if (outcomes.some(isMiss)) break;
    if (outcomes.includes('hit')) streak++;
  }
  return streak;
}

/** Rate tier used for badge colors: good >= 80%, ok >= 60%, else low. */
export function rateTier(rate: number | null): 'good' | 'ok' | 'low' | 'none' {
  if (rate === null) return 'none';
  if (rate >= 0.8) return 'good';
  if (rate >= 0.6) return 'ok';
  return 'low';
}

export const pct = (rate: number | null) => (rate === null ? '–' : `${Math.round(rate * 100)}%`);

// Insights: on-time wake/sleep, regularity, category balance, wins, and struggles.
// All rule based and derived at read time. No AI.

import type { Block, Category, DayLog, ISODate, Minutes, Settings, Target, Weekday } from './types';
import { addDays, isoWeekday } from './time';
import { blockOutcome, isMiss, tally, targetStreak } from './metrics';

// ---------- Sleep and wake ----------

/** Bedtimes before noon belong to the previous night: 00:30 becomes 24:30 (1470). */
export function normalizeSleep(min: Minutes): Minutes {
  return min < 12 * 60 ? min + 1440 : min;
}

export interface OnTime {
  onTime: number;
  logged: number;
  rate: number | null;
}

export function onTimeStats(
  logs: DayLog[],
  settings: Settings,
  kind: 'wake' | 'sleep',
): OnTime {
  const anchor =
    kind === 'wake' ? settings.wakeAnchor : normalizeSleep(settings.sleepAnchor);
  let onTime = 0;
  let logged = 0;
  for (const log of logs) {
    const raw = kind === 'wake' ? log.wake : log.sleep;
    if (raw === null) continue;
    const value = kind === 'wake' ? raw : normalizeSleep(raw);
    logged++;
    if (Math.abs(value - anchor) <= settings.onTimeToleranceMin) onTime++;
  }
  return { onTime, logged, rate: logged ? onTime / logged : null };
}

/** Mean absolute deviation of logged wake times from their own average, in minutes. */
export function wakeDrift(logs: DayLog[]): number | null {
  const values = logs.map((l) => l.wake).filter((v): v is number => v !== null);
  if (values.length < 2) return null;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  return Math.round(values.reduce((a, v) => a + Math.abs(v - mean), 0) / values.length);
}

/** Dates whose bedtime was later than the anchor plus tolerance. */
export function lateNights(logs: DayLog[], settings: Settings): ISODate[] {
  const limit = normalizeSleep(settings.sleepAnchor) + settings.onTimeToleranceMin;
  return logs.filter((l) => l.sleep !== null && normalizeSleep(l.sleep) > limit).map((l) => l.date);
}

// ---------- Category balance ----------

export interface BalanceSlice {
  category: Category | null;
  minutes: number;
  share: number;
}

/** Minutes of completed blocks per category, largest first. */
export function categoryBalance(
  blocks: Block[],
  targets: Target[],
  categories: Category[],
): { slices: BalanceSlice[]; totalMinutes: number } {
  const targetById = new Map(targets.map((t) => [t.id, t]));
  const catById = new Map(categories.map((c) => [c.id, c]));
  const minutes = new Map<string | null, number>();
  for (const b of blocks) {
    if (b.status !== 'done') continue;
    const catId = effectiveCategoryId(b, targetById);
    minutes.set(catId, (minutes.get(catId) ?? 0) + b.durationMin);
  }
  const totalMinutes = [...minutes.values()].reduce((a, b) => a + b, 0);
  const slices = [...minutes.entries()]
    .map(([id, m]) => ({
      category: id ? (catById.get(id) ?? null) : null,
      minutes: m,
      share: totalMinutes ? m / totalMinutes : 0,
    }))
    .sort((a, b) => b.minutes - a.minutes);
  return { slices, totalMinutes };
}

export function effectiveCategoryId(b: Block, targetById: Map<string, Target>): string | null {
  if (b.categoryId) return b.categoryId;
  return b.targetId ? (targetById.get(b.targetId)?.categoryId ?? null) : null;
}

// ---------- Wins and struggles ----------

export interface Win {
  target: Target;
  kind: 'perfect' | 'streak';
  hits: number;
  streak: number;
}

/** Minimum resolved occurrences before a target can be called a win or a struggle. */
export const MIN_RESOLVED = 2;
/** A streak this long is a win even if the period was not perfect. */
export const WIN_STREAK = 7;

export function wins(
  targets: Target[],
  periodBlocks: Block[],
  allBlocks: Block[],
  today: ISODate,
): Win[] {
  const result: Win[] = [];
  for (const t of targets) {
    const mine = periodBlocks.filter((b) => b.targetId === t.id);
    const { hits, misses } = tally(mine, today);
    const streak = targetStreak(
      allBlocks.filter((b) => b.targetId === t.id),
      today,
    );
    if (hits >= MIN_RESOLVED && misses === 0) result.push({ target: t, kind: 'perfect', hits, streak });
    else if (streak >= WIN_STREAK) result.push({ target: t, kind: 'streak', hits, streak });
  }
  return result.sort((a, b) => b.streak - a.streak);
}

export interface Struggle {
  target: Target;
  hits: number;
  resolved: number;
  rate: number;
  /** Weekdays where misses cluster, from the longer lookback window. */
  clusterDays: Weekday[];
}

/** A target is a struggle when its completion rate is below this. */
export const STRUGGLE_RATE = 0.7;
/** Lookback for weekday clustering. A single week has at most one miss per weekday. */
export const CLUSTER_LOOKBACK_DAYS = 56;

/**
 * Lowest completion rates first. For each, the weekdays where misses cluster:
 * a weekday is flagged when it has at least 2 misses and at least half its
 * occurrences on that weekday were missed (over the last 8 weeks).
 */
export function struggles(
  targets: Target[],
  periodBlocks: Block[],
  allBlocks: Block[],
  today: ISODate,
  max = 3,
): Struggle[] {
  const lookbackFrom = addDays(today, -CLUSTER_LOOKBACK_DAYS);
  const result: Struggle[] = [];
  for (const t of targets) {
    const { hits, misses, rate } = tally(
      periodBlocks.filter((b) => b.targetId === t.id),
      today,
    );
    const resolved = hits + misses;
    if (rate === null || resolved < MIN_RESOLVED || rate >= STRUGGLE_RATE) continue;
    const history = allBlocks.filter(
      (b) => b.targetId === t.id && b.date >= lookbackFrom && b.date <= today,
    );
    result.push({ target: t, hits, resolved, rate, clusterDays: missClusterDays(history, today) });
  }
  return result.sort((a, b) => a.rate - b.rate).slice(0, max);
}

export function missClusterDays(blocks: Block[], today: ISODate): Weekday[] {
  const total = new Map<Weekday, number>();
  const missed = new Map<Weekday, number>();
  for (const b of blocks) {
    const o = blockOutcome(b, today);
    if (o !== 'hit' && !isMiss(o)) continue;
    const w = isoWeekday(b.date);
    total.set(w, (total.get(w) ?? 0) + 1);
    if (isMiss(o)) missed.set(w, (missed.get(w) ?? 0) + 1);
  }
  const days: Weekday[] = [];
  for (const [w, m] of missed) {
    if (m >= 2 && m / (total.get(w) ?? 1) >= 0.5) days.push(w);
  }
  return days.sort((a, b) => a - b);
}

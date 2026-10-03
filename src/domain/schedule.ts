// Scheduling rules: plain rules, no optimization, no AI (SPEC "Scheduling").
//
// This file is the seam for a future optimizing scheduler: anything that can answer
// "which days and times should this target land on this week" can replace these functions
// without touching the screens or the database.
//
// Phase 4 adds planWeek() and the re-run rules here. For now: which weekdays a target uses.

import type { Target, Weekday } from './types';

/**
 * When a target has no preferred days, its weekly frequency is spread with this fixed table.
 * Chosen to leave recovery gaps between sessions where possible.
 */
export const SPREAD: Record<number, Weekday[]> = {
  1: [1],
  2: [2, 4],
  3: [1, 3, 5],
  4: [1, 2, 4, 5],
  5: [1, 2, 3, 4, 5],
  6: [1, 2, 3, 4, 5, 6],
  7: [1, 2, 3, 4, 5, 6, 7],
};

/** The weekdays a target is scheduled on. Preferred days win; otherwise the spread table. */
export function targetDays(t: Pick<Target, 'preferredDays' | 'frequencyPerWeek'>): Weekday[] {
  if (t.preferredDays.length > 0) return [...t.preferredDays].sort((a, b) => a - b);
  const n = Math.min(7, Math.max(1, Math.round(t.frequencyPerWeek)));
  return SPREAD[n]!;
}

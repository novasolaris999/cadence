// Routines and quick habits: pure rules.
//
// A routine is a group of habits done together, like a superset. Each habit in it still gets its own
// block every day, so streaks and hit rates stay per habit. Screens draw the routine's blocks for one
// day as a single card.

import type { Block, ISODate, Minutes, Routine, Target, Weekday } from './types';
import { formatDuration } from './time';

/** The timeline grid, in minutes. */
const GRID = 15;

/** A quick habit takes no time slot: just a tick. */
export const QUICK = 0;

/** Minutes a habit can take inside a routine (5-minute steps are allowed there). */
export const ROUTINE_DURATIONS = [QUICK, 5, 10, 15, 20, 30, 45, 60, 90];

/** "Quick" for a quick habit, otherwise its length ("10m", "1h 30m"). */
export const habitLength = (min: number) => (min === QUICK ? 'Quick' : formatDuration(min));

/** A quick habit on its own: it has no time, so Today lists it under "Anytime" instead of on the timeline. */
export const isAnytime = (t: Pick<Target, 'durationMin' | 'routineId'>) => t.durationMin === QUICK && t.routineId === null;

/** A habit with the routine's schedule copied onto it. Name, length, and category stay the habit's own. */
export function withRoutine(habit: Target, routine: Routine, order: number): Target {
  return {
    ...habit,
    routineId: routine.id,
    routineOrder: order,
    frequencyPerWeek: routine.frequencyPerWeek,
    preferredDays: [...routine.preferredDays],
    preferredStart: routine.preferredStart,
    windowEnd: null,
    protected: routine.protected,
    active: routine.active,
  };
}

/** Total minutes of a routine's habits (quick ones count 0). */
export const routineMinutes = (habits: Pick<Target, 'durationMin'>[] | Pick<Block, 'durationMin'>[]) =>
  habits.reduce((sum, h) => sum + h.durationMin, 0);

/** How long a routine occupies the timeline: its habits' total, rounded up to the 15-minute grid (at least 15). */
export const routineSpan = (minutes: number): Minutes => Math.max(GRID, Math.ceil(minutes / GRID) * GRID);

/** One routine's blocks on one day at one time: drawn as one card. */
export interface RoutineGroup {
  routineId: string;
  date: ISODate;
  start: Minutes;
  /** In routine order. */
  blocks: Block[];
}

export type DayItem = { kind: 'block'; block: Block } | { kind: 'routine'; group: RoutineGroup };

/**
 * Groups the blocks of each routine's habits that share a day and start time. A habit block moved to
 * another time by itself shows on its own. Blocks of a routine that no longer exists show on their own.
 */
export function groupByRoutine(blocks: Block[], targets: Target[], routineIds: Set<string>): DayItem[] {
  const tById = new Map(targets.map((t) => [t.id, t]));
  const groups = new Map<string, RoutineGroup>();
  const out: DayItem[] = [];
  for (const b of blocks) {
    const t = b.targetId ? tById.get(b.targetId) : undefined;
    if (!t?.routineId || !routineIds.has(t.routineId)) {
      out.push({ kind: 'block', block: b });
      continue;
    }
    const key = `${t.routineId}|${b.date}|${b.start}`;
    let g = groups.get(key);
    if (!g) {
      g = { routineId: t.routineId, date: b.date, start: b.start, blocks: [] };
      groups.set(key, g);
      out.push({ kind: 'routine', group: g });
    }
    g.blocks.push(b);
  }
  const order = (b: Block) => tById.get(b.targetId!)?.routineOrder ?? 0;
  for (const g of groups.values()) g.blocks.sort((a, b) => order(a) - order(b));
  return out;
}

/** A starter routine you can pick and then edit. Fixed, hand-written content (not AI suggestions). */
export interface RoutineTemplate {
  key: string;
  name: string;
  icon: string;
  /** Matched against your category names; none matched means no category. */
  category: string;
  start: Minutes;
  days: Weekday[];
  habits: { name: string; durationMin: number }[];
}

const EVERY_DAY: Weekday[] = [1, 2, 3, 4, 5, 6, 7];

export const ROUTINE_TEMPLATES: RoutineTemplate[] = [
  {
    key: 'morning',
    name: 'Morning routine',
    icon: 'wb_sunny',
    category: 'Health',
    start: 7 * 60,
    days: EVERY_DAY,
    habits: [
      { name: 'Sunlight outside', durationMin: 10 },
      { name: 'Treadmill', durationMin: 15 },
      { name: 'Vitamin D', durationMin: QUICK },
      { name: 'Skin care', durationMin: 5 },
    ],
  },
  {
    key: 'sleep',
    name: 'Sleep routine',
    icon: 'bedtime',
    category: 'Health',
    start: 22 * 60,
    days: EVERY_DAY,
    habits: [
      { name: 'Brush teeth', durationMin: QUICK },
      { name: 'Retinol', durationMin: QUICK },
      { name: 'Magnesium', durationMin: QUICK },
      { name: 'Read a book', durationMin: 20 },
    ],
  },
  {
    key: 'workday',
    name: 'Workday start',
    icon: 'work',
    category: 'Mind',
    start: 9 * 60,
    days: [1, 2, 3, 4, 5],
    habits: [
      { name: 'Plan top 3 tasks', durationMin: 5 },
      { name: 'Clear inbox', durationMin: 10 },
      { name: 'Water bottle filled', durationMin: QUICK },
    ],
  },
];

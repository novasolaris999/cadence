// Demo data (Settings > Demo mode, and the build container without Supabase).
// Generated relative to the real current date, so "today", the now line, and history all look live.
// Outcomes come from a seeded random generator, so every reload shows the same history.

import type { Block, Category, DayLog, Routine, Settings, Target } from '../domain/types';
import { addDays, isoWeekday, minutesOfDay, startOfWeek, today as todayISO, dateRange } from '../domain/time';
import { targetDays } from '../domain/schedule';
import { isAnytime, withRoutine } from '../domain/routines';

export const sampleSettings: Settings = {
  wakeAnchor: 7 * 60,
  sleepAnchor: 23 * 60,
  theme: 'system',
  onTimeToleranceMin: 30,
};

export const sampleCategories: Category[] = [
  { id: 'c-fit', name: 'Fitness', color: 'cat-1', sortOrder: 0 },
  { id: 'c-health', name: 'Health', color: 'cat-3', sortOrder: 1 },
  { id: 'c-people', name: 'People', color: 'cat-2', sortOrder: 2 },
  { id: 'c-mind', name: 'Mind', color: 'cat-4', sortOrder: 3 },
];

const t = (p: Partial<Target> & Pick<Target, 'id' | 'name'>): Target => ({
  categoryId: null,
  description: null,
  icon: null,
  durationMin: 60,
  frequencyPerWeek: 3,
  preferredDays: [],
  preferredStart: 9 * 60,
  windowEnd: null,
  protected: false,
  active: true,
  createdAt: null,
  routineId: null,
  routineOrder: 0,
  ...p,
});

const EVERY_DAY = [1, 2, 3, 4, 5, 6, 7] as Target['preferredDays'];

export const sampleRoutines: Routine[] = [
  {
    id: 'r-morning',
    categoryId: 'c-health',
    name: 'Morning routine',
    icon: 'wb_sunny',
    frequencyPerWeek: 7,
    preferredDays: EVERY_DAY,
    preferredStart: 6 * 60 + 45,
    protected: false,
    active: true,
    createdAt: null,
  },
  {
    id: 'r-sleep',
    categoryId: 'c-health',
    name: 'Sleep routine',
    icon: 'bedtime',
    frequencyPerWeek: 7,
    preferredDays: EVERY_DAY,
    preferredStart: 22 * 60 + 15,
    protected: false,
    active: true,
    createdAt: null,
  },
];

const inRoutine = (routineId: string, habits: (Partial<Target> & Pick<Target, 'id' | 'name' | 'durationMin'>)[]) =>
  habits.map((h, i) => withRoutine(t({ categoryId: 'c-health', ...h }), sampleRoutines.find((r) => r.id === routineId)!, i));

export const sampleTargets: Target[] = [
  ...inRoutine('r-morning', [
    { id: 't-sun', name: 'Sunlight outside', durationMin: 10, icon: 'wb_sunny' },
    { id: 't-tread', name: 'Treadmill', durationMin: 15, icon: 'directions_run', categoryId: 'c-fit' },
    { id: 't-vitd', name: 'Vitamin D', durationMin: 0, icon: 'pill' },
    { id: 't-skin', name: 'Skin care', durationMin: 5, icon: 'self_improvement' },
  ]),
  ...inRoutine('r-sleep', [
    { id: 't-teeth', name: 'Brush teeth', durationMin: 0 },
    { id: 't-retinol', name: 'Retinol', durationMin: 0 },
    { id: 't-mag', name: 'Magnesium', durationMin: 0, icon: 'pill' },
    { id: 't-book', name: 'Read a book', durationMin: 20, icon: 'menu_book', categoryId: 'c-mind' },
  ]),
  t({
    id: 't-water',
    name: 'Drink 2 L water',
    icon: 'local_cafe',
    categoryId: 'c-health',
    durationMin: 0,
    frequencyPerWeek: 7,
    preferredDays: EVERY_DAY,
    preferredStart: 0,
  }),
  t({
    id: 't-meds',
    name: 'Morning meds & supplements',
    description: 'Omega 3, D3, magnesium',
    icon: 'pill',
    categoryId: 'c-health',
    durationMin: 15,
    frequencyPerWeek: 7,
    preferredDays: [1, 2, 3, 4, 5, 6, 7],
    preferredStart: 7 * 60 + 30,
  }),
  t({
    id: 't-walk',
    name: 'Sunlight walk',
    description: 'Outside before screens',
    icon: 'wb_sunny',
    categoryId: 'c-health',
    durationMin: 30,
    frequencyPerWeek: 5,
    preferredDays: [1, 2, 3, 4, 5],
    preferredStart: 8 * 60 + 15,
  }),
  t({
    id: 't-gym',
    name: 'Gym session',
    description: 'Strength and conditioning',
    icon: 'fitness_center',
    categoryId: 'c-fit',
    durationMin: 120,
    frequencyPerWeek: 3,
    preferredDays: [1, 3, 5],
    preferredStart: 11 * 60 + 30,
    windowEnd: 14 * 60,
  }),
  t({
    id: 't-padel',
    name: 'Padel match',
    description: 'Competitive court time',
    icon: 'sports_tennis',
    categoryId: 'c-fit',
    durationMin: 90,
    frequencyPerWeek: 2,
    preferredDays: [2, 4],
    preferredStart: 17 * 60,
  }),
  t({
    id: 't-reading',
    name: 'Reading',
    description: 'Books, not feeds',
    icon: 'menu_book',
    categoryId: 'c-mind',
    durationMin: 30,
    frequencyPerWeek: 3,
    preferredDays: [],
    preferredStart: 18 * 60 + 30,
  }),
  t({
    id: 't-date',
    name: 'Date night',
    description: 'Dinner, phones away',
    icon: 'favorite',
    categoryId: 'c-people',
    durationMin: 90,
    frequencyPerWeek: 2,
    preferredDays: [3, 6],
    preferredStart: 19 * 60 + 30,
    protected: true,
  }),
  t({
    id: 't-journal',
    name: 'Evening journal',
    description: 'Review the day, prime tomorrow',
    icon: 'edit_note',
    categoryId: 'c-mind',
    durationMin: 15,
    frequencyPerWeek: 7,
    preferredDays: [1, 2, 3, 4, 5, 6, 7],
    preferredStart: 21 * 60 + 45,
  }),
  t({
    id: 't-spanish',
    name: 'Spanish practice',
    description: 'Archived example',
    icon: 'psychology',
    categoryId: 'c-mind',
    durationMin: 30,
    frequencyPerWeek: 2,
    preferredDays: [2, 4],
    preferredStart: 7 * 60 + 45,
    active: false,
  }),
];

/** Chance a past block was done, per target. Journal also gets weaker on Thu and Sat. */
const HIT_RATE: Record<string, number> = {
  't-meds': 0.96,
  't-walk': 0.82,
  't-gym': 0.88,
  't-padel': 0.92,
  't-reading': 0.5,
  't-date': 0.94,
  't-journal': 0.9,
  't-spanish': 0.6,
  't-sun': 0.85,
  't-tread': 0.7,
  't-vitd': 0.95,
  't-skin': 0.9,
  't-teeth': 0.97,
  't-retinol': 0.75,
  't-mag': 0.85,
  't-book': 0.55,
  't-water': 0.8,
};

// Small deterministic PRNG (mulberry32) so sample history is stable between reloads.
function rng(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let r = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

const hash = (s: string) => [...s].reduce((h, c) => (Math.imul(h, 31) + c.charCodeAt(0)) | 0, 7);

export function buildSampleBlocks(now = new Date()): Block[] {
  const today = todayISO(now);
  const nowMin = minutesOfDay(now);
  const from = `${today.slice(0, 4)}-01-01`;
  const to = addDays(startOfWeek(today), 13); // through next week
  const blocks: Block[] = [];

  for (const date of dateRange(from, to)) {
    const w = isoWeekday(date);
    for (const target of sampleTargets) {
      // Archived target only has history from early in the year.
      if (!target.active && date > `${today.slice(0, 4)}-04-30`) continue;
      if (!targetDays(target).includes(w)) continue;
      const rand = rng(hash(date + target.id));
      let start = target.preferredStart;
      let moved = false;
      // Occasionally a block was dragged to another time. A routine moves as a whole; anytime habits have no time.
      const moveRand = target.routineId ? rng(hash(date + target.routineId))() : rand();
      if (moveRand < 0.08 && !isAnytime(target)) {
        start += 30;
        moved = true;
      }
      const end = start + target.durationMin;
      let status: Block['status'] = 'planned';
      let completedAt: string | null = null;
      const resolved = date < today || (date === today && end <= nowMin && !isAnytime(target));
      if (resolved) {
        let p = HIT_RATE[target.id] ?? 0.8;
        if (target.id === 't-journal' && (w === 4 || w === 6)) p = 0.35;
        const r = rand();
        if (r < p) {
          status = 'done';
          const doneAt = Math.min(end + Math.floor(rand() * 20), 1439);
          completedAt = `${date}T${String(Math.floor(doneAt / 60)).padStart(2, '0')}:${String(doneAt % 60).padStart(2, '0')}`;
        } else if (r < p + 0.04) {
          status = 'skipped';
        }
      }
      blocks.push({
        id: `${target.id}-${date}`,
        targetId: target.id,
        title: target.id === 't-gym' && w === 1 ? 'Gym: heavy push day' : null,
        categoryId: null,
        date,
        start,
        durationMin: target.durationMin,
        status,
        completedAt,
        note: target.id === 't-padel' ? 'Court 4' : null,
        origin: 'generated',
        scheduledFor: date,
        moved,
      });
    }
  }

  // A one-off block today, with no target.
  blocks.push({
    id: `oneoff-${today}`,
    targetId: null,
    title: 'Dentist',
    categoryId: 'c-health',
    date: today,
    start: 15 * 60,
    durationMin: 45,
    status: 'planned',
    completedAt: null,
    note: 'Bring insurance card',
    origin: 'manual',
    scheduledFor: null,
    moved: false,
  });

  return blocks;
}

export function buildSampleDayLogs(now = new Date()): DayLog[] {
  const today = todayISO(now);
  const logs: DayLog[] = [];
  for (const date of dateRange(addDays(today, -62), today)) {
    const rand = rng(hash(`log${date}`));
    const w = isoWeekday(date);
    const wake = 7 * 60 - 10 + Math.floor(rand() * 35) + (w >= 6 ? 35 : 0);
    let sleep = 22 * 60 + 45 + Math.floor(rand() * 40);
    if (w === 6 && rand() < 0.8) sleep = 60 + Math.floor(rand() * 40); // late Saturdays
    logs.push({
      date,
      wake: rand() < 0.08 ? null : wake,
      sleep: date === today ? null : sleep,
    });
  }
  return logs;
}

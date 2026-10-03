// Core data shapes, mirroring the database schema (see SPEC.md and supabase/migrations).
// Pure types: no React, no Supabase. The data layer converts DB rows into these.

/** Local calendar date, 'YYYY-MM-DD'. Never a UTC timestamp. */
export type ISODate = string;

/** Local wall-clock time as minutes since midnight (07:30 = 450). */
export type Minutes = number;

/** ISO weekday: 1 = Monday ... 7 = Sunday. */
export type Weekday = 1 | 2 | 3 | 4 | 5 | 6 | 7;

export type BlockStatus = 'planned' | 'done' | 'skipped';
export type BlockOrigin = 'generated' | 'manual';
export type ThemePref = 'system' | 'light' | 'dark';

export const CATEGORY_COLORS = [
  'cat-1',
  'cat-2',
  'cat-3',
  'cat-4',
  'cat-5',
  'cat-6',
  'cat-7',
  'cat-8',
] as const;
export type CategoryColor = (typeof CATEGORY_COLORS)[number];

export interface Category {
  id: string;
  name: string;
  color: CategoryColor;
  sortOrder: number;
}

/** The definition of a recurring routine. */
export interface Target {
  id: string;
  categoryId: string | null;
  name: string;
  description: string | null;
  icon: string | null;
  durationMin: number;
  frequencyPerWeek: number;
  /** Empty means "any days": the scheduler spreads frequencyPerWeek across the week. */
  preferredDays: Weekday[];
  preferredStart: Minutes;
  /** Optional end of the acceptable window (preferredStart..windowEnd). */
  windowEnd: Minutes | null;
  /** The scheduler never moves or regenerates protected blocks. */
  protected: boolean;
  /** false = archived. */
  active: boolean;
  /** When the target was created (an instant, ISO 8601). Null for sample data. Used for the "new" glow. */
  createdAt: string | null;
}

/** One scheduled instance on one date. */
export interface Block {
  id: string;
  targetId: string | null;
  /** Required for one-offs; optional per-instance override for target blocks. */
  title: string | null;
  /** For one-offs. Target blocks fall back to the target's category. */
  categoryId: string | null;
  date: ISODate;
  start: Minutes;
  durationMin: number;
  status: BlockStatus;
  /** Local wall clock 'YYYY-MM-DDTHH:MM', set when status becomes 'done'. */
  completedAt: string | null;
  note: string | null;
  origin: BlockOrigin;
  /** The day the scheduler assigned. Stays fixed when the block is moved. */
  scheduledFor: ISODate | null;
  /** True once you change its date, time, or length by hand. Re-run leaves moved blocks alone. */
  moved: boolean;
}

export interface DayLog {
  date: ISODate;
  wake: Minutes | null;
  /** Bedtime for the night that starts on `date`. Values before 12:00 mean after midnight. */
  sleep: Minutes | null;
}

export interface Settings {
  wakeAnchor: Minutes;
  sleepAnchor: Minutes;
  theme: ThemePref;
  onTimeToleranceMin: number;
}

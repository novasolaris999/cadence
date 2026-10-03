// Converts between database rows (snake_case, 'HH:MM:SS' times) and app shapes
// (camelCase, minutes since midnight). Pure functions, unit tested.

import { formatTime, parseTime } from '../domain/time';
import type { Block, BlockOrigin, BlockStatus, Category, CategoryColor, DayLog, Settings, Target, ThemePref, Weekday } from '../domain/types';

export interface SettingsRow {
  wake_anchor: string;
  sleep_anchor: string;
  theme: ThemePref;
  on_time_tolerance_min: number;
}
export interface CategoryRow {
  id: string;
  name: string;
  color: string;
  sort_order: number;
}
export interface TargetRow {
  id: string;
  category_id: string | null;
  name: string;
  description: string | null;
  icon: string | null;
  duration_min: number;
  frequency_per_week: number;
  preferred_days: number[];
  preferred_start: string;
  window_end: string | null;
  protected: boolean;
  active: boolean;
}
export interface BlockRow {
  id: string;
  target_id: string | null;
  title: string | null;
  category_id: string | null;
  date: string;
  start_time: string;
  duration_min: number;
  status: BlockStatus;
  completed_at: string | null;
  note: string | null;
  origin: BlockOrigin;
  scheduled_for: string | null;
  moved: boolean;
}
export interface DayLogRow {
  date: string;
  wake_time: string | null;
  sleep_time: string | null;
}

const time = (m: number) => `${formatTime(m)}:00`;
/** Postgres returns timestamps as 'YYYY-MM-DDTHH:MM:SS' or 'YYYY-MM-DD HH:MM:SS'. */
const stamp = (s: string | null) => (s ? s.replace(' ', 'T').slice(0, 16) : null);

export const settingsFromRow = (r: SettingsRow): Settings => ({
  wakeAnchor: parseTime(r.wake_anchor),
  sleepAnchor: parseTime(r.sleep_anchor),
  theme: r.theme,
  onTimeToleranceMin: r.on_time_tolerance_min,
});

export function settingsToRow(s: Partial<Settings>): Partial<SettingsRow> {
  const r: Partial<SettingsRow> = {};
  if (s.wakeAnchor !== undefined) r.wake_anchor = time(s.wakeAnchor);
  if (s.sleepAnchor !== undefined) r.sleep_anchor = time(s.sleepAnchor);
  if (s.theme !== undefined) r.theme = s.theme;
  if (s.onTimeToleranceMin !== undefined) r.on_time_tolerance_min = s.onTimeToleranceMin;
  return r;
}

export const categoryFromRow = (r: CategoryRow): Category => ({
  id: r.id,
  name: r.name,
  color: r.color as CategoryColor,
  sortOrder: r.sort_order,
});

export const categoryToRow = (c: Category): CategoryRow => ({
  id: c.id,
  name: c.name.trim(),
  color: c.color,
  sort_order: c.sortOrder,
});

export const targetFromRow = (r: TargetRow): Target => ({
  id: r.id,
  categoryId: r.category_id,
  name: r.name,
  description: r.description,
  icon: r.icon,
  durationMin: r.duration_min,
  frequencyPerWeek: r.frequency_per_week,
  preferredDays: [...r.preferred_days].sort((a, b) => a - b) as Weekday[],
  preferredStart: parseTime(r.preferred_start),
  windowEnd: r.window_end === null ? null : parseTime(r.window_end),
  protected: r.protected,
  active: r.active,
});

export function targetToRow(t: Target): TargetRow {
  const days = [...new Set(t.preferredDays)].sort((a, b) => a - b);
  return {
    id: t.id,
    category_id: t.categoryId,
    name: t.name.trim(),
    description: t.description?.trim() || null,
    icon: t.icon,
    duration_min: t.durationMin,
    // Picked days decide the frequency (the database checks this too).
    frequency_per_week: days.length || t.frequencyPerWeek,
    preferred_days: days,
    preferred_start: time(t.preferredStart),
    window_end: t.windowEnd === null ? null : time(t.windowEnd),
    protected: t.protected,
    active: t.active,
  };
}

export const blockFromRow = (r: BlockRow): Block => ({
  id: r.id,
  targetId: r.target_id,
  title: r.title,
  categoryId: r.category_id,
  date: r.date,
  start: parseTime(r.start_time),
  durationMin: r.duration_min,
  status: r.status,
  completedAt: stamp(r.completed_at),
  note: r.note,
  origin: r.origin,
  scheduledFor: r.scheduled_for,
  moved: r.moved,
});

export const blockToRow = (b: Block): BlockRow => ({
  id: b.id,
  target_id: b.targetId,
  title: b.title,
  category_id: b.categoryId,
  date: b.date,
  start_time: time(b.start),
  duration_min: b.durationMin,
  status: b.status,
  completed_at: b.completedAt,
  note: b.note,
  origin: b.origin,
  scheduled_for: b.scheduledFor,
  moved: b.moved,
});

/** Converts only the fields present in a partial update. */
export function blockPatchToRow(p: Partial<Omit<Block, 'id'>>): Partial<BlockRow> {
  const r: Partial<BlockRow> = {};
  if (p.targetId !== undefined) r.target_id = p.targetId;
  if (p.title !== undefined) r.title = p.title;
  if (p.categoryId !== undefined) r.category_id = p.categoryId;
  if (p.date !== undefined) r.date = p.date;
  if (p.start !== undefined) r.start_time = time(p.start);
  if (p.durationMin !== undefined) r.duration_min = p.durationMin;
  if (p.status !== undefined) r.status = p.status;
  if (p.completedAt !== undefined) r.completed_at = p.completedAt;
  if (p.note !== undefined) r.note = p.note;
  if (p.origin !== undefined) r.origin = p.origin;
  if (p.scheduledFor !== undefined) r.scheduled_for = p.scheduledFor;
  if (p.moved !== undefined) r.moved = p.moved;
  return r;
}

export const dayLogFromRow = (r: DayLogRow): DayLog => ({
  date: r.date,
  wake: r.wake_time === null ? null : parseTime(r.wake_time),
  sleep: r.sleep_time === null ? null : parseTime(r.sleep_time),
});

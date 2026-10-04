// Capture: turns what Claude proposed into things Cadence can preview and save. Pure functions.
//
// Claude's reply is treated as untrusted input: every field is checked and fitted to the app's rules here
// (dates, 15-minute grid, lengths, known lists and categories). Anything that does not fit is dropped and
// counted, never saved half-right. Nothing is saved until the owner confirms the preview.

import { isAnytime, withRoutine } from './routines';
import type { Block, Category, ISODate, Minutes, Routine, Target, Todo, TodoList, Weekday } from './types';

/** What the app sends to the capture function. Names only: no ids or history leave the device. */
export interface CaptureRequest {
  text: string;
  transcript: { role: 'user' | 'assistant'; text: string }[];
  now: { date: ISODate; time: string; weekday: number };
  context: {
    lists: string[];
    categories: string[];
    routines: { name: string; days: number[]; start: string }[];
    habits: string[];
  };
}

/** What the capture function returns. */
export interface CaptureReply {
  actions: { tool: string; input: unknown }[];
  question: { text: string; options: string[] } | null;
  message: string | null;
  model: string;
}

export type Proposal =
  | {
      kind: 'todo';
      title: string;
      listId: string | null;
      dueDate: ISODate | null;
      dueTime: Minutes | null;
      durationMin: number | null;
      starred: boolean;
      note: string | null;
    }
  | {
      kind: 'habit';
      name: string;
      days: Weekday[];
      timesPerWeek: number;
      /** Null for a quick habit with no time (Anytime), or when it joins a routine (the routine's time). */
      start: Minutes | null;
      durationMin: number;
      categoryId: string | null;
      routineId: string | null;
    }
  | {
      kind: 'routine';
      name: string;
      days: Weekday[];
      start: Minutes;
      categoryId: string | null;
      habits: { name: string; durationMin: number }[];
    }
  | {
      kind: 'block';
      title: string;
      date: ISODate;
      start: Minutes;
      durationMin: number;
      categoryId: string | null;
      note: string | null;
    };

export interface CaptureContext {
  lists: TodoList[];
  categories: Category[];
  routines: Routine[];
}

const LAST_SLOT = 23 * 60 + 45;

const text = (v: unknown, max: number): string | null => {
  if (typeof v !== 'string') return null;
  const t = v.trim().replace(/\s+/g, ' ');
  return t ? t.slice(0, max) : null;
};

/** A real calendar date in YYYY-MM-DD, or null. */
export function readDate(v: unknown): ISODate | null {
  if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return null;
  const [y, m, d] = v.split('-').map(Number) as [number, number, number];
  const probe = new Date(Date.UTC(y, m - 1, d));
  return probe.getUTCFullYear() === y && probe.getUTCMonth() === m - 1 && probe.getUTCDate() === d ? v : null;
}

/** "HH:MM" to minutes since midnight, rounded to the 15-minute grid, or null. */
export function readTime(v: unknown): Minutes | null {
  if (typeof v !== 'string') return null;
  const m = /^(\d{1,2}):(\d{2})$/.exec(v.trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return null;
  return Math.min(LAST_SLOT, Math.round((h * 60 + min) / 15) * 15);
}

/** Minutes rounded to `step`, kept within min..max; `fallback` when missing. */
function readLength(v: unknown, step: number, min: number, max: number, fallback: number): number {
  if (typeof v !== 'number' || !Number.isFinite(v)) return fallback;
  return Math.min(max, Math.max(min, Math.round(v / step) * step));
}

/** ISO weekdays, unique and in order. */
export function readDays(v: unknown): Weekday[] {
  if (!Array.isArray(v)) return [];
  return [...new Set(v.filter((d): d is Weekday => Number.isInteger(d) && d >= 1 && d <= 7))].sort((a, b) => a - b);
}

/** Matches a name to one of the owner's items, ignoring case and spacing. */
function byName<T extends { name: string }>(items: T[], v: unknown): T | null {
  const want = text(v, 80)?.toLowerCase();
  return want ? (items.find((i) => i.name.trim().toLowerCase() === want) ?? null) : null;
}

/** One proposal from one tool call, or null when it cannot be made valid. */
export function readProposal(tool: string, input: unknown, ctx: CaptureContext): Proposal | null {
  const o = (input ?? {}) as Record<string, unknown>;
  const category = () => byName(ctx.categories, o.category)?.id ?? null;

  if (tool === 'add_todo') {
    const title = text(o.title, 200);
    if (!title) return null;
    const dueDate = readDate(o.due_date);
    const dueTime = dueDate ? readTime(o.due_time) : null;
    return {
      kind: 'todo',
      title,
      // An unknown list name goes to the first list rather than nowhere.
      listId: byName(ctx.lists, o.list)?.id ?? ctx.lists[0]?.id ?? null,
      dueDate,
      dueTime,
      durationMin: dueTime === null ? null : readLength(o.duration_min, 15, 15, 720, 30),
      starred: o.starred === true,
      note: text(o.note, 500),
    };
  }

  if (tool === 'add_habit') {
    const name = text(o.name, 80);
    if (!name) return null;
    const routine = byName(
      ctx.routines.filter((r) => r.active),
      o.routine,
    );
    const days = routine ? [...routine.preferredDays] : readDays(o.days);
    const timesPerWeek = days.length || readLength(o.times_per_week, 1, 1, 7, 0);
    if (!routine && timesPerWeek === 0) return null; // no days and no frequency: Claude should have asked
    // In a routine, 5-minute steps; on its own, quick or the 15-minute grid.
    const durationMin = routine ? readLength(o.duration_min, 5, 0, 240, 0) : readLength(o.duration_min, 15, 0, 720, 0);
    const start = routine ? null : readTime(o.start_time);
    if (!routine && durationMin > 0 && start === null) return null; // a timed habit needs a time
    return {
      kind: 'habit',
      name,
      days,
      timesPerWeek: routine ? routine.frequencyPerWeek : timesPerWeek,
      // A quick habit on its own has no time in Cadence: it goes to Anytime.
      start: durationMin === 0 ? null : start,
      durationMin,
      categoryId: category(),
      routineId: routine?.id ?? null,
    };
  }

  if (tool === 'add_routine') {
    const name = text(o.name, 80);
    const start = readTime(o.start_time);
    const days = readDays(o.days);
    const habits = (Array.isArray(o.habits) ? o.habits : [])
      .map((h) => (h ?? {}) as Record<string, unknown>)
      .map((h) => ({ name: text(h.name, 80), durationMin: readLength(h.duration_min, 5, 0, 240, 0) }))
      .filter((h): h is { name: string; durationMin: number } => h.name !== null)
      .slice(0, 20);
    if (!name || start === null || days.length === 0 || habits.length === 0) return null;
    return { kind: 'routine', name, days, start, categoryId: category(), habits };
  }

  if (tool === 'add_block') {
    const title = text(o.title, 200);
    const date = readDate(o.date);
    const start = readTime(o.start_time);
    if (!title || !date || start === null) return null;
    return {
      kind: 'block',
      title,
      date,
      start,
      durationMin: Math.min(readLength(o.duration_min, 15, 15, 720, 60), 24 * 60 - start),
      categoryId: category(),
      note: text(o.note, 500),
    };
  }

  return null;
}

/** All proposals from a reply, plus how many could not be used. */
export function readProposals(reply: Pick<CaptureReply, 'actions'>, ctx: CaptureContext): { proposals: Proposal[]; dropped: number } {
  const proposals = reply.actions.map((a) => readProposal(a.tool, a.input, ctx));
  const ok = proposals.filter((p): p is Proposal => p !== null);
  return { proposals: ok, dropped: proposals.length - ok.length };
}

// ---------- Building the records to save, once confirmed ----------

export function buildTodo(p: Extract<Proposal, { kind: 'todo' }>, id: string, createdAt: string): Todo {
  return {
    id,
    listId: p.listId,
    title: p.title,
    note: p.note,
    starred: p.starred,
    dueDate: p.dueDate,
    dueTime: p.dueTime,
    durationMin: p.dueTime === null ? null : p.durationMin,
    completedAt: null,
    sortOrder: 0,
    createdAt,
  };
}

/**
 * A habit, ready for saveTarget. Joining a routine copies the routine's days and time and puts the habit last
 * (`order` = how many habits the routine already has).
 */
export function buildHabit(
  p: Extract<Proposal, { kind: 'habit' }>,
  id: string,
  createdAt: string,
  routine: Routine | null,
  order: number,
): Target {
  const habit: Target = {
    id,
    categoryId: p.categoryId ?? routine?.categoryId ?? null,
    name: p.name,
    description: null,
    icon: routine ? null : 'check_circle',
    durationMin: p.durationMin,
    frequencyPerWeek: p.timesPerWeek,
    preferredDays: p.days,
    preferredStart: p.start ?? 0,
    windowEnd: null,
    protected: false,
    active: true,
    createdAt,
    routineId: null,
    routineOrder: 0,
  };
  return routine ? withRoutine(habit, routine, order) : habit;
}

export function buildRoutine(
  p: Extract<Proposal, { kind: 'routine' }>,
  newId: () => string,
  createdAt: string,
): { routine: Routine; habits: Target[] } {
  const routine: Routine = {
    id: newId(),
    categoryId: p.categoryId,
    name: p.name,
    icon: null,
    frequencyPerWeek: p.days.length,
    preferredDays: p.days,
    preferredStart: p.start,
    protected: false,
    active: true,
    createdAt,
  };
  const habits = p.habits.map((h, i) =>
    withRoutine(
      {
        id: newId(),
        categoryId: p.categoryId,
        name: h.name,
        description: null,
        icon: null,
        durationMin: h.durationMin,
        frequencyPerWeek: routine.frequencyPerWeek,
        preferredDays: [],
        preferredStart: 0,
        windowEnd: null,
        protected: false,
        active: true,
        createdAt,
        routineId: null,
        routineOrder: 0,
      },
      routine,
      i,
    ),
  );
  return { routine, habits };
}

export function buildBlock(p: Extract<Proposal, { kind: 'block' }>, id: string): Block {
  return {
    id,
    targetId: null,
    title: p.title,
    categoryId: p.categoryId,
    date: p.date,
    start: p.start,
    durationMin: p.durationMin,
    status: 'planned',
    completedAt: null,
    note: p.note,
    origin: 'manual',
    scheduledFor: null,
    moved: false,
  };
}

/** True when a habit proposal would land in Anytime (quick, not in a routine). */
export const habitIsAnytime = (p: Extract<Proposal, { kind: 'habit' }>) =>
  isAnytime({ durationMin: p.durationMin, routineId: p.routineId });

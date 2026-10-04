// Demo implementation: in-memory sample data. Changes last until reload.
import type { DataApi } from './api';
import { sampleStore } from '../sample/store';
import { demoCapture } from '../sample/demoCapture';
import { addDays, startOfWeek, today } from '../domain/time';

const byDateStart = (a: { date: string; start: number }, b: { date: string; start: number }) =>
  a.date === b.date ? a.start - b.start : a.date < b.date ? -1 : 1;

// The sample history already covers this week and next, so those count as planned.
const plannedWeeks = new Set<string>([startOfWeek(today()), addDays(startOfWeek(today()), 7)]);

export const sampleApi: DataApi = {
  mode: 'demo',
  ensureSetup: async () => {},

  getSettings: async () => ({ ...sampleStore.settings }),
  updateSettings: async (patch) => {
    Object.assign(sampleStore.settings, patch);
  },

  listCategories: async () => [...sampleStore.categories].sort((a, b) => a.sortOrder - b.sortOrder),
  saveCategory: async (c) => {
    const i = sampleStore.categories.findIndex((x) => x.id === c.id);
    if (i >= 0) sampleStore.categories[i] = c;
    else sampleStore.categories.push(c);
  },
  deleteCategory: async (id) => {
    sampleStore.categories = sampleStore.categories.filter((c) => c.id !== id);
    for (const t of sampleStore.targets) if (t.categoryId === id) t.categoryId = null;
  },

  listTargets: async () => sampleStore.targets.map((t) => ({ ...t })),
  saveTarget: async (t) => {
    const i = sampleStore.targets.findIndex((x) => x.id === t.id);
    if (i >= 0) sampleStore.targets[i] = t;
    else sampleStore.targets.push(t);
  },

  listRoutines: async () => sampleStore.routines.map((r) => ({ ...r })),
  saveRoutine: async (r) => {
    const i = sampleStore.routines.findIndex((x) => x.id === r.id);
    if (i >= 0) sampleStore.routines[i] = r;
    else sampleStore.routines.push(r);
  },

  listTodoLists: async () => [...sampleStore.todoLists].sort((a, b) => a.sortOrder - b.sortOrder),
  saveTodoList: async (l) => {
    const i = sampleStore.todoLists.findIndex((x) => x.id === l.id);
    if (i >= 0) sampleStore.todoLists[i] = l;
    else sampleStore.todoLists.push(l);
  },
  deleteTodoList: async (id) => {
    sampleStore.todoLists = sampleStore.todoLists.filter((l) => l.id !== id);
    for (const t of sampleStore.todos) if (t.listId === id) t.listId = null;
  },
  listTodos: async () => sampleStore.todos.map((t) => ({ ...t })),
  saveTodo: async (t) => {
    const i = sampleStore.todos.findIndex((x) => x.id === t.id);
    if (i >= 0) sampleStore.todos[i] = t;
    else sampleStore.todos.push(t);
  },
  updateTodo: async (id, patch) => {
    const t = sampleStore.todos.find((x) => x.id === id);
    if (t) Object.assign(t, patch);
  },
  deleteTodos: async (ids) => {
    sampleStore.todos = sampleStore.todos.filter((t) => !ids.includes(t.id));
  },
  capture: async (req) => demoCapture(req),

  listBlocks: async (from, to) =>
    sampleStore.blocks.filter((b) => b.date >= from && b.date <= to).map((b) => ({ ...b })).sort(byDateStart),
  listTargetBlocks: async (targetId, from) =>
    sampleStore.blocks.filter((b) => b.targetId === targetId && b.date >= from).map((b) => ({ ...b })).sort(byDateStart),
  createBlock: async (b) => {
    sampleStore.blocks.push(b);
  },
  updateBlock: async (id, patch) => {
    const b = sampleStore.blocks.find((x) => x.id === id);
    if (b) Object.assign(b, patch);
  },
  deleteBlock: async (id) => {
    sampleStore.blocks = sampleStore.blocks.filter((b) => b.id !== id);
  },
  applyMove: async (plan) => {
    for (const c of plan.blocks) {
      const b = sampleStore.blocks.find((x) => x.id === c.id);
      if (b) Object.assign(b, { start: c.start, moved: c.moved });
    }
    for (const patch of plan.targets ?? []) {
      const t = sampleStore.targets.find((x) => x.id === patch.id);
      if (t) Object.assign(t, patch);
    }
    if (plan.routine) {
      const r = sampleStore.routines.find((x) => x.id === plan.routine!.id);
      if (r) Object.assign(r, plan.routine);
    }
  },

  insertBlocks: async (blocks) => {
    const taken = new Set(sampleStore.blocks.map((b) => `${b.targetId}|${b.scheduledFor}`));
    for (const b of blocks) if (!taken.has(`${b.targetId}|${b.scheduledFor}`)) sampleStore.blocks.push(b);
  },
  deleteBlocks: async (ids) => {
    const drop = new Set(ids);
    sampleStore.blocks = sampleStore.blocks.filter((b) => !drop.has(b.id));
  },

  listPlannedWeeks: async (from) => [...plannedWeeks].filter((w) => w >= from).sort(),
  markWeekPlanned: async (weekStart) => {
    plannedWeeks.add(weekStart);
  },

  listDayLogs: async (from, to) => sampleStore.dayLogs.filter((l) => l.date >= from && l.date <= to),
  saveDayLog: async (log) => {
    sampleStore.dayLogs = [...sampleStore.dayLogs.filter((l) => l.date !== log.date), log];
  },
};

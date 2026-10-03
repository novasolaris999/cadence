// Demo implementation: in-memory sample data. Changes last until reload.
import type { DataApi } from './api';
import { sampleStore } from '../sample/store';

const byDateStart = (a: { date: string; start: number }, b: { date: string; start: number }) =>
  a.date === b.date ? a.start - b.start : a.date < b.date ? -1 : 1;

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
    if (plan.target) {
      const t = sampleStore.targets.find((x) => x.id === plan.target!.id);
      if (t) Object.assign(t, plan.target);
    }
  },

  listDayLogs: async (from, to) => sampleStore.dayLogs.filter((l) => l.date >= from && l.date <= to),
};

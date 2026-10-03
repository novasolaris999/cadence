// The only module screens use to read and write data.
//
// Every hook goes through `api` (Supabase, or demo data when Supabase is not configured).
// TanStack Query caches results by key, refetches when you come back to the app, and lets
// mutations update the screen before the save finishes (optimistic updates).

import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import type { MovePlan } from '../domain/moves';
import type { Block, Category, DayLog, ISODate, Settings, Target } from '../domain/types';
import { ensureSetup, getApi, isDemo, setDemo } from './index';
import { localNowStamp } from './localStamp';
import { ensureWeek, syncTarget } from './scheduling';
import { startOfWeek, today as todayISO } from '../domain/time';

// Every cache key starts with the data mode ('supabase' or 'demo'), so real and demo results
// can never be mixed up in the cache, even if a request finishes just after you switch.
const mode = () => getApi().mode;

export const keys = {
  settings: () => [mode(), 'settings'] as const,
  categories: () => [mode(), 'categories'] as const,
  targets: () => [mode(), 'targets'] as const,
  blocks: (from: ISODate, to: ISODate) => [mode(), 'blocks', from, to] as const,
  allBlocks: () => [mode(), 'blocks'] as const,
  targetBlocks: (targetId: string | null, from: ISODate) => [mode(), 'blocks', 'target', targetId, from] as const,
  dayLogs: (from: ISODate, to: ISODate) => [mode(), 'dayLogs', from, to] as const,
};

/**
 * Switches between your real data and demo data. The mode you leave has its cached results
 * dropped, so coming back always loads fresh.
 */
export function useSetDemoMode() {
  const qc = useQueryClient();
  return (on: boolean) => {
    if (on === isDemo()) return;
    const leaving = getApi().mode;
    setDemo(on);
    qc.removeQueries({ queryKey: [leaving] });
  };
}

/** Creates your settings row and default categories on first sign-in. Other reads wait for it. */
export function useSetup(enabled: boolean) {
  return useQuery({ queryKey: ['setup'], queryFn: () => ensureSetup().then(() => true), enabled, staleTime: Infinity });
}

export function useSettings() {
  return useQuery<Settings>({ queryKey: keys.settings(), queryFn: () => getApi().getSettings() });
}

export function useUpdateSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (patch: Partial<Settings>) => getApi().updateSettings(patch),
    onMutate: (patch) => {
      qc.setQueryData<Settings>(keys.settings(), (s) => (s ? { ...s, ...patch } : s));
    },
    onSettled: () => qc.invalidateQueries({ queryKey: keys.settings() }),
  });
}

export function useCategories() {
  return useQuery<Category[]>({ queryKey: keys.categories(), queryFn: () => getApi().listCategories() });
}

export function useSaveCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (c: Category) => getApi().saveCategory(c),
    onSettled: () => qc.invalidateQueries({ queryKey: keys.categories() }),
  });
}

export function useDeleteCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => getApi().deleteCategory(id),
    onSettled: () => {
      qc.invalidateQueries({ queryKey: keys.categories() });
      qc.invalidateQueries({ queryKey: keys.targets() });
    },
  });
}

export function useTargets() {
  return useQuery<Target[]>({ queryKey: keys.targets(), queryFn: () => getApi().listTargets() });
}

/**
 * Create or update a target (create, edit, archive, restore all go through here), then bring its
 * upcoming blocks in line with the new rules.
 */
export function useSaveTarget() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (t: Target) => {
      const api = getApi();
      await api.saveTarget(t);
      await syncTarget(api, t);
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: keys.targets() });
      qc.invalidateQueries({ queryKey: keys.allBlocks() });
    },
  });
}

/**
 * Fills a week from your targets the first time it is shown (this week or later only).
 * Runs once per week per session; the database remembers which weeks are done.
 */
export function useEnsureWeek(weekStart: ISODate) {
  const qc = useQueryClient();
  const current = startOfWeek(todayISO());
  return useQuery({
    queryKey: [mode(), 'ensureWeek', weekStart],
    enabled: weekStart >= current,
    staleTime: Infinity,
    retry: 2,
    queryFn: async () => {
      const added = await ensureWeek(getApi(), weekStart);
      if (added) await qc.invalidateQueries({ queryKey: keys.allBlocks() });
      return true;
    },
  });
}

/** Blocks with from <= date <= to, ordered by date then start time. */
export function useBlocks(from: ISODate, to: ISODate) {
  return useQuery<Block[]>({ queryKey: keys.blocks(from, to), queryFn: () => getApi().listBlocks(from, to) });
}

/** One target's blocks from a date on, for move planning. */
export function useTargetBlocks(targetId: string | null, from: ISODate) {
  return useQuery<Block[]>({
    queryKey: keys.targetBlocks(targetId, from),
    enabled: targetId !== null,
    queryFn: () => getApi().listTargetBlocks(targetId!, from),
  });
}

export function useDayLogs(from: ISODate, to: ISODate) {
  return useQuery<DayLog[]>({ queryKey: keys.dayLogs(from, to), queryFn: () => getApi().listDayLogs(from, to) });
}

/** Saves wake or sleep time for one date. Shows instantly, saves in the background. */
export function useSaveDayLog() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (log: DayLog) => getApi().saveDayLog(log),
    onMutate: async (log) => {
      const key = [mode(), 'dayLogs'];
      await qc.cancelQueries({ queryKey: key });
      const before = qc.getQueriesData<DayLog[]>({ queryKey: key });
      qc.setQueriesData<DayLog[]>({ queryKey: key }, (list) =>
        list ? [...list.filter((l) => l.date !== log.date), log] : list,
      );
      return { undo: () => before.forEach(([k, d]) => qc.setQueryData(k, d)) };
    },
    onError: (_e, _v, ctx) => ctx?.undo(),
    onSettled: () => qc.invalidateQueries({ queryKey: [mode(), 'dayLogs'] }),
  });
}

/** Applies a change to every cached block list right away; returns a function that undoes it. */
function patchCachedBlocks(qc: QueryClient, id: string, patch: Partial<Block>) {
  const before = qc.getQueriesData<Block[]>({ queryKey: keys.allBlocks() });
  qc.setQueriesData<Block[]>({ queryKey: keys.allBlocks() }, (list) =>
    list?.map((b) => (b.id === id ? { ...b, ...patch } : b)),
  );
  return () => before.forEach(([key, data]) => qc.setQueryData(key, data));
}

/** Status changes keep completed_at consistent: set when done, cleared otherwise. */
export function statusPatch(status: Block['status'], current: Block): Partial<Block> {
  if (status === 'done') return { status, completedAt: current.completedAt ?? localNowStamp() };
  return { status, completedAt: null };
}

/** One-tap complete: planned or skipped -> done, done -> planned. The check appears instantly. */
export function useToggleBlockDone() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ block }: { block: Block }) => getApi().updateBlock(block.id, statusPatch(block.status === 'done' ? 'planned' : 'done', block)),
    onMutate: async ({ block }) => {
      await qc.cancelQueries({ queryKey: keys.allBlocks() });
      return { undo: patchCachedBlocks(qc, block.id, statusPatch(block.status === 'done' ? 'planned' : 'done', block)) };
    },
    onError: (_e, _v, ctx) => ctx?.undo(),
    onSettled: () => qc.invalidateQueries({ queryKey: keys.allBlocks() }),
  });
}

export function useCreateBlock() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (block: Block) => getApi().createBlock(block),
    onSettled: () => qc.invalidateQueries({ queryKey: keys.allBlocks() }),
  });
}

export function useUpdateBlock() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Partial<Omit<Block, 'id'>> }) => getApi().updateBlock(id, patch),
    onMutate: async ({ id, patch }) => {
      await qc.cancelQueries({ queryKey: keys.allBlocks() });
      return { undo: patchCachedBlocks(qc, id, patch) };
    },
    onError: (_e, _v, ctx) => ctx?.undo(),
    onSettled: () => qc.invalidateQueries({ queryKey: keys.allBlocks() }),
  });
}

export function useDeleteBlock() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => getApi().deleteBlock(id),
    onSettled: () => qc.invalidateQueries({ queryKey: keys.allBlocks() }),
  });
}

/** Applies a move plan from domain/moves.ts: block times, and the target's time for "all future". */
export function useApplyMove() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (plan: MovePlan) => getApi().applyMove(plan),
    onMutate: async (plan) => {
      await qc.cancelQueries({ queryKey: keys.allBlocks() });
      const undos = plan.blocks.map((c) => patchCachedBlocks(qc, c.id, { start: c.start, moved: c.moved }));
      return { undo: () => undos.reverse().forEach((u) => u()) };
    },
    onError: (_e, _v, ctx) => ctx?.undo(),
    onSettled: () => {
      qc.invalidateQueries({ queryKey: keys.allBlocks() });
      qc.invalidateQueries({ queryKey: keys.targets() });
    },
  });
}

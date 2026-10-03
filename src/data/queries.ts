// The only module screens use to read and write data.
//
// Every hook goes through `api` (Supabase, or demo data when Supabase is not configured).
// TanStack Query caches results by key, refetches when you come back to the app, and lets
// mutations update the screen before the save finishes (optimistic updates).

import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import type { MovePlan } from '../domain/moves';
import type { Block, Category, DayLog, ISODate, Settings, Target } from '../domain/types';
import { api } from './index';
import { localNowStamp } from './localStamp';

export const keys = {
  setup: ['setup'] as const,
  settings: ['settings'] as const,
  categories: ['categories'] as const,
  targets: ['targets'] as const,
  blocks: (from: ISODate, to: ISODate) => ['blocks', from, to] as const,
  allBlocks: ['blocks'] as const,
  targetBlocks: (targetId: string | null, from: ISODate) => ['blocks', 'target', targetId, from] as const,
  dayLogs: (from: ISODate, to: ISODate) => ['dayLogs', from, to] as const,
};

export const dataMode = api.mode;

/** Creates your settings row and default categories on first sign-in. Other reads wait for it. */
export function useSetup(enabled: boolean) {
  return useQuery({ queryKey: keys.setup, queryFn: () => api.ensureSetup().then(() => true), enabled, staleTime: Infinity });
}

export function useSettings() {
  return useQuery<Settings>({ queryKey: keys.settings, queryFn: api.getSettings });
}

export function useUpdateSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (patch: Partial<Settings>) => api.updateSettings(patch),
    onMutate: (patch) => {
      qc.setQueryData<Settings>(keys.settings, (s) => (s ? { ...s, ...patch } : s));
    },
    onSettled: () => qc.invalidateQueries({ queryKey: keys.settings }),
  });
}

export function useCategories() {
  return useQuery<Category[]>({ queryKey: keys.categories, queryFn: api.listCategories });
}

export function useSaveCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (c: Category) => api.saveCategory(c),
    onSettled: () => qc.invalidateQueries({ queryKey: keys.categories }),
  });
}

export function useDeleteCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.deleteCategory(id),
    onSettled: () => {
      qc.invalidateQueries({ queryKey: keys.categories });
      qc.invalidateQueries({ queryKey: keys.targets });
    },
  });
}

export function useTargets() {
  return useQuery<Target[]>({ queryKey: keys.targets, queryFn: api.listTargets });
}

/** Create or update a target (create, edit, archive, restore all go through here). */
export function useSaveTarget() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (t: Target) => api.saveTarget(t),
    onSettled: () => qc.invalidateQueries({ queryKey: keys.targets }),
  });
}

/** Blocks with from <= date <= to, ordered by date then start time. */
export function useBlocks(from: ISODate, to: ISODate) {
  return useQuery<Block[]>({ queryKey: keys.blocks(from, to), queryFn: () => api.listBlocks(from, to) });
}

/** One target's blocks from a date on, for move planning. */
export function useTargetBlocks(targetId: string | null, from: ISODate) {
  return useQuery<Block[]>({
    queryKey: keys.targetBlocks(targetId, from),
    enabled: targetId !== null,
    queryFn: () => api.listTargetBlocks(targetId!, from),
  });
}

export function useDayLogs(from: ISODate, to: ISODate) {
  return useQuery<DayLog[]>({ queryKey: keys.dayLogs(from, to), queryFn: () => api.listDayLogs(from, to) });
}

/** Applies a change to every cached block list right away; returns a function that undoes it. */
function patchCachedBlocks(qc: QueryClient, id: string, patch: Partial<Block>) {
  const before = qc.getQueriesData<Block[]>({ queryKey: keys.allBlocks });
  qc.setQueriesData<Block[]>({ queryKey: keys.allBlocks }, (list) =>
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
    mutationFn: ({ block }: { block: Block }) => api.updateBlock(block.id, statusPatch(block.status === 'done' ? 'planned' : 'done', block)),
    onMutate: async ({ block }) => {
      await qc.cancelQueries({ queryKey: keys.allBlocks });
      return { undo: patchCachedBlocks(qc, block.id, statusPatch(block.status === 'done' ? 'planned' : 'done', block)) };
    },
    onError: (_e, _v, ctx) => ctx?.undo(),
    onSettled: () => qc.invalidateQueries({ queryKey: keys.allBlocks }),
  });
}

export function useCreateBlock() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (block: Block) => api.createBlock(block),
    onSettled: () => qc.invalidateQueries({ queryKey: keys.allBlocks }),
  });
}

export function useUpdateBlock() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Partial<Omit<Block, 'id'>> }) => api.updateBlock(id, patch),
    onMutate: async ({ id, patch }) => {
      await qc.cancelQueries({ queryKey: keys.allBlocks });
      return { undo: patchCachedBlocks(qc, id, patch) };
    },
    onError: (_e, _v, ctx) => ctx?.undo(),
    onSettled: () => qc.invalidateQueries({ queryKey: keys.allBlocks }),
  });
}

export function useDeleteBlock() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.deleteBlock(id),
    onSettled: () => qc.invalidateQueries({ queryKey: keys.allBlocks }),
  });
}

/** Applies a move plan from domain/moves.ts: block times, and the target's time for "all future". */
export function useApplyMove() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (plan: MovePlan) => api.applyMove(plan),
    onMutate: async (plan) => {
      await qc.cancelQueries({ queryKey: keys.allBlocks });
      const undos = plan.blocks.map((c) => patchCachedBlocks(qc, c.id, { start: c.start, moved: c.moved }));
      return { undo: () => undos.reverse().forEach((u) => u()) };
    },
    onError: (_e, _v, ctx) => ctx?.undo(),
    onSettled: () => {
      qc.invalidateQueries({ queryKey: keys.allBlocks });
      qc.invalidateQueries({ queryKey: keys.targets });
    },
  });
}

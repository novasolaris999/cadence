// The only module screens use to read and write data.
//
// Phase 1: every query reads the in-memory sample store. Phase 2 swaps the insides of these
// functions for Supabase calls; the hook names and return shapes stay the same, so screens
// do not change. TanStack Query caches results by key and lets mutations update the screen
// instantly (optimistic updates) while the save happens in the background.

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Block, Category, DayLog, ISODate, Settings, Target } from '../domain/types';
import { sampleStore } from '../sample/store';
import type { MovePlan } from '../domain/moves';
import { localNowStamp } from './localStamp';

export const keys = {
  settings: ['settings'] as const,
  categories: ['categories'] as const,
  targets: ['targets'] as const,
  blocks: (from: ISODate, to: ISODate) => ['blocks', from, to] as const,
  allBlocks: ['blocks'] as const,
  dayLogs: (from: ISODate, to: ISODate) => ['dayLogs', from, to] as const,
};

export function useSettings() {
  return useQuery<Settings>({ queryKey: keys.settings, queryFn: async () => sampleStore.settings });
}

export function useCategories() {
  return useQuery<Category[]>({
    queryKey: keys.categories,
    queryFn: async () => [...sampleStore.categories].sort((a, b) => a.sortOrder - b.sortOrder),
  });
}

export function useTargets() {
  return useQuery<Target[]>({ queryKey: keys.targets, queryFn: async () => [...sampleStore.targets] });
}

/** Blocks with from <= date <= to, ordered by date then start time. */
export function useBlocks(from: ISODate, to: ISODate) {
  return useQuery<Block[]>({
    queryKey: keys.blocks(from, to),
    queryFn: async () =>
      sampleStore.blocks
        .filter((b) => b.date >= from && b.date <= to)
        .sort((a, b) => (a.date === b.date ? a.start - b.start : a.date < b.date ? -1 : 1)),
  });
}

export function useDayLogs(from: ISODate, to: ISODate) {
  return useQuery<DayLog[]>({
    queryKey: keys.dayLogs(from, to),
    queryFn: async () => sampleStore.dayLogs.filter((l) => l.date >= from && l.date <= to),
  });
}

/** One-tap complete: planned or skipped -> done, done -> planned. */
export function useToggleBlockDone() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const b = sampleStore.blocks.find((x) => x.id === id);
      if (!b) return;
      const done = b.status !== 'done';
      b.status = done ? 'done' : 'planned';
      b.completedAt = done ? localNowStamp() : null;
    },
    onSettled: () => qc.invalidateQueries({ queryKey: keys.allBlocks }),
  });
}

export function useSaveTarget() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (target: Target) => {
      const i = sampleStore.targets.findIndex((x) => x.id === target.id);
      if (i >= 0) sampleStore.targets[i] = target;
      else sampleStore.targets.push(target);
      return target;
    },
    onSettled: () => qc.invalidateQueries({ queryKey: keys.targets }),
  });
}

export function useCreateBlock() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (block: Block) => {
      sampleStore.blocks.push(block);
      return block;
    },
    onSettled: () => qc.invalidateQueries({ queryKey: keys.allBlocks }),
  });
}

export function useUpdateBlock() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<Omit<Block, 'id'>> }) => {
      const b = sampleStore.blocks.find((x) => x.id === id);
      if (!b) return;
      Object.assign(b, patch);
      // Keep completed_at consistent with status (the database enforces this too).
      if (patch.status && patch.status !== 'done') b.completedAt = null;
      if (patch.status === 'done' && !b.completedAt) b.completedAt = localNowStamp();
    },
    onSettled: () => qc.invalidateQueries({ queryKey: keys.allBlocks }),
  });
}

export function useDeleteBlock() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      sampleStore.blocks = sampleStore.blocks.filter((b) => b.id !== id);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: keys.allBlocks }),
  });
}

/** Applies a move plan from domain/moves.ts: block times, and the target's time for "all future". */
export function useApplyMove() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (plan: MovePlan) => {
      for (const change of plan.blocks) {
        const b = sampleStore.blocks.find((x) => x.id === change.id);
        if (b) Object.assign(b, { start: change.start, moved: change.moved });
      }
      if (plan.target) {
        const t = sampleStore.targets.find((x) => x.id === plan.target!.id);
        if (t) Object.assign(t, plan.target);
      }
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: keys.allBlocks });
      qc.invalidateQueries({ queryKey: keys.targets });
    },
  });
}

/** Every block, for move planning across weeks. Phase 3 narrows this to one target's future blocks. */
export function useAllBlocksOf(targetId: string | null) {
  return useQuery<Block[]>({
    queryKey: ['blocks', 'target', targetId],
    enabled: targetId !== null,
    queryFn: async () => sampleStore.blocks.filter((b) => b.targetId === targetId),
  });
}

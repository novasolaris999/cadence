// The only module screens use to read and write data.
//
// Every hook goes through `api` (Supabase, or demo data when Supabase is not configured).
// TanStack Query caches results by key, refetches when you come back to the app, and lets
// mutations update the screen before the save finishes (optimistic updates).

import { useMutation, useQueries, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import type { DayMovePlan, GroupDayMovePlan, MovePlan } from '../domain/moves';
import type { Block, Category, DayLog, ISODate, Routine, Settings, Target } from '../domain/types';
import { ensureSetup, getApi, isDemo, setDemo } from './index';
import { localNowStamp } from './localStamp';
import { isAnytime } from '../domain/routines';
import { afterTargetSaved, applyDayMove, applyGroupDayMove, ensureWeek, rerunWeek, saveRoutine } from './scheduling';
import { addDays, formatDayShort, formatTime, startOfWeek, today as todayISO } from '../domain/time';
import { toast } from '../components/Toaster';

// Every cache key starts with the data mode ('supabase' or 'demo'), so real and demo results
// can never be mixed up in the cache, even if a request finishes just after you switch.
const mode = () => getApi().mode;

export const keys = {
  settings: () => [mode(), 'settings'] as const,
  categories: () => [mode(), 'categories'] as const,
  targets: () => [mode(), 'targets'] as const,
  routines: () => [mode(), 'routines'] as const,
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
      const created = !(qc.getQueryData<Target[]>(keys.targets()) ?? []).some((x) => x.id === t.id);
      await api.saveTarget(t);
      const first = await afterTargetSaved(api, t);
      return { created, first };
    },
    onSuccess: ({ created, first }, t) => {
      if (!created) return;
      if (!first) toast(`${t.name} added`, 'info');
      else if (isAnytime(t)) toast(`${t.name} added to Anytime, from ${whenLabel(first.date)}`, 'info');
      else toast(`${t.name} added: first block ${whenLabel(first.date)} at ${formatTime(first.start)}`, 'info');
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: keys.targets() });
      qc.invalidateQueries({ queryKey: keys.allBlocks() });
    },
  });
}

export function useRoutines() {
  return useQuery<Routine[]>({ queryKey: keys.routines(), queryFn: () => getApi().listRoutines() });
}

/** Create or update a routine with its habits in order (removed habits are archived). */
export function useSaveRoutine() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ routine, habits, removed }: { routine: Routine; habits: Target[]; removed: Target[] }) => {
      const created = !(qc.getQueryData<Routine[]>(keys.routines()) ?? []).some((r) => r.id === routine.id);
      const first = await saveRoutine(getApi(), routine, habits, removed);
      return { created, first };
    },
    onSuccess: ({ created, first }, { routine }) => {
      if (!created) return;
      toast(first ? `${routine.name} added: first ${whenLabel(first.date)} at ${formatTime(first.start)}` : `${routine.name} added`, 'info');
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: keys.routines() });
      qc.invalidateQueries({ queryKey: keys.targets() });
      qc.invalidateQueries({ queryKey: keys.allBlocks() });
    },
  });
}

/** 'today', 'tomorrow', or 'Mon, Oct 5'. */
function whenLabel(date: ISODate): string {
  const t = todayISO();
  if (date === t) return 'today';
  if (date === addDays(t, 1)) return 'tomorrow';
  return formatDayShort(date);
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

/** Several habits' blocks from a date on (moving a routine card). */
export function useHabitsBlocks(targetIds: string[], from: ISODate): Block[] {
  const lists = useQueries({
    queries: targetIds.map((id) => ({ queryKey: keys.targetBlocks(id, from), queryFn: () => getApi().listTargetBlocks(id, from) })),
  });
  return lists.flatMap((q) => q.data ?? []);
}

export function useDayLogs(from: ISODate, to: ISODate) {
  return useQuery<DayLog[]>({ queryKey: keys.dayLogs(from, to), queryFn: () => getApi().listDayLogs(from, to) });
}

// ---------- Saves that survive being offline ----------
// Ticking habits and logging wake/sleep are what you do with no signal. These saves carry everything
// they need as plain data (including the time you ticked), so TanStack Query can keep a waiting one on
// the device (see main.tsx) and send it when the connection returns, even after the app was closed.
// `mode` is recorded so a change made in demo mode can never be sent to your real data, or the reverse.

type Mode = 'supabase' | 'demo';
interface BlockChanges {
  mode: Mode;
  changes: { id: string; patch: Partial<Omit<Block, 'id'>> }[];
}
interface DayLogSave {
  mode: Mode;
  log: DayLog;
}
export const OFFLINE_KEYS = { blocks: ['offline', 'blockChanges'], dayLog: ['offline', 'dayLog'] } as const;

async function sendBlockChanges({ mode: m, changes }: BlockChanges) {
  if (getApi().mode !== m) return;
  for (const c of changes) await getApi().updateBlock(c.id, c.patch);
}
async function sendDayLog({ mode: m, log }: DayLogSave) {
  if (getApi().mode !== m) return;
  await getApi().saveDayLog(log);
}

/** How to send a waiting save that was restored from the device after a restart. */
export function registerOfflineSaves(qc: QueryClient) {
  qc.setMutationDefaults(OFFLINE_KEYS.blocks, {
    mutationFn: sendBlockChanges,
    onSettled: (_d, _e, v) => qc.invalidateQueries({ queryKey: [v.mode, 'blocks'] }),
  });
  qc.setMutationDefaults(OFFLINE_KEYS.dayLog, {
    mutationFn: sendDayLog,
    onSettled: (_d, _e, v) => qc.invalidateQueries({ queryKey: [v.mode, 'dayLogs'] }),
  });
}

/** Saves wake or sleep time for one date. Shows instantly; saves now, or when back online. */
export function useSaveDayLog() {
  const qc = useQueryClient();
  const m = useMutation({
    mutationKey: OFFLINE_KEYS.dayLog,
    mutationFn: sendDayLog,
    onMutate: async ({ log }: DayLogSave) => {
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
  return { ...m, mutate: (log: DayLog) => m.mutate({ mode: mode(), log }) };
}

/** Block status changes (tick, Complete all): shown at once, saved now or when back online. */
function useBlockChanges() {
  const qc = useQueryClient();
  return useMutation({
    mutationKey: OFFLINE_KEYS.blocks,
    mutationFn: sendBlockChanges,
    onMutate: async ({ changes }: BlockChanges) => {
      await qc.cancelQueries({ queryKey: keys.allBlocks() });
      const undos = changes.map((c) => patchCachedBlocks(qc, c.id, c.patch));
      return { undo: () => undos.reverse().forEach((u) => u()) };
    },
    onError: (_e, _v, ctx) => ctx?.undo(),
    onSettled: () => qc.invalidateQueries({ queryKey: keys.allBlocks() }),
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
  const m = useBlockChanges();
  return {
    ...m,
    mutate: ({ block }: { block: Block }) =>
      m.mutate({ mode: mode(), changes: [{ id: block.id, patch: statusPatch(block.status === 'done' ? 'planned' : 'done', block) }] }),
  };
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
      qc.invalidateQueries({ queryKey: keys.routines() });
      qc.invalidateQueries({ queryKey: keys.targets() });
    },
  });
}

/** Moves a block to another day (Weekly). Shows at once; the target's days change too for "every week". */
export function useApplyDayMove() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (plan: DayMovePlan) => applyDayMove(getApi(), plan),
    onMutate: async (plan) => {
      await qc.cancelQueries({ queryKey: keys.allBlocks() });
      const { id, ...patch } = plan.block;
      return { undo: patchCachedBlocks(qc, id, patch) };
    },
    onError: (_e, _v, ctx) => ctx?.undo(),
    onSettled: () => {
      qc.invalidateQueries({ queryKey: keys.allBlocks() });
      qc.invalidateQueries({ queryKey: keys.targets() });
    },
  });
}

/** Re-run: rebuilds the rest of one week from your targets' rules (see planRerun). */
export function useRerunWeek() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (weekStart: ISODate) => rerunWeek(getApi(), weekStart),
    onSuccess: (plan) => {
      const n = plan.changes.length;
      toast(n ? `Week re-run: ${n} block${n === 1 ? '' : 's'} updated` : 'Your week already matches your targets', 'info');
    },
    onSettled: () => qc.invalidateQueries({ queryKey: keys.allBlocks() }),
  });
}

/** Moves a routine card (all its habit blocks) to another day. */
export function useApplyGroupDayMove() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (plan: GroupDayMovePlan) => applyGroupDayMove(getApi(), plan),
    onMutate: async (plan) => {
      await qc.cancelQueries({ queryKey: keys.allBlocks() });
      const undos = plan.blocks.map(({ id, ...patch }) => patchCachedBlocks(qc, id, patch));
      return { undo: () => undos.reverse().forEach((u) => u()) };
    },
    onError: (_e, _v, ctx) => ctx?.undo(),
    onSettled: () => {
      qc.invalidateQueries({ queryKey: keys.allBlocks() });
      qc.invalidateQueries({ queryKey: keys.targets() });
      qc.invalidateQueries({ queryKey: keys.routines() });
    },
  });
}

/** Sets several blocks to one status at once (a routine's "Complete all"). Shows at once. */
export function useSetBlocksStatus() {
  const m = useBlockChanges();
  return {
    ...m,
    mutate: ({ blocks, status }: { blocks: Block[]; status: Block['status'] }) =>
      m.mutate({
        mode: mode(),
        changes: blocks.filter((b) => b.status !== status).map((b) => ({ id: b.id, patch: statusPatch(status, b) })),
      }),
  };
}

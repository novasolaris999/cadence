// Offline copy: the app keeps a copy of your recent real data on this device (localStorage), so opening
// Cadence with no signal shows your last-known day instead of a blank screen. TanStack Query writes the
// copy after changes and restores it on start; fresh data replaces it as soon as the network is back.
//
// Kept small on purpose (localStorage holds about 5 MB): settings, categories, habits, routines, to-dos
// and their lists, the first-run setup flag, wake/sleep logs, and blocks for windows of up to 3 weeks (Today and Weekly).
// Long history (Habits tab, history pages, Insights) stays online only. Demo data is never saved.

import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister';
import type { Mutation, Query } from '@tanstack/react-query';
import { daysBetween } from '../domain/time';

const KEY = 'cadence.offline';
/** Bump when cached shapes change, so an old copy is dropped instead of misread. */
export const OFFLINE_CACHE_VERSION = 'v1';
/** A copy older than this is not restored. */
export const OFFLINE_MAX_AGE = 1000 * 60 * 60 * 24 * 30;

const SMALL = new Set(['settings', 'categories', 'targets', 'routines', 'todos', 'todoLists']);

/** Which cached reads are worth keeping offline (see the file comment). */
export function keepOffline(key: readonly unknown[]): boolean {
  if (key[0] === 'setup') return true;
  if (key[0] !== 'supabase') return false; // demo data is never saved
  const kind = key[1];
  if (typeof kind === 'string' && SMALL.has(kind)) return true;
  if ((kind === 'blocks' || kind === 'dayLogs') && typeof key[2] === 'string' && typeof key[3] === 'string') {
    return daysBetween(key[2], key[3]) <= 21;
  }
  return false;
}

export const shouldKeepQuery = (q: Query) => q.state.status === 'success' && keepOffline(q.queryKey);

/** Saves waiting for the network (ticks, wake/sleep logs) are kept too, and sent after a restart. */
export const shouldKeepMutation = (m: Mutation) => m.state.isPaused && m.options.mutationKey?.[0] === 'offline';

export const offlinePersister = createSyncStoragePersister({
  key: KEY,
  storage: typeof window === 'undefined' ? undefined : window.localStorage,
  throttleTime: 1000,
});

/** Removes the offline copy (on sign-out, so nothing personal stays on the device). */
export function clearOfflineCache(): void {
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    // Storage blocked: nothing was saved either.
  }
}

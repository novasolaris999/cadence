import { describe, expect, it } from 'vitest';
import { keepOffline } from './offlineCache';

describe('keepOffline', () => {
  it('keeps the small real-data reads and the setup flag', () => {
    expect(keepOffline(['setup'])).toBe(true);
    for (const k of ['settings', 'categories', 'targets', 'routines', 'todos', 'todoLists']) expect(keepOffline(['supabase', k])).toBe(true);
  });
  it('keeps blocks and logs for Today and Weekly windows, not long history', () => {
    expect(keepOffline(['supabase', 'blocks', '2026-10-05', '2026-10-11'])).toBe(true);
    expect(keepOffline(['supabase', 'dayLogs', '2026-09-28', '2026-10-11'])).toBe(true);
    expect(keepOffline(['supabase', 'blocks', '2025-10-05', '2026-10-11'])).toBe(false);
    expect(keepOffline(['supabase', 'blocks', 'target', 't1', '2000-01-01'])).toBe(false);
  });
  it('never saves demo data', () => {
    expect(keepOffline(['demo', 'targets'])).toBe(false);
    expect(keepOffline(['demo', 'blocks', '2026-10-05', '2026-10-11'])).toBe(false);
  });
});

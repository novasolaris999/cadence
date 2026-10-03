// Which storage the app uses right now.
// - Supabase not configured (e.g. screenshot checks in the build container): always demo data.
// - Supabase configured: your real data, unless you turn on Demo mode in Settings. Demo mode
//   swaps in the in-memory sample data. Nothing is copied, deleted, or written to your real
//   data while it is on; changes made in demo mode vanish on reload.

import { useSyncExternalStore } from 'react';
import type { DataApi } from './api';
import { sampleApi } from './sampleApi';
import { supabase } from './supabase';
import { supabaseApi } from './supabaseApi';

const DEMO_KEY = 'cadence.demoMode';

export const supabaseConfigured = supabase !== null;
const realApi: DataApi | null = supabase ? supabaseApi(supabase) : null;

function readFlag(): boolean {
  try {
    return localStorage.getItem(DEMO_KEY) === '1';
  } catch {
    return false;
  }
}

let demo = !realApi || readFlag();
const listeners = new Set<() => void>();

/** The storage to use for this call. Hooks call it at request time, so a switch takes effect at once. */
export function getApi(): DataApi {
  return demo || !realApi ? sampleApi : realApi;
}

/**
 * First-sign-in setup always targets your real account (when Supabase is configured), whatever the
 * mode, so switching modes never has to wait for it and your account is ready when you switch back.
 */
export function ensureSetup(): Promise<void> {
  return (realApi ?? sampleApi).ensureSetup();
}

export function isDemo(): boolean {
  return demo;
}

/** Turns demo mode on or off (remembered on this device). Ignored when Supabase is not configured. */
export function setDemo(on: boolean): void {
  if (!realApi || on === demo) return;
  demo = on;
  try {
    localStorage.setItem(DEMO_KEY, on ? '1' : '0');
  } catch {
    // Storage blocked: the switch still applies until reload.
  }
  listeners.forEach((l) => l());
}

/** React hook: re-renders when demo mode changes. */
export function useDemoMode(): boolean {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    isDemo,
  );
}

// "Install app" in Settings. Chrome offers installation through a `beforeinstallprompt` event that fires
// once, early, and only when the app can be installed and is not installed yet. We keep that event from
// startup (this file is imported by main.tsx) so the Settings button can use it whenever it is opened.

import { useSyncExternalStore } from 'react';

interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export type InstallState =
  /** Running as the installed app. */
  | 'installed-app'
  /** Chrome offered installation: the button can show its install dialog. */
  | 'can-install'
  /** Just installed from this tab. */
  | 'just-installed'
  /** Chrome has not offered it (already installed, another browser, or not yet). */
  | 'unavailable';

let deferred: InstallPromptEvent | null = null;
let justInstalled = false;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());

const standalone = () =>
  typeof window !== 'undefined' &&
  (window.matchMedia?.('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone === true);

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault(); // keep Chrome's own mini bar away; the Settings button shows the dialog instead
    deferred = e as InstallPromptEvent;
    notify();
  });
  window.addEventListener('appinstalled', () => {
    deferred = null;
    justInstalled = true;
    notify();
  });
}

function state(): InstallState {
  if (standalone()) return 'installed-app';
  if (justInstalled) return 'just-installed';
  return deferred ? 'can-install' : 'unavailable';
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

/** The install state, and `install()` to show Chrome's install dialog. */
export function useInstall(): { state: InstallState; install: () => Promise<void> } {
  const s = useSyncExternalStore(subscribe, state, () => 'unavailable' as InstallState);
  const install = async () => {
    const e = deferred;
    if (!e) return;
    await e.prompt();
    // The event can be used once; Chrome sends a new one later if you said no.
    deferred = null;
    notify();
  };
  return { state: s, install };
}

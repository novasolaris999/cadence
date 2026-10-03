import { useState } from 'react';
import { SettingsSheet } from './SettingsSheet';
import { ThemeToggle } from './ThemeToggle';

/** Top bar: logo, CADENCE wordmark with the screen name, theme toggle, avatar (opens settings). */
export function AppHeader({ subtitle }: { subtitle: string }) {
  const [settingsOpen, setSettingsOpen] = useState(false);
  return (
    <header className="pt-safe fixed inset-x-0 top-0 z-50 border-b border-border/60 bg-bg/85 backdrop-blur-xl">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between gap-2 px-4">
        <div className="flex min-w-0 items-center gap-2">
          <img src="/logo.svg" alt="" className="h-8 w-8" />
          <div className="flex min-w-0 flex-col">
            <span className="font-display text-headline-md font-semibold uppercase tracking-tight">Cadence</span>
            <span className="-mt-0.5 truncate text-label-sm uppercase tracking-wider text-faint">{subtitle}</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <button
            type="button"
            onClick={() => setSettingsOpen(true)}
            aria-label="Settings"
            className="rounded-full ring-2 ring-primary/20"
          >
            <img src="/avatar.svg" alt="" className="h-8 w-8 rounded-full" />
          </button>
        </div>
      </div>
      <SettingsSheet open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </header>
  );
}

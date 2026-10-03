import type { ReactNode } from 'react';
import { formatTime, parseTime } from '../domain/time';
import { cx } from './cx';

// Small form building blocks shared by the target rules screen and the block sheet.

export const DURATIONS = [15, 30, 45, 60, 90, 120];

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between">
        <span className="text-label-sm font-semibold uppercase tracking-wider text-faint">{label}</span>
        {hint && <span className="text-label-md font-semibold text-primary-ink">{hint}</span>}
      </div>
      {children}
    </div>
  );
}

export function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cx(
        'flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-label-md font-medium',
        active ? 'border-primary bg-primary/10 text-primary-ink' : 'border-border bg-surface-2 text-muted hover:text-text',
      )}
    >
      {children}
    </button>
  );
}

/** Native time picker, snapped to the 15-minute grid. */
export function TimeInput({ label, value, onChange }: { label: string; value: number; onChange: (m: number) => void }) {
  return (
    <input
      type="time"
      step={900}
      aria-label={label}
      value={formatTime(value)}
      onChange={(e) => e.target.value && onChange(Math.round(parseTime(e.target.value) / 15) * 15)}
      className="self-start rounded-lg border border-border bg-surface-2 px-2.5 py-1.5 font-mono text-body-md text-text"
    />
  );
}

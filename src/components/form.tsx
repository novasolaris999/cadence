import type { ReactNode } from 'react';
import { formatTime, parseTime, weekdayInitial } from '../domain/time';
import { targetDays } from '../domain/schedule';
import type { Weekday } from '../domain/types';
import { cx } from './cx';
import { Icon, type IconName } from './Icon';

// Small form building blocks shared by the habit and routine screens and the block sheet.

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

export const HABIT_ICONS: IconName[] = [
  'fitness_center', 'sports_tennis', 'directions_run', 'self_improvement', 'pill', 'wb_sunny',
  'menu_book', 'edit_note', 'psychology', 'favorite', 'restaurant', 'local_cafe', 'work', 'bedtime',
];
const WEEKDAYS: Weekday[] = [1, 2, 3, 4, 5, 6, 7];

export function FormCard({ children }: { children: ReactNode }) {
  return <section className="flex flex-col gap-3 rounded-2xl border border-border bg-surface p-4 shadow-card">{children}</section>;
}

export function SectionTitle({ children, color }: { children: ReactNode; color: string }) {
  return (
    <h2 className="flex items-center gap-2 text-headline-sm font-bold">
      <span className={cx('h-4 w-1.5 rounded-full', color)} />
      {children}
    </h2>
  );
}

export function Stepper({
  value,
  min,
  max,
  label,
  format,
  onChange,
}: {
  value: number;
  min: number;
  max: number;
  label: string;
  format: (n: number) => string;
  onChange: (n: number) => void;
}) {
  return (
    <div className="flex items-center gap-1" role="group" aria-label={label}>
      <button type="button" aria-label="Fewer" disabled={value <= min} onClick={() => onChange(value - 1)} className="h-7 w-7 rounded-full bg-surface text-muted disabled:opacity-30">
        –
      </button>
      <span className="w-8 text-center text-label-lg font-semibold">{format(value)}</span>
      <button type="button" aria-label="More" disabled={value >= max} onClick={() => onChange(value + 1)} className="h-7 w-7 rounded-full bg-surface text-muted disabled:opacity-30">
        +
      </button>
    </div>
  );
}

/**
 * "Every day" plus seven day buttons. Picked days decide the frequency; with none picked, the
 * frequency is set by hand and spread across the week (lighter tint shows where it lands).
 */
export function DaysPicker({
  days,
  frequency,
  onChange,
}: {
  days: Weekday[];
  frequency: number;
  onChange: (days: Weekday[], frequency: number) => void;
}) {
  const shown = targetDays({ preferredDays: days, frequencyPerWeek: frequency });
  const all = days.length === 7;
  const toggle = (w: Weekday) => {
    const next = days.includes(w) ? days.filter((d) => d !== w) : [...days, w].sort((a, b) => a - b);
    onChange(next, next.length || frequency);
  };
  return (
    <>
      <button
        type="button"
        aria-pressed={all}
        onClick={() => onChange(all ? [] : [...WEEKDAYS], all ? frequency : 7)}
        className={cx(
          'flex items-center justify-center gap-1.5 self-start rounded-full border px-3 py-1 text-label-md font-semibold',
          all ? 'border-primary bg-primary text-on-primary' : 'border-border bg-surface-2 text-muted hover:text-text',
        )}
      >
        <Icon name="repeat" size={16} /> Every day
      </button>
      <div className="grid grid-cols-7 gap-1.5">
        {WEEKDAYS.map((w) => (
          <button
            key={w}
            type="button"
            aria-pressed={days.includes(w)}
            onClick={() => toggle(w)}
            className={cx(
              'h-9 rounded-lg text-label-lg font-semibold',
              days.includes(w)
                ? 'bg-primary text-on-primary'
                : shown.includes(w)
                  ? 'bg-primary/10 text-primary-ink ring-1 ring-inset ring-primary/30'
                  : 'bg-surface-2 text-muted',
            )}
          >
            {weekdayInitial(w)}
          </button>
        ))}
      </div>
      {days.length === 0 && (
        <div className="mt-2 flex items-center justify-between rounded-lg bg-surface-2 px-3 py-2">
          <span className="text-body-sm text-muted">No days picked: spread across the week</span>
          <Stepper value={frequency} min={1} max={7} label="Times per week" format={(n) => `${n}x`} onChange={(n) => onChange([], n)} />
        </div>
      )}
    </>
  );
}

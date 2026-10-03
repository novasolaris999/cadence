import { useState } from 'react';
import { useSaveDayLog } from '../data/queries';
import { formatDayShort, formatTime, minutesOfDay, parseTime } from '../domain/time';
import type { DayLog, ISODate } from '../domain/types';
import { Sheet } from './Sheet';

export interface DayLogTarget {
  kind: 'wake' | 'sleep';
  /** For sleep: the date the night starts on (bedtimes after midnight belong to the evening before). */
  date: ISODate;
  existing: DayLog | null;
}

/** Log or fix the time you woke up or went to sleep. Defaults to now. */
export function DayLogSheet({ target, onClose }: { target: DayLogTarget | null; onClose: () => void }) {
  if (!target) return null;
  return <Form key={`${target.kind}-${target.date}`} target={target} onClose={onClose} />;
}

function Form({ target, onClose }: { target: DayLogTarget; onClose: () => void }) {
  const save = useSaveDayLog();
  const current = target.kind === 'wake' ? target.existing?.wake : target.existing?.sleep;
  const [value, setValue] = useState(formatTime(current ?? minutesOfDay()));
  const base: DayLog = target.existing ?? { date: target.date, wake: null, sleep: null };
  const write = (m: number | null) =>
    save.mutate({ ...base, [target.kind]: m }, { onSuccess: onClose });

  const title = target.kind === 'wake' ? 'Woke up' : 'Went to sleep';
  const subtitle =
    target.kind === 'wake' ? formatDayShort(target.date) : `The night of ${formatDayShort(target.date)}`;

  return (
    <Sheet open onClose={onClose} title={title}>
      <p className="-mt-1 mb-4 text-body-sm text-muted">{subtitle}</p>
      <div className="flex items-center gap-2">
        <input
          type="time"
          step={60}
          aria-label={`${title} time`}
          value={value}
          onChange={(e) => e.target.value && setValue(e.target.value)}
          className="flex-1 rounded-xl border border-border bg-surface-2 px-3 py-3 text-center font-mono text-headline-lg text-text"
        />
        <button
          type="button"
          onClick={() => setValue(formatTime(minutesOfDay()))}
          className="rounded-full border border-border px-4 py-3 text-label-lg font-semibold text-muted hover:text-text"
        >
          Now
        </button>
      </div>
      <button
        type="button"
        onClick={() => write(parseTime(value))}
        className="mt-4 w-full rounded-full bg-primary py-3 text-label-lg font-semibold text-on-primary shadow-card active:scale-[0.98]"
      >
        Save
      </button>
      {current != null && (
        <button
          type="button"
          onClick={() => write(null)}
          className="mt-2 w-full rounded-full py-2 text-label-lg font-semibold text-muted hover:text-text"
        >
          Clear
        </button>
      )}
    </Sheet>
  );
}

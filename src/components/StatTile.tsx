import type { ReactNode } from 'react';

/** One number with a label and a note under it (summary strips and history views). */
export function StatTile({ label, value, children }: { label: string; value: ReactNode; children?: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col rounded-lg bg-surface-2 p-2.5">
      <span className="truncate text-label-sm uppercase text-faint">{label}</span>
      <span className="mt-0.5 flex h-8 items-baseline font-display text-metric font-bold">{value}</span>
      {children && <span className="mt-0.5 truncate text-label-sm">{children}</span>}
    </div>
  );
}

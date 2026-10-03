import { onlineManager, useIsMutating } from '@tanstack/react-query';
import { useSyncExternalStore } from 'react';
import { Icon } from './Icon';

/** True while the device has a connection (TanStack Query's view, which also pauses requests offline). */
export function useOnline(): boolean {
  return useSyncExternalStore(
    (cb) => onlineManager.subscribe(cb),
    () => onlineManager.isOnline(),
  );
}

/**
 * Shown while offline: the screens show the saved copy of your recent data, and changes wait and save
 * themselves when the connection returns. Ticks and wake/sleep logs are kept on the device even if the
 * app closes; other edits wait in memory only, so for those the banner asks to keep the app open.
 */
export function OfflineBanner() {
  const online = useOnline();
  const waiting = useIsMutating();
  const inMemoryOnly = useIsMutating({ predicate: (m) => m.options.mutationKey?.[0] !== 'offline' });
  if (online) return null;
  return (
    <div role="status" className="mx-auto mb-1 flex max-w-xl items-start gap-2 px-4 pt-3">
      <p className="flex w-full items-start gap-2 rounded-xl border border-warn/40 bg-warn/10 px-3 py-2 text-body-sm text-text">
        <Icon name="error" size={18} className="mt-px shrink-0 text-warn-ink" />
        <span>
          <strong className="font-semibold">Offline.</strong> Showing your saved data.{' '}
          {waiting > 0
            ? `${waiting} change${waiting === 1 ? '' : 's'} will save when you reconnect.${inMemoryOnly > 0 ? ' Keep Cadence open until then.' : ''}`
            : 'Changes you make save when you reconnect.'}
        </span>
      </p>
    </div>
  );
}

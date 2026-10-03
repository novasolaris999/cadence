import { useEffect, useState, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from './Icon';

// A tiny notice area: confirmations ("Gym added: first block Mon 18:00") and things that went wrong in
// the background (e.g. a save that failed offline; optimistic updates otherwise roll back silently).

type Notice = { id: number; text: string; kind: 'error' | 'info' } | null;
let notice: Notice = null;
const listeners = new Set<() => void>();

/** Shows a short notice. 'error' for failed saves (the default), 'info' for confirmations. */
export function toast(text: string, kind: 'error' | 'info' = 'error') {
  notice = { id: (notice?.id ?? 0) + 1, text, kind };
  listeners.forEach((l) => l());
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

export function Toaster() {
  const current = useSyncExternalStore(subscribe, () => notice);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!current) return;
    setVisible(true);
    const id = window.setTimeout(() => setVisible(false), 5000);
    return () => window.clearTimeout(id);
  }, [current]);

  if (!visible || !current) return null;
  return createPortal(
    <div className="pointer-events-none fixed inset-x-0 bottom-[calc(5.5rem+env(safe-area-inset-bottom,0px))] z-[70] flex justify-center px-4">
      <div role="status" className="pointer-events-auto flex max-w-md items-center gap-2 rounded-full bg-text px-4 py-2.5 text-body-sm text-bg shadow-float">
        <Icon name={current.kind === 'info' ? 'check_circle' : 'error'} size={18} />
        {current.text}
      </div>
    </div>,
    document.body,
  );
}

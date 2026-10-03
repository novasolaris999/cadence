import { useEffect, useState, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from './Icon';

// A tiny notice area for things that went wrong in the background (e.g. a save that failed because
// the phone was offline). Optimistic updates roll back silently otherwise, which would be confusing.

type Notice = { id: number; text: string } | null;
let notice: Notice = null;
const listeners = new Set<() => void>();

export function toast(text: string) {
  notice = { id: (notice?.id ?? 0) + 1, text };
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
        <Icon name="error" size={18} />
        {current.text}
      </div>
    </div>,
    document.body,
  );
}

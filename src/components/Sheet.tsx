import { useEffect, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from './Icon';

interface Props {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}

/**
 * Bottom sheet on phones, centered dialog on wide screens. Escape or backdrop tap closes it.
 * Rendered at the end of <body> (a portal) so no parent's blur or transform can clip it.
 */
export function Sheet({ open, onClose, title, children }: Props) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;
  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center">
      <button aria-label="Close" className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="pb-safe relative max-h-[85dvh] w-full max-w-xl overflow-y-auto rounded-t-2xl bg-surface shadow-float sm:rounded-2xl"
      >
        <div className="sticky top-0 flex items-center justify-between bg-surface px-4 pt-4 pb-2">
          <h2 className="text-headline-md font-semibold">{title}</h2>
          <button onClick={onClose} aria-label="Close" className="rounded-full p-1.5 text-muted hover:bg-surface-2">
            <Icon name="close" />
          </button>
        </div>
        <div className="px-4 pb-6">{children}</div>
      </div>
    </div>,
    document.body,
  );
}

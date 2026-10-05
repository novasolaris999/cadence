import { useEffect, useRef } from 'react';
import { Icon, type IconName } from './Icon';

export interface AddChoice {
  label: string;
  icon: IconName;
  onSelect: () => void;
}

/**
 * The bubbles the + opens: small labelled choices that rise above the action pill, one after another (the one
 * nearest the pill first). A light scrim behind them closes the menu on tap, and so does Escape.
 */
export function AddMenu({ open, onClose, choices }: { open: boolean; onClose: () => void; choices: AddChoice[] }) {
  const first = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    first.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  if (!open) return null;
  return (
    <>
      {/* A light scrim: closes the menu on tap and lifts the bubbles off the page. */}
      <button
        type="button"
        aria-label="Close add menu"
        tabIndex={-1}
        onClick={onClose}
        className="scrim-in fixed inset-0 z-[55] bg-bg/70 backdrop-blur-[2px]"
      />
      <div
        id="add-menu"
        role="group"
        aria-label="Add"
        className="fixed bottom-[calc(8.75rem+env(safe-area-inset-bottom,0px))] left-1/2 z-[56] flex -translate-x-1/2 flex-col items-center gap-2.5"
      >
        {choices.map((c, i) => (
          <button
            key={c.label}
            ref={i === 0 ? first : undefined}
            type="button"
            onClick={() => {
              onClose();
              c.onSelect();
            }}
            style={{ animationDelay: `${(choices.length - 1 - i) * 45}ms` }}
            className="bubble-in flex h-10 min-w-40 items-center gap-2 rounded-full border border-border bg-surface pr-4 pl-1.5 text-label-lg font-semibold text-text shadow-float active:scale-95"
          >
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-primary-ink">
              <Icon name={c.icon} size={18} />
            </span>
            {c.label}
          </button>
        ))}
      </div>
    </>
  );
}

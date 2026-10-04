import { useEffect, useRef, useState } from "react";
import { Fab } from "./Fab";
import { Icon, type IconName } from "./Icon";

export interface AddChoice {
  label: string;
  icon: IconName;
  onSelect: () => void;
}

/**
 * The + on Today as a speed dial: tap it and small labelled bubbles rise above it, one after another;
 * pick one, or tap anywhere else (or press Escape) to close. The + turns into a × while open.
 */
export function AddMenu({ choices }: { choices: AddChoice[] }) {
  const [open, setOpen] = useState(false);
  const first = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    first.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      <Fab
        label={open ? "Close add menu" : "Add"}
        expanded={open}
        controls="add-menu"
        onClick={() => setOpen((v) => !v)}
      />
      {open && (
        <>
          {/* A light scrim: closes the menu on tap and lifts the bubbles off the page. */}
          <button
            type="button"
            aria-label="Close add menu"
            tabIndex={-1}
            onClick={() => setOpen(false)}
            className="scrim-in fixed inset-0 z-[55] bg-bg/70 backdrop-blur-[2px]"
          />
          <div
            id="add-menu"
            role="group"
            aria-label="Add"
            className="fixed right-4 bottom-[calc(8.5rem+env(safe-area-inset-bottom,0px))] z-[56] flex flex-col items-end gap-2.5 lg:right-[max(1rem,calc(50%-18rem))]"
          >
            {choices.map((c, i) => (
              <button
                key={c.label}
                ref={i === 0 ? first : undefined}
                type="button"
                onClick={() => {
                  setOpen(false);
                  c.onSelect();
                }}
                // The bubble nearest the + appears first.
                style={{ animationDelay: `${(choices.length - 1 - i) * 45}ms` }}
                className="bubble-in flex h-10 items-center gap-2 rounded-full border border-border bg-surface pr-4 pl-1.5 text-label-lg font-semibold text-text shadow-float active:scale-95"
              >
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-primary-ink">
                  <Icon name={c.icon} size={18} />
                </span>
                {c.label}
              </button>
            ))}
          </div>
        </>
      )}
    </>
  );
}

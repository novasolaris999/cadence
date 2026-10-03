/**
 * The keyboard and screen-reader way to open a card. Cards are plain containers (they hold their own
 * check buttons, and a button may not contain buttons), so this invisible full-size button is what Tab
 * reaches and a screen reader announces as "Open Gym session". Pointer taps pass through it
 * (pointer-events: none) to the card, which opens on tap as before.
 */
export function OpenOverlay({ label, onOpen }: { label: string; onOpen: () => void }) {
  return (
    <button
      type="button"
      aria-label={`Open ${label}`}
      onClick={(e) => {
        e.stopPropagation();
        onOpen();
      }}
      className="pointer-events-none absolute inset-0 rounded-[inherit]"
    />
  );
}

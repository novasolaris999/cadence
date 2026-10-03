import type { Category, CategoryColor } from '../domain/types';

// Tailwind only generates classes it can see written out in full, so the
// category palette is spelled out here instead of built with string templates.
const BG: Record<CategoryColor, string> = {
  'cat-1': 'bg-cat-1',
  'cat-2': 'bg-cat-2',
  'cat-3': 'bg-cat-3',
  'cat-4': 'bg-cat-4',
  'cat-5': 'bg-cat-5',
  'cat-6': 'bg-cat-6',
  'cat-7': 'bg-cat-7',
  'cat-8': 'bg-cat-8',
};
const SOFT: Record<CategoryColor, string> = {
  'cat-1': 'bg-cat-1/15',
  'cat-2': 'bg-cat-2/15',
  'cat-3': 'bg-cat-3/15',
  'cat-4': 'bg-cat-4/15',
  'cat-5': 'bg-cat-5/15',
  'cat-6': 'bg-cat-6/15',
  'cat-7': 'bg-cat-7/15',
  'cat-8': 'bg-cat-8/15',
};

const FALLBACK: CategoryColor = 'cat-2';

export const catBg = (c: Category | null | undefined) => BG[c?.color ?? FALLBACK];
export const catSoft = (c: Category | null | undefined) => SOFT[c?.color ?? FALLBACK];
/** CSS variable for inline SVG strokes and fills. */
export const catVar = (c: Category | null | undefined) => `var(--c-${c?.color ?? FALLBACK})`;

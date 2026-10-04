// Where a form goes back to. Forms opened from Today or Weekly return there; anything else returns to Habits.

/** The in-app path from a `back` URL parameter, or `fallback`. Only same-app paths are allowed. */
export function returnPath(param: string | null, fallback = '/goals'): string {
  if (!param || !param.startsWith('/') || param.startsWith('//') || param.includes('\\')) return fallback;
  return param;
}

/** Adds `back=<path>` to a form link, so saving returns to where you started. */
export function withBack(to: string, back: string | undefined): string {
  if (!back) return to;
  return `${to}${to.includes('?') ? '&' : '?'}back=${encodeURIComponent(back)}`;
}

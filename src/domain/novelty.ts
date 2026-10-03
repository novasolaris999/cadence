// "New" highlight for recently created targets.
// A target counts as new until the end of the day after it was created (local time), so it glows for
// at least one full day: created Monday 23:00, it glows all of Tuesday.

import type { ISODate } from './types';
import { addDays, toISODate } from './time';

export function isNewTarget(createdAt: string | null, today: ISODate): boolean {
  if (!createdAt) return false;
  const created = new Date(createdAt);
  if (Number.isNaN(created.getTime())) return false;
  return today <= addDays(toISODate(created), 1);
}

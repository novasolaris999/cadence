import { formatTime, minutesOfDay, today } from '../domain/time';

/** Local wall-clock 'YYYY-MM-DDTHH:MM' for completed_at. No time zone, by design. */
export function localNowStamp(now = new Date()): string {
  return `${today(now)}T${formatTime(minutesOfDay(now))}`;
}

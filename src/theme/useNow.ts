import { useEffect, useState } from 'react';
import { minutesOfDay, today } from '../domain/time';
import type { ISODate, Minutes } from '../domain/types';

/** Current local date and minute, refreshed every 30 seconds (drives the "now" line). */
export function useNow(): { today: ISODate; minutes: Minutes } {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 30_000);
    return () => window.clearInterval(id);
  }, []);
  return { today: today(now), minutes: minutesOfDay(now) };
}

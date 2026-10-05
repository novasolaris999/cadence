// The day the + adds to. Today and Weekly announce the day on screen (Today's selected date, Weekly's highlighted
// day); everywhere else it is today. A tiny shared store, so the pill in the app shell needs no prop drilling.

import { useEffect, useSyncExternalStore } from 'react';
import type { ISODate } from '../domain/types';

let day: ISODate | null = null;
const listeners = new Set<() => void>();
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};
const set = (d: ISODate | null) => {
  day = d;
  listeners.forEach((l) => l());
};

/** For screens: the + adds to `date` while this screen is shown. */
export function useAddDayFor(date: ISODate) {
  useEffect(() => {
    set(date);
    return () => set(null);
  }, [date]);
}

/** The announced day, or null (then: today). */
export const useAddDay = () => useSyncExternalStore(subscribe, () => day, () => null);

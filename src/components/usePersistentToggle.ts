import { useState } from 'react';

/**
 * A boolean UI preference remembered on this device (localStorage).
 * Used for view toggles like "show early hours", which are about this screen, not your data,
 * so they do not belong in the database.
 */
export function usePersistentToggle(key: string, initial = false): [boolean, (v: boolean) => void] {
  const [value, setValue] = useState<boolean>(() => {
    try {
      const v = localStorage.getItem(key);
      return v === null ? initial : v === '1';
    } catch {
      return initial;
    }
  });
  const set = (v: boolean) => {
    setValue(v);
    try {
      localStorage.setItem(key, v ? '1' : '0');
    } catch {
      // Storage blocked: the toggle still works until reload.
    }
  };
  return [value, set];
}

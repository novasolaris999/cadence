import type { ThemePref } from '../domain/types';
import { useTheme } from '../theme/ThemeProvider';
import { Icon, type IconName } from './Icon';

const NEXT: Record<ThemePref, ThemePref> = { system: 'light', light: 'dark', dark: 'system' };
const ICON: Record<ThemePref, IconName> = { system: 'brightness_auto', light: 'light_mode', dark: 'dark_mode' };
const LABEL: Record<ThemePref, string> = { system: 'System', light: 'Light', dark: 'Dark' };

/** Header button that cycles System -> Light -> Dark. The icon shows the current preference. */
export function ThemeToggle() {
  const { pref, setPref } = useTheme();
  return (
    <button
      type="button"
      onClick={() => setPref(NEXT[pref])}
      aria-label={`Theme: ${LABEL[pref]}. Switch to ${LABEL[NEXT[pref]]}`}
      title={`Theme: ${LABEL[pref]}`}
      className="flex h-9 w-9 items-center justify-center rounded-full bg-surface-2 text-muted transition-colors hover:text-text"
    >
      <Icon name={ICON[pref]} size={20} />
    </button>
  );
}

export { LABEL as THEME_LABEL };

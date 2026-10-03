import { useCategories, useSettings } from '../data/queries';
import { formatTime } from '../domain/time';
import type { ThemePref } from '../domain/types';
import { useTheme } from '../theme/ThemeProvider';
import { catBg } from './categoryColor';
import { SegmentedControl } from './SegmentedControl';
import { Sheet } from './Sheet';

/** Opened from the avatar. Anchors and categories become editable in phase 2. */
export function SettingsSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { pref, setPref } = useTheme();
  const { data: settings } = useSettings();
  const { data: categories = [] } = useCategories();

  return (
    <Sheet open={open} onClose={onClose} title="Settings">
      <section className="space-y-2 py-2">
        <h3 className="text-label-sm font-semibold uppercase text-faint">Theme</h3>
        <SegmentedControl<ThemePref>
          label="Theme"
          value={pref}
          onChange={setPref}
          options={[
            { value: 'system', label: 'System' },
            { value: 'light', label: 'Light' },
            { value: 'dark', label: 'Dark' },
          ]}
        />
      </section>

      {settings && (
        <section className="space-y-2 py-3">
          <h3 className="text-label-sm font-semibold uppercase text-faint">Anchors</h3>
          <div className="grid grid-cols-2 gap-2">
            <Anchor label="Wake" value={formatTime(settings.wakeAnchor)} />
            <Anchor label="Sleep" value={formatTime(settings.sleepAnchor)} />
          </div>
          <p className="text-body-sm text-muted">
            On time means within {settings.onTimeToleranceMin} minutes of the anchor.
          </p>
        </section>
      )}

      <section className="space-y-2 py-3">
        <h3 className="text-label-sm font-semibold uppercase text-faint">Categories</h3>
        <ul className="flex flex-wrap gap-2">
          {categories.map((c) => (
            <li key={c.id} className="flex items-center gap-1.5 rounded-full bg-surface-2 px-3 py-1 text-label-md">
              <span className={`h-2 w-2 rounded-full ${catBg(c)}`} />
              {c.name}
            </li>
          ))}
        </ul>
      </section>

      <p className="pt-3 text-body-sm text-faint">Sample data. Editing and sign out arrive in phase 2.</p>
    </Sheet>
  );
}

function Anchor({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-surface-2 px-3 py-2">
      <div className="text-label-sm uppercase text-faint">{label}</div>
      <div className="font-display text-headline-md font-semibold">{value}</div>
    </div>
  );
}

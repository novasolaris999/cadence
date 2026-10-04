import { useState, type ReactNode } from 'react';
import { signOut, useAuth } from '../data/auth';
import { newId } from '../data/api';
import { supabaseConfigured, useDemoMode } from '../data/index';
import { useCategories, useDeleteCategory, useSaveCategory, useSetDemoMode, useSettings, useUpdateSettings } from '../data/queries';
import { CATEGORY_COLORS, type Category, type ThemePref } from '../domain/types';
import { useTheme } from '../theme/ThemeProvider';
import { catBg } from './categoryColor';
import { cx } from './cx';
import { Chip, TimeInput } from './form';
import { Icon } from './Icon';
import { SegmentedControl } from './SegmentedControl';
import { Sheet } from './Sheet';
import { Toggle } from './Toggle';
import { useInstall } from '../pwa/install';

/** Opened from the avatar: theme, wake/sleep anchors, categories, and your account. */
export function SettingsSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { pref, setPref } = useTheme();
  const auth = useAuth();
  const { data: settings } = useSettings();
  const update = useUpdateSettings();
  const demo = useDemoMode();

  return (
    <Sheet open={open} onClose={onClose} title="Settings">
      <Section title="Theme">
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
      </Section>

      {supabaseConfigured && <DemoModeSection />}

      {settings && (
        <Section title={demo ? 'Anchors (demo)' : 'Anchors'}>
          <div className="grid grid-cols-2 gap-2">
            <label className="flex flex-col gap-1 rounded-xl bg-surface-2 px-3 py-2">
              <span className="text-label-sm uppercase text-faint">Wake</span>
              <TimeInput label="Wake anchor" value={settings.wakeAnchor} onChange={(m) => update.mutate({ wakeAnchor: m })} />
            </label>
            <label className="flex flex-col gap-1 rounded-xl bg-surface-2 px-3 py-2">
              <span className="text-label-sm uppercase text-faint">Sleep</span>
              <TimeInput label="Sleep anchor" value={settings.sleepAnchor} onChange={(m) => update.mutate({ sleepAnchor: m })} />
            </label>
          </div>
          <div className="flex flex-col gap-1.5">
            <span className="text-label-sm uppercase text-faint">On time means within</span>
            <div className="flex flex-wrap gap-1.5">
              {[15, 30, 45, 60].map((m) => (
                <Chip key={m} active={settings.onTimeToleranceMin === m} onClick={() => update.mutate({ onTimeToleranceMin: m })}>
                  {m} min
                </Chip>
              ))}
            </div>
          </div>
          <p className="text-body-sm text-muted">
            The day view runs from wake to sleep. Insights counts a wake or bedtime as on time within{' '}
            {settings.onTimeToleranceMin} minutes of its anchor.
          </p>
        </Section>
      )}

      <Section title={demo ? 'Categories (demo)' : 'Categories'}>
        <CategoryEditor />
      </Section>

      <InstallSection />

      <Section title="Account">
        {auth.status === 'signedIn' ? (
          <div className="flex items-center justify-between gap-2 rounded-xl bg-surface-2 px-3 py-2">
            <span className="truncate text-body-md">{auth.email}</span>
            <button onClick={() => signOut()} className="flex shrink-0 items-center gap-1 text-label-lg font-semibold text-muted hover:text-text">
              <Icon name="logout" size={18} /> Sign out
            </button>
          </div>
        ) : (
          <p className="rounded-xl bg-warn/10 p-3 text-body-sm text-warn-ink">
            Supabase is not connected in this build, so the app runs on sample data and changes disappear when you
            reload.
          </p>
        )}
      </Section>
    </Sheet>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-2 py-3">
      <h3 className="text-label-sm font-semibold uppercase text-faint">{title}</h3>
      {children}
    </section>
  );
}

/** Rename (edit and leave the field), recolor (tap the dot), delete (tap twice), or add. */
function CategoryEditor() {
  const { data: categories = [] } = useCategories();
  const save = useSaveCategory();
  const remove = useDeleteCategory();
  const [confirm, setConfirm] = useState<string | null>(null);
  const [draft, setDraft] = useState('');

  const nextColor = (c: Category) =>
    CATEGORY_COLORS[(CATEGORY_COLORS.indexOf(c.color) + 1) % CATEGORY_COLORS.length]!;
  const unusedColor = () => CATEGORY_COLORS.find((col) => !categories.some((c) => c.color === col)) ?? 'cat-1';

  const add = () => {
    const name = draft.trim();
    if (!name || categories.some((c) => c.name.toLowerCase() === name.toLowerCase())) return;
    save.mutate({ id: newId(), name, color: unusedColor(), sortOrder: categories.length });
    setDraft('');
  };

  return (
    <div className="flex flex-col gap-1.5">
      {categories.map((c) => (
        <div key={c.id} className="flex items-center gap-2 rounded-xl bg-surface-2 px-2 py-1.5">
          <button
            type="button"
            aria-label={`Change color of ${c.name}`}
            onClick={() => save.mutate({ ...c, color: nextColor(c) })}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full hover:bg-surface-3"
          >
            <span className={cx('h-3.5 w-3.5 rounded-full', catBg(c))} />
          </button>
          <input
            defaultValue={c.name}
            aria-label={`Name of ${c.name}`}
            onBlur={(e) => {
              const name = e.target.value.trim();
              if (name && name !== c.name) save.mutate({ ...c, name });
              else e.target.value = c.name;
            }}
            onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
            className="min-w-0 flex-1 bg-transparent text-body-md outline-none"
          />
          <button
            type="button"
            onClick={() => (confirm === c.id ? (remove.mutate(c.id), setConfirm(null)) : setConfirm(c.id))}
            className={cx(
              'shrink-0 rounded-full px-2 py-1 text-label-sm font-semibold',
              confirm === c.id ? 'bg-miss/15 text-miss-ink' : 'text-faint hover:text-text',
            )}
            aria-label={`Delete ${c.name}`}
          >
            {confirm === c.id ? 'Delete?' : <Icon name="delete" size={18} />}
          </button>
        </div>
      ))}
      <div className="flex items-center gap-2 rounded-xl border border-dashed border-border px-2 py-1.5">
        <Icon name="add" size={18} className="ml-1.5 text-faint" />
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && add()}
          placeholder="Add a category"
          aria-label="New category name"
          className="min-w-0 flex-1 bg-transparent py-1 text-body-md outline-none placeholder:text-faint"
        />
        {draft.trim() && (
          <button type="button" onClick={add} className="rounded-full bg-primary px-3 py-1 text-label-md font-semibold text-on-primary">
            Add
          </button>
        )}
      </div>
      {confirm && <p className="text-label-sm text-faint">Habits in a deleted category keep working, just without a category.</p>}
    </div>
  );
}

/**
 * Demo mode: shows sample routines and history so you can try features while the app is being built.
 * Your real data stays in Supabase, untouched and hidden until you switch back.
 */
function DemoModeSection() {
  const demo = useDemoMode();
  const setDemo = useSetDemoMode();
  return (
    <Section title="Demo mode">
      <div className={cx('flex flex-col gap-2 rounded-xl px-3 py-2.5', demo ? 'bg-warn/10' : 'bg-surface-2')}>
        <div className="flex items-center justify-between gap-3">
          <span className="text-label-lg font-semibold">Show sample data</span>
          <Toggle label="Demo mode" checked={demo} onChange={setDemo} />
        </div>
        <p className="text-body-sm text-muted">
          {demo
            ? 'On: you are looking at sample routines. Your real data is safe and hidden. Anything you change now is thrown away when you reload or switch off.'
            : 'Try features on months of sample history. Your real data is never changed, replaced, or mixed in; switch off to return to it.'}
        </p>
      </div>
    </Section>
  );
}

/** Install Cadence as an app (Chrome on Android, desktop Chrome and Edge). */
function InstallSection() {
  const { state, install } = useInstall();
  return (
    <Section title="App">
      {state === 'can-install' ? (
        <div className="flex items-center justify-between gap-3 rounded-xl bg-surface-2 px-3 py-2.5">
          <span className="flex min-w-0 flex-col">
            <span className="text-label-lg font-semibold">Install Cadence</span>
            <span className="text-body-sm text-muted">Opens like an app from your home screen, and works offline.</span>
          </span>
          <button
            type="button"
            onClick={() => void install()}
            className="flex shrink-0 items-center gap-1 rounded-full bg-primary px-3.5 py-2 text-label-lg font-semibold text-on-primary shadow-card active:scale-95"
          >
            <Icon name="download" size={18} /> Install app
          </button>
        </div>
      ) : (
        <p className="flex items-start gap-2 rounded-xl bg-surface-2 px-3 py-2.5 text-body-sm text-muted">
          <Icon name={state === 'unavailable' ? 'info' : 'check_circle'} size={18} className="mt-px shrink-0 text-primary" />
          {state === 'installed-app'
            ? 'You are using the installed app.'
            : state === 'just-installed'
              ? 'Installed. Open Cadence from your home screen or app drawer.'
              : 'Cadence may already be installed: look for it in your app drawer. If not, use your browser menu (⋮ in Chrome) and choose Install app.'}
        </p>
      )}
    </Section>
  );
}

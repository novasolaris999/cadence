import { useState, type ReactNode } from 'react';
import { signOut, useAuth } from '../data/auth';
import { newId } from '../data/api';
import { useCategories, useDeleteCategory, useSaveCategory, useSettings, useUpdateSettings } from '../data/queries';
import { CATEGORY_COLORS, type Category, type ThemePref } from '../domain/types';
import { useTheme } from '../theme/ThemeProvider';
import { catBg } from './categoryColor';
import { cx } from './cx';
import { TimeInput } from './form';
import { Icon } from './Icon';
import { SegmentedControl } from './SegmentedControl';
import { Sheet } from './Sheet';

/** Opened from the avatar: theme, wake/sleep anchors, categories, and your account. */
export function SettingsSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { pref, setPref } = useTheme();
  const auth = useAuth();
  const { data: settings } = useSettings();
  const update = useUpdateSettings();

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

      {settings && (
        <Section title="Anchors">
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
          <p className="text-body-sm text-muted">
            The day view runs from wake to sleep. On time means within {settings.onTimeToleranceMin} minutes of the anchor.
          </p>
        </Section>
      )}

      <Section title="Categories">
        <CategoryEditor />
      </Section>

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
            Demo data: Supabase is not connected in this build, so changes disappear when you reload.
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
      {confirm && <p className="text-label-sm text-faint">Targets in a deleted category keep working, just without a category.</p>}
    </div>
  );
}

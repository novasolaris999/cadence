import { useEffect, useState, type ReactNode } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { cx } from '../../components/cx';
import { catBg, catSoft } from '../../components/categoryColor';
import { Icon, isIconName, type IconName } from '../../components/Icon';
import { Page } from '../../components/Page';
import { Toggle } from '../../components/Toggle';
import { useBlocks, useCategories, useSaveTarget, useTargets } from '../../data/queries';
import { pct, tally, targetStreak } from '../../domain/metrics';
import { targetDays } from '../../domain/schedule';
import { addDays, formatDays, formatDuration, formatTime, parseTime, weekdayInitial } from '../../domain/time';
import type { Target, Weekday } from '../../domain/types';
import { useNow } from '../../theme/useNow';

const ICONS: IconName[] = [
  'fitness_center', 'sports_tennis', 'directions_run', 'self_improvement', 'pill', 'wb_sunny',
  'menu_book', 'edit_note', 'psychology', 'favorite', 'restaurant', 'local_cafe', 'work', 'bedtime',
];
const DURATIONS = [15, 30, 45, 60, 90, 120];
const WEEKDAYS: Weekday[] = [1, 2, 3, 4, 5, 6, 7];

const blank = (): Target => ({
  id: `t-${Date.now()}`,
  categoryId: null,
  name: '',
  description: null,
  icon: 'check_circle',
  durationMin: 30,
  frequencyPerWeek: 3,
  preferredDays: [],
  preferredStart: 9 * 60,
  windowEnd: null,
  protected: false,
  active: true,
});

/** A target's rules: what it is, when it lands, and how the scheduler treats it (targets-light.html). */
export function TargetDetailScreen() {
  const { targetId } = useParams();
  const navigate = useNavigate();
  const now = useNow();
  const { data: targets, isLoading } = useTargets();
  const { data: categories = [] } = useCategories();
  const save = useSaveTarget();
  const existing = targets?.find((t) => t.id === targetId);
  const [draft, setDraft] = useState<Target | null>(targetId ? null : blank());

  useEffect(() => {
    if (existing && !draft) setDraft(existing);
  }, [existing, draft]);

  const { data: history = [] } = useBlocks(addDays(now.today, -56), now.today);

  if (targetId && !isLoading && !existing) {
    return (
      <Page>
        <p className="py-10 text-center text-muted">
          Target not found. <Link to="/goals" className="text-primary-ink underline">Back to goals</Link>
        </p>
      </Page>
    );
  }
  if (!draft) return null;

  const set = <K extends keyof Target>(k: K, v: Target[K]) => setDraft({ ...draft, [k]: v });
  const category = categories.find((c) => c.id === draft.categoryId) ?? null;
  const mine = history.filter((b) => b.targetId === draft.id);
  const stats = tally(mine, now.today);
  const days = targetDays(draft);
  const canSave = draft.name.trim().length > 0;

  const toggleDay = (w: Weekday) => {
    const has = draft.preferredDays.includes(w);
    const next = has ? draft.preferredDays.filter((d) => d !== w) : [...draft.preferredDays, w].sort((a, b) => a - b);
    // Rule: picked days decide the frequency. With no days, frequency is set by hand.
    setDraft({ ...draft, preferredDays: next, frequencyPerWeek: next.length || draft.frequencyPerWeek });
  };

  const commit = (t: Target) => save.mutate(t, { onSuccess: () => navigate('/goals') });

  return (
    <Page>
      <div className="flex flex-col gap-4 pb-20">
        <div className="flex items-center gap-2">
          <Link to="/goals" aria-label="Back to goals" className="rounded-full p-1.5 text-muted hover:bg-surface-2">
            <Icon name="arrow_back" />
          </Link>
          <div className="flex min-w-0 flex-col">
            <span className="flex items-center gap-1 text-label-sm font-bold uppercase tracking-wider text-hit-ink">
              <Icon name="event_repeat" size={14} /> Target rules
            </span>
            <h1 className="truncate text-headline-lg font-bold">{existing ? draft.name || 'Untitled' : 'New target'}</h1>
          </div>
        </div>

        {/* Identity */}
        <Card>
          <div className="flex items-start gap-3">
            <div className={cx('flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-text', catSoft(category))}>
              <Icon name={isIconName(draft.icon) ? draft.icon : 'check_circle'} size={22} />
            </div>
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <input
                value={draft.name}
                onChange={(e) => set('name', e.target.value)}
                placeholder="Name, e.g. Gym session"
                aria-label="Name"
                className="w-full rounded-md bg-transparent font-display text-headline-sm font-bold outline-none placeholder:text-faint"
              />
              <input
                value={draft.description ?? ''}
                onChange={(e) => set('description', e.target.value || null)}
                placeholder="Short description (optional)"
                aria-label="Description"
                className="w-full rounded-md bg-transparent text-body-sm text-muted outline-none placeholder:text-faint"
              />
            </div>
          </div>
          <div className="no-scrollbar -mx-1 flex gap-1 overflow-x-auto px-1 pt-1">
            {ICONS.map((i) => (
              <button
                key={i}
                type="button"
                aria-label={`Icon ${i.replace(/_/g, ' ')}`}
                aria-pressed={draft.icon === i}
                onClick={() => set('icon', i)}
                className={cx(
                  'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg',
                  draft.icon === i ? 'bg-primary text-on-primary' : 'bg-surface-2 text-muted hover:text-text',
                )}
              >
                <Icon name={i} size={18} />
              </button>
            ))}
          </div>
          <Field label="Category">
            <div className="flex flex-wrap gap-1.5">
              {categories.map((c) => (
                <Chip key={c.id} active={draft.categoryId === c.id} onClick={() => set('categoryId', c.id)}>
                  <span className={cx('h-2 w-2 rounded-full', catBg(c))} />
                  {c.name}
                </Chip>
              ))}
            </div>
          </Field>
        </Card>

        {/* Schedule */}
        <SectionTitle color="bg-hit">Schedule</SectionTitle>
        <Card>
          <Field label="Duration" hint={formatDuration(draft.durationMin)}>
            <div className="flex flex-wrap gap-1.5">
              {DURATIONS.map((d) => (
                <Chip key={d} active={draft.durationMin === d} onClick={() => set('durationMin', d)}>
                  {formatDuration(d)}
                </Chip>
              ))}
            </div>
          </Field>
          <Field label="Days" hint={formatDays(days, draft.frequencyPerWeek)}>
            <div className="grid grid-cols-7 gap-1.5">
              {WEEKDAYS.map((w) => (
                <button
                  key={w}
                  type="button"
                  aria-pressed={draft.preferredDays.includes(w)}
                  onClick={() => toggleDay(w)}
                  className={cx(
                    'h-9 rounded-lg text-label-lg font-semibold',
                    draft.preferredDays.includes(w)
                      ? 'bg-primary text-on-primary'
                      : days.includes(w)
                        ? 'bg-primary/10 text-primary-ink ring-1 ring-inset ring-primary/30'
                        : 'bg-surface-2 text-muted',
                  )}
                >
                  {weekdayInitial(w)}
                </button>
              ))}
            </div>
            {draft.preferredDays.length === 0 && (
              <div className="mt-2 flex items-center justify-between rounded-lg bg-surface-2 px-3 py-2">
                <span className="text-body-sm text-muted">No days picked: spread across the week</span>
                <Stepper
                  value={draft.frequencyPerWeek}
                  min={1}
                  max={7}
                  label="Times per week"
                  format={(n) => `${n}x`}
                  onChange={(n) => set('frequencyPerWeek', n)}
                />
              </div>
            )}
          </Field>
          <Field label="Start time">
            <div className="flex flex-wrap items-center gap-2">
              <TimeInput label="Start time" value={draft.preferredStart} onChange={(m) => set('preferredStart', m)} />
              {draft.windowEnd !== null ? (
                <>
                  <span className="text-muted">to</span>
                  <TimeInput label="Window end" value={draft.windowEnd} onChange={(m) => set('windowEnd', m)} />
                  <button type="button" onClick={() => set('windowEnd', null)} className="text-label-md text-muted underline">
                    Fixed time
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => set('windowEnd', draft.preferredStart + draft.durationMin + 60)}
                  className="text-label-md text-primary-ink underline"
                >
                  Use a window
                </button>
              )}
            </div>
            <p className="mt-1 text-body-sm text-faint">
              Blocks are placed at {formatTime(draft.preferredStart)}
              {draft.windowEnd !== null && `; the window to ${formatTime(draft.windowEnd)} is for reference`}.
            </p>
          </Field>
        </Card>

        {/* Rules */}
        <SectionTitle color="bg-primary">Rules</SectionTitle>
        <Card>
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 flex-col">
              <span className="flex items-center gap-1.5 text-label-lg font-semibold">
                <Icon name="shield" size={18} className="text-primary" /> Protected
              </span>
              <span className="text-body-sm text-muted">Re-run never moves or regenerates these blocks.</span>
            </div>
            <Toggle label="Protected" checked={draft.protected} onChange={(v) => set('protected', v)} />
          </div>
        </Card>

        {existing && (
          <Card>
            <div className="flex items-center justify-between">
              <span className="text-label-sm font-bold uppercase tracking-wider text-faint">Last 8 weeks</span>
              <span className="text-label-md text-muted">
                Streak {targetStreak(mine, now.today)}
              </span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="font-display text-metric font-bold">{pct(stats.rate)}</span>
              <span className="text-body-sm text-muted">
                {stats.hits} hits · {stats.misses} misses
              </span>
            </div>
          </Card>
        )}

        {existing && (
          <button
            type="button"
            onClick={() => commit({ ...draft, active: !draft.active })}
            className="flex items-center justify-center gap-1.5 rounded-full border border-border py-2.5 text-label-lg font-semibold text-muted hover:text-text"
          >
            <Icon name="archive" size={18} />
            {draft.active ? 'Archive target' : 'Restore target'}
          </button>
        )}
      </div>

      <div className="pb-safe fixed inset-x-0 bottom-16 z-40 mx-auto max-w-xl px-4 pb-3">
        <button
          type="button"
          disabled={!canSave}
          onClick={() => commit(draft)}
          className="w-full rounded-full bg-primary py-3 text-label-lg font-semibold text-on-primary shadow-float active:scale-[0.98] disabled:opacity-40"
        >
          {existing ? 'Save changes' : 'Create target'}
        </button>
      </div>
    </Page>
  );
}

function Card({ children }: { children: ReactNode }) {
  return <section className="flex flex-col gap-3 rounded-2xl border border-border bg-surface p-4 shadow-card">{children}</section>;
}

function SectionTitle({ children, color }: { children: ReactNode; color: string }) {
  return (
    <h2 className="flex items-center gap-2 text-headline-sm font-bold">
      <span className={cx('h-4 w-1.5 rounded-full', color)} />
      {children}
    </h2>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between">
        <span className="text-label-sm font-semibold uppercase tracking-wider text-faint">{label}</span>
        {hint && <span className="text-label-md font-semibold text-primary-ink">{hint}</span>}
      </div>
      {children}
    </div>
  );
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cx(
        'flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-label-md font-medium',
        active ? 'border-primary bg-primary/10 text-primary-ink' : 'border-border bg-surface-2 text-muted hover:text-text',
      )}
    >
      {children}
    </button>
  );
}

function Stepper({
  value,
  min,
  max,
  label,
  format,
  onChange,
}: {
  value: number;
  min: number;
  max: number;
  label: string;
  format: (n: number) => string;
  onChange: (n: number) => void;
}) {
  return (
    <div className="flex items-center gap-1" role="group" aria-label={label}>
      <button type="button" aria-label="Fewer" disabled={value <= min} onClick={() => onChange(value - 1)} className="h-7 w-7 rounded-full bg-surface text-muted disabled:opacity-30">
        –
      </button>
      <span className="w-8 text-center text-label-lg font-semibold">{format(value)}</span>
      <button type="button" aria-label="More" disabled={value >= max} onClick={() => onChange(value + 1)} className="h-7 w-7 rounded-full bg-surface text-muted disabled:opacity-30">
        +
      </button>
    </div>
  );
}

/** Native time picker, snapped to the 15-minute grid. */
function TimeInput({ label, value, onChange }: { label: string; value: number; onChange: (m: number) => void }) {
  return (
    <input
      type="time"
      step={900}
      aria-label={label}
      value={formatTime(value)}
      onChange={(e) => e.target.value && onChange(Math.round(parseTime(e.target.value) / 15) * 15)}
      className="rounded-lg border border-border bg-surface-2 px-2.5 py-1.5 font-mono text-body-md text-text"
    />
  );
}

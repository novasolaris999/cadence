import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router';
import { cx } from '../../components/cx';
import { catBg, catSoft } from '../../components/categoryColor';
import { Icon, isIconName } from '../../components/Icon';
import { Page } from '../../components/Page';
import { Toggle } from '../../components/Toggle';
import { Chip, DaysPicker, DURATIONS, Field, FormCard, HABIT_ICONS, SectionTitle, TimeInput } from '../../components/form';
import { newId } from '../../data/api';
import { useBlocks, useCategories, useRoutines, useSaveTarget, useTargets } from '../../data/queries';
import { pct, tally, targetStreak } from '../../domain/metrics';
import { targetDays } from '../../domain/schedule';
import { addDays, formatDays, formatDuration, formatTime } from '../../domain/time';
import type { Target, Weekday } from '../../domain/types';
import { QUICK, ROUTINE_DURATIONS, copyHabit, habitLength } from '../../domain/routines';
import { useNow } from '../../theme/useNow';

const blank = (): Target => ({
  id: newId(),
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
  createdAt: new Date().toISOString(), // an instant, not a schedule date; the database sets its own
  routineId: null,
  routineOrder: 0,
});

/**
 * New-target defaults, optionally prefilled from the add sheet on Today or Weekly
 * (?name=&start=&duration=&day=&category=).
 */
function fromParams(p: URLSearchParams): Target {
  const t = blank();
  const num = (k: string) => {
    const v = Number(p.get(k));
    return Number.isFinite(v) && p.has(k) ? v : null;
  };
  const day = num('day');
  return {
    ...t,
    name: p.get('name') ?? t.name,
    categoryId: p.get('category') ?? t.categoryId,
    preferredStart: num('start') ?? t.preferredStart,
    durationMin: num('duration') ?? t.durationMin,
    ...(day && day >= 1 && day <= 7 ? { preferredDays: [day as Weekday], frequencyPerWeek: 1 } : {}),
  };
}

/**
 * A habit's rules: what it is, when it lands, and how the scheduler treats it (targets-light.html).
 * A fresh form per page (and per copy), so going from one habit straight to another never shows stale edits.
 * /goals/new?copy=<id> starts from a copy of another habit.
 */
export function TargetDetailScreen() {
  const { targetId } = useParams();
  const [params] = useSearchParams();
  return <TargetDetailScreenForm key={`${targetId ?? 'new'}-${params.get('copy') ?? ''}`} />;
}

function TargetDetailScreenForm() {
  const { targetId } = useParams();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const now = useNow();
  const { data: targets, isLoading } = useTargets();
  const { data: categories = [] } = useCategories();
  const save = useSaveTarget();
  const existing = targets?.find((t) => t.id === targetId);
  const { data: routines = [] } = useRoutines();
  const copyOf = params.get('copy');
  const source = copyOf ? targets?.find((t) => t.id === copyOf) : undefined;
  const [draft, setDraft] = useState<Target | null>(() => (targetId || copyOf ? null : fromParams(params)));
  const nameInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (draft) return;
    if (existing) setDraft(existing);
    else if (copyOf && targets) {
      const from = targets.find((t) => t.id === copyOf);
      const routineOf = from?.routineId ? (routines.find((r) => r.id === from.routineId) ?? null) : null;
      setDraft(from ? copyHabit(from, routineOf, newId(), new Date().toISOString()) : fromParams(params));
    }
  }, [existing, draft, copyOf, targets, routines, params]);

  // A copy starts with its name selected: type the new name straight over it.
  useEffect(() => {
    if (copyOf && draft) nameInput.current?.select();
  }, [copyOf, draft !== null]);

  const { data: history = [] } = useBlocks(addDays(now.today, -56), now.today);

  if (targetId && !isLoading && !existing) {
    return (
      <Page>
        <p className="py-10 text-center text-muted">
          Habit not found. <Link to="/goals" className="text-primary-ink underline">Back to habits</Link>
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
  // In a routine, the routine decides days, time, and protected; the habit keeps its name and length.
  const routine = routines.find((r) => r.id === draft.routineId) ?? null;
  const quick = draft.durationMin === QUICK;
  const durations = routine ? ROUTINE_DURATIONS : [QUICK, ...DURATIONS];

  // A quick habit outside a routine has no time: it shows under "Anytime".
  const prepared = (t: Target) => (t.durationMin === QUICK && !t.routineId ? { ...t, preferredStart: 0, windowEnd: null } : t);
  const commit = (t: Target) => save.mutate(prepared(t), { onSuccess: () => navigate('/goals') });
  /** Saves, then starts the next habit with the same settings: only the name is cleared. */
  const commitAndNext = () =>
    save.mutate(prepared(draft), {
      onSuccess: () => {
        setDraft({ ...draft, id: newId(), name: '', description: null, createdAt: new Date().toISOString() });
        window.scrollTo({ top: 0 });
        nameInput.current?.focus();
      },
    });

  return (
    <Page>
      <div className="flex flex-col gap-4 pb-20">
        <div className="flex items-center gap-2">
          <Link to="/goals" aria-label="Back to habits" className="rounded-full p-1.5 text-muted hover:bg-surface-2">
            <Icon name="arrow_back" />
          </Link>
          <div className="flex min-w-0 flex-col">
            <span className="flex items-center gap-1 text-label-sm font-bold uppercase tracking-wider text-hit-ink">
              <Icon name="event_repeat" size={14} /> Habit
            </span>
            <h1 className="truncate text-headline-lg font-bold">{existing ? draft.name || 'Untitled' : 'New habit'}</h1>
          </div>
          {existing && (
            <Link
              to={`/goals/new?copy=${existing.id}`}
              className="ml-auto flex h-9 shrink-0 items-center gap-1 rounded-full border border-border px-3 text-label-lg font-semibold text-muted hover:text-text"
            >
              <Icon name="content_copy" size={16} /> Duplicate
            </Link>
          )}
        </div>

        {source && (
          <p className="-mt-1 flex items-center gap-2 rounded-xl bg-primary/10 px-3 py-2 text-body-sm text-primary-ink">
            <Icon name="content_copy" size={16} />
            Copy of {source.name}. Change the name and time, then create.
          </p>
        )}

        {/* Identity */}
        <FormCard>
          <div className="flex items-start gap-3">
            <div className={cx('flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-text', catSoft(category))}>
              <Icon name={isIconName(draft.icon) ? draft.icon : 'check_circle'} size={22} />
            </div>
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <input
                ref={nameInput}
                value={draft.name}
                onChange={(e) => set('name', e.target.value)}
                placeholder="Name, e.g. Gym session or Vitamin D"
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
            {HABIT_ICONS.map((i) => (
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
        </FormCard>

        {/* Schedule */}
        <SectionTitle color="bg-hit">Schedule</SectionTitle>
        <FormCard>
          <Field label="Length" hint={habitLength(draft.durationMin)}>
            <div className="flex flex-wrap gap-1.5">
              {durations.map((d) => (
                <Chip key={d} active={draft.durationMin === d} onClick={() => set('durationMin', d)}>
                  {d === QUICK ? (
                    <>
                      <Icon name="bolt" size={14} /> Quick
                    </>
                  ) : (
                    formatDuration(d)
                  )}
                </Chip>
              ))}
            </div>
            {quick && (
              <p className="mt-1 text-body-sm text-faint">
                {routine ? 'A tick inside the routine, no time of its own.' : 'A quick tick with no time slot. It shows under Anytime on Today.'}
              </p>
            )}
          </Field>
          {routine ? (
            <Link
              to={`/goals/routine/${routine.id}`}
              className="flex items-center gap-3 rounded-xl bg-primary/10 p-3 text-left hover:bg-primary/15"
            >
              <Icon name={isIconName(routine.icon) ? routine.icon : 'event_repeat'} size={22} className="text-primary-ink" />
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="text-label-lg font-semibold text-primary-ink">Part of {routine.name}</span>
                <span className="text-body-sm text-muted">
                  {formatDays(targetDays(routine), routine.frequencyPerWeek)} at {formatTime(routine.preferredStart)}. Days and time come from
                  the routine.
                </span>
              </span>
              <Icon name="chevron_right" className="text-faint" />
            </Link>
          ) : (
          <>
          <Field label="Days" hint={formatDays(days, draft.frequencyPerWeek)}>
            <DaysPicker
              days={draft.preferredDays}
              frequency={draft.frequencyPerWeek}
              onChange={(preferredDays, frequencyPerWeek) => setDraft({ ...draft, preferredDays, frequencyPerWeek })}
            />
          </Field>
          {!quick && (
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
          )}
          </>
          )}
        </FormCard>

        {/* Rules */}
        {!routine && <SectionTitle color="bg-primary">Rules</SectionTitle>}
        {!routine && (
        <FormCard>
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 flex-col">
              <span className="flex items-center gap-1.5 text-label-lg font-semibold">
                <Icon name="shield" size={18} className="text-primary" /> Protected
              </span>
              <span className="text-body-sm text-muted">Re-run never moves or regenerates these blocks.</span>
            </div>
            <Toggle label="Protected" checked={draft.protected} onChange={(v) => set('protected', v)} />
          </div>
        </FormCard>
        )}

        {existing && (
          <FormCard>
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
          </FormCard>
        )}

        {existing && (
          <button
            type="button"
            onClick={() => commit({ ...draft, active: !draft.active })}
            className="flex items-center justify-center gap-1.5 rounded-full border border-border py-2.5 text-label-lg font-semibold text-muted hover:text-text"
          >
            <Icon name="archive" size={18} />
            {draft.active ? 'Archive habit' : 'Restore habit'}
          </button>
        )}
      </div>

      <div className="pb-safe fixed inset-x-0 bottom-16 z-40 mx-auto max-w-xl px-4 pb-3">
        <div className="flex gap-2">
          {!existing && (
            <button
              type="button"
              disabled={!canSave || save.isPending}
              onClick={commitAndNext}
              className="flex shrink-0 items-center justify-center gap-1 rounded-full border border-primary/30 bg-surface px-4 py-3 text-label-lg font-semibold text-primary-ink shadow-float active:scale-[0.98] disabled:opacity-40"
            >
              <Icon name="playlist_add" size={18} /> Save & add another
            </button>
          )}
          <button
            type="button"
            disabled={!canSave || save.isPending}
            onClick={() => commit(draft)}
            className="w-full rounded-full bg-primary py-3 text-label-lg font-semibold text-on-primary shadow-float active:scale-[0.98] disabled:opacity-40"
          >
            {existing ? 'Save changes' : 'Create habit'}
          </button>
        </div>
      </div>
    </Page>
  );
}

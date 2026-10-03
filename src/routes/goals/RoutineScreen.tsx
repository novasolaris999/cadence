import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router';
import { cx } from '../../components/cx';
import { catBg } from '../../components/categoryColor';
import { Icon } from '../../components/Icon';
import { Page } from '../../components/Page';
import { RoutineIcon } from '../../components/RoutineParts';
import { Toggle } from '../../components/Toggle';
import { Chip, DaysPicker, Field, FormCard, HABIT_ICONS, SectionTitle, TimeInput } from '../../components/form';
import { newId } from '../../data/api';
import { useCategories, useRoutines, useSaveRoutine, useTargets } from '../../data/queries';
import { QUICK, ROUTINE_DURATIONS, ROUTINE_TEMPLATES, habitLength, routineMinutes, routineSpan } from '../../domain/routines';
import { targetDays } from '../../domain/schedule';
import { formatDays, formatDuration, formatTimeRange } from '../../domain/time';
import type { Category, Routine, Target } from '../../domain/types';

interface Draft {
  routine: Routine;
  /** In order. */
  habits: Target[];
  /** Habits taken out: archived on save (their history stays). */
  removed: Target[];
}

const newHabit = (name: string, durationMin: number, categoryId: string | null): Target => ({
  id: newId(),
  categoryId,
  name,
  description: null,
  icon: null,
  durationMin,
  frequencyPerWeek: 7,
  preferredDays: [],
  preferredStart: 0,
  windowEnd: null,
  protected: false,
  active: true,
  createdAt: new Date().toISOString(), // an instant, not a schedule date; the database sets its own
  routineId: null,
  routineOrder: 0,
});

/** A new routine, from a starter template (?template=sleep) or blank. */
function fresh(templateKey: string | null, categories: Category[]): Draft {
  const tpl = ROUTINE_TEMPLATES.find((t) => t.key === templateKey);
  const categoryId = (tpl && categories.find((c) => c.name.toLowerCase() === tpl.category.toLowerCase())?.id) ?? null;
  return {
    routine: {
      id: newId(),
      categoryId,
      name: tpl?.name ?? '',
      icon: tpl?.icon ?? 'event_repeat',
      frequencyPerWeek: tpl?.days.length ?? 7,
      preferredDays: tpl ? [...tpl.days] : [1, 2, 3, 4, 5, 6, 7],
      preferredStart: tpl?.start ?? 7 * 60,
      protected: false,
      active: true,
      createdAt: new Date().toISOString(),
    },
    habits: (tpl?.habits ?? []).map((h) => newHabit(h.name, h.durationMin, categoryId)),
    removed: [],
  };
}

/**
 * A routine: its habits in order (like the exercises in a superset), when it runs, and its rules.
 * Saving copies the days, time, and protected flag onto every habit in it.
 */
/** A fresh form per page, so going from one routine straight to another never shows stale edits. */
export function RoutineScreen() {
  const { routineId } = useParams();
  const [params] = useSearchParams();
  return <RoutineScreenForm key={routineId ?? `new-${params.get('template') ?? ''}`} />;
}

function RoutineScreenForm() {
  const { routineId } = useParams();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { data: routines, isLoading } = useRoutines();
  const { data: targets = [] } = useTargets();
  const { data: categories, isSuccess: categoriesLoaded } = useCategories();
  const save = useSaveRoutine();
  const existing = routines?.find((r) => r.id === routineId);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [adding, setAdding] = useState('');
  const [openLength, setOpenLength] = useState<string | null>(null);

  useEffect(() => {
    if (draft) return;
    if (existing) {
      // An archived routine's habits are archived with it; show them so Restore brings them all back.
      const habits = targets
        .filter((t) => t.routineId === existing.id && (t.active || !existing.active))
        .sort((a, b) => a.routineOrder - b.routineOrder);
      setDraft({ routine: existing, habits, removed: [] });
    } else if (!routineId && categoriesLoaded) {
      setDraft(fresh(params.get('template'), categories ?? []));
    }
  }, [existing, targets, draft, routineId, categoriesLoaded, categories, params]);

  if (routineId && !isLoading && !existing) {
    return (
      <Page>
        <p className="py-10 text-center text-muted">
          Routine not found. <Link to="/goals" className="text-primary-ink underline">Back to habits</Link>
        </p>
      </Page>
    );
  }
  if (!draft) return null;

  const { routine, habits } = draft;
  const setRoutine = (patch: Partial<Routine>) => setDraft({ ...draft, routine: { ...routine, ...patch } });
  const setHabit = (id: string, patch: Partial<Target>) =>
    setDraft({ ...draft, habits: habits.map((h) => (h.id === id ? { ...h, ...patch } : h)) });
  const moveHabit = (i: number, by: -1 | 1) => {
    const next = [...habits];
    const [h] = next.splice(i, 1);
    next.splice(i + by, 0, h!);
    setDraft({ ...draft, habits: next });
  };
  const removeHabit = (h: Target) => {
    const known = targets.some((t) => t.id === h.id);
    setDraft({ ...draft, habits: habits.filter((x) => x.id !== h.id), removed: known ? [...draft.removed, h] : draft.removed });
  };
  const addHabit = (name: string) => {
    if (!name.trim()) return;
    setDraft({ ...draft, habits: [...habits, newHabit(name.trim(), QUICK, routine.categoryId)] });
    setAdding('');
  };
  // Habits you already track on their own can join (they keep their history).
  const joinable = targets.filter(
    (t) => t.active && !t.routineId && !habits.some((h) => h.id === t.id) && t.durationMin % 5 === 0,
  );
  const join = (t: Target) =>
    setDraft({ ...draft, habits: [...habits, t], removed: draft.removed.filter((r) => r.id !== t.id) });

  const minutes = routineMinutes(habits);
  const span = routineSpan(minutes);
  const category = categories?.find((c) => c.id === routine.categoryId) ?? null;
  const canSave = routine.name.trim().length > 0 && habits.length > 0 && habits.every((h) => h.name.trim().length > 0);

  const commit = (r: Routine) =>
    save.mutate(
      {
        routine: r,
        habits: habits.map((h) => ({ ...h, name: h.name.trim(), categoryId: h.categoryId ?? r.categoryId })),
        removed: draft.removed,
      },
      { onSuccess: () => navigate('/goals') },
    );

  return (
    <Page>
      <div className="flex flex-col gap-4 pb-20">
        <div className="flex items-center gap-2">
          <Link to="/goals" aria-label="Back to habits" className="rounded-full p-1.5 text-muted hover:bg-surface-2">
            <Icon name="arrow_back" />
          </Link>
          <div className="flex min-w-0 flex-col">
            <span className="flex items-center gap-1 text-label-sm font-bold uppercase tracking-wider text-primary-ink">
              <Icon name="event_repeat" size={14} /> Routine
            </span>
            <h1 className="truncate text-headline-lg font-bold">{existing ? routine.name || 'Untitled' : 'New routine'}</h1>
          </div>
        </div>

        {/* Identity */}
        <FormCard>
          <div className="flex items-center gap-3">
            <RoutineIcon icon={routine.icon} category={category} size={48} />
            <input
              value={routine.name}
              onChange={(e) => setRoutine({ name: e.target.value })}
              placeholder="Name, e.g. Sleep routine"
              aria-label="Routine name"
              className="w-full min-w-0 rounded-md bg-transparent font-display text-headline-sm font-bold outline-none placeholder:text-faint"
            />
          </div>
          <div className="no-scrollbar -mx-1 flex gap-1 overflow-x-auto px-1">
            {HABIT_ICONS.map((i) => (
              <button
                key={i}
                type="button"
                aria-label={`Icon ${i.replace(/_/g, ' ')}`}
                aria-pressed={routine.icon === i}
                onClick={() => setRoutine({ icon: i })}
                className={cx(
                  'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg',
                  routine.icon === i ? 'bg-primary text-on-primary' : 'bg-surface-2 text-muted hover:text-text',
                )}
              >
                <Icon name={i} size={18} />
              </button>
            ))}
          </div>
          <Field label="Category">
            <div className="flex flex-wrap gap-1.5">
              {(categories ?? []).map((c) => (
                <Chip key={c.id} active={routine.categoryId === c.id} onClick={() => setRoutine({ categoryId: c.id })}>
                  <span className={cx('h-2 w-2 rounded-full', catBg(c))} />
                  {c.name}
                </Chip>
              ))}
            </div>
          </Field>
        </FormCard>

        {/* Habits: the superset */}
        <SectionTitle color="bg-hit">Habits</SectionTitle>
        <FormCard>
          <div className="flex items-center justify-between text-body-sm">
            <span className="text-muted">
              {habits.length} habit{habits.length === 1 ? '' : 's'} · {minutes ? formatDuration(minutes) : 'all quick'}
            </span>
            <span className="font-mono text-label-md font-semibold text-primary-ink">{formatTimeRange(routine.preferredStart, span)}</span>
          </div>

          {habits.length === 0 ? (
            <p className="rounded-xl border border-dashed border-border px-3 py-4 text-center text-body-sm text-faint">
              Add the habits you do together, in the order you do them.
            </p>
          ) : (
            <ol className="relative flex flex-col gap-2">
              <span className={cx('absolute top-5 bottom-5 left-[15px] w-0.5 rounded-full opacity-40', catBg(category))} aria-hidden />
              {habits.map((h, i) => (
                <li key={h.id} className="flex flex-col gap-1.5">
                  <div className="flex items-center gap-2">
                    <span
                      className={cx(
                        'z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full font-mono text-label-md font-bold text-on-primary ring-4 ring-surface',
                        catBg(category),
                      )}
                    >
                      {i + 1}
                    </span>
                    <input
                      value={h.name}
                      onChange={(e) => setHabit(h.id, { name: e.target.value })}
                      aria-label={`Habit ${i + 1} name`}
                      placeholder="Habit name"
                      className="h-10 min-w-0 flex-1 rounded-lg border border-border bg-surface-2 px-2.5 text-body-md text-text outline-none focus:border-primary"
                    />
                    <button
                      type="button"
                      onClick={() => setOpenLength(openLength === h.id ? null : h.id)}
                      aria-expanded={openLength === h.id}
                      aria-label={`Length of ${h.name || 'habit'}: ${habitLength(h.durationMin)}`}
                      className={cx(
                        'flex h-8 w-[76px] shrink-0 items-center justify-center gap-0.5 rounded-full text-label-md font-semibold',
                        h.durationMin === QUICK ? 'bg-primary/10 text-primary-ink' : 'bg-surface-3 text-text',
                      )}
                    >
                      {h.durationMin === QUICK && <Icon name="bolt" size={14} />}
                      {habitLength(h.durationMin)}
                    </button>
                    <div className="flex shrink-0 flex-col">
                      <button type="button" aria-label="Move up" disabled={i === 0} onClick={() => moveHabit(i, -1)} className="text-faint hover:text-text disabled:opacity-25">
                        <Icon name="keyboard_arrow_up" size={18} />
                      </button>
                      <button
                        type="button"
                        aria-label="Move down"
                        disabled={i === habits.length - 1}
                        onClick={() => moveHabit(i, 1)}
                        className="text-faint hover:text-text disabled:opacity-25"
                      >
                        <Icon name="keyboard_arrow_down" size={18} />
                      </button>
                    </div>
                    <button type="button" aria-label={`Remove ${h.name || 'habit'}`} onClick={() => removeHabit(h)} className="shrink-0 rounded-full p-1 text-faint hover:text-miss-ink">
                      <Icon name="close" size={18} />
                    </button>
                  </div>
                  {openLength === h.id && (
                    <div className="ml-10 flex flex-wrap gap-1.5">
                      {ROUTINE_DURATIONS.map((d) => (
                        <Chip
                          key={d}
                          active={h.durationMin === d}
                          onClick={() => {
                            setHabit(h.id, { durationMin: d });
                            setOpenLength(null);
                          }}
                        >
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
                  )}
                </li>
              ))}
            </ol>
          )}

          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              addHabit(adding);
            }}
          >
            <input
              value={adding}
              onChange={(e) => setAdding(e.target.value)}
              placeholder="Add a habit, e.g. Magnesium"
              aria-label="New habit name"
              className="h-10 min-w-0 flex-1 rounded-lg border border-dashed border-border bg-surface px-3 text-body-md text-text outline-none placeholder:text-faint focus:border-primary"
            />
            <button
              type="submit"
              disabled={!adding.trim()}
              className="flex h-10 items-center gap-1 rounded-full bg-primary/10 px-3.5 text-label-lg font-semibold text-primary-ink disabled:opacity-40"
            >
              <Icon name="add" size={18} /> Add
            </button>
          </form>
          <p className="text-body-sm text-faint">
            New habits start as <strong className="font-semibold text-muted">Quick</strong> (a tick, no time). Tap the length to give one minutes.
          </p>
          {joinable.length > 0 && (
            <Field label="Or bring in a habit you already have">
              <div className="flex flex-wrap gap-1.5">
                {joinable.map((t) => (
                  <Chip key={t.id} active={false} onClick={() => join(t)}>
                    <Icon name="add" size={14} /> {t.name}
                  </Chip>
                ))}
              </div>
            </Field>
          )}
          {draft.removed.length > 0 && (
            <p className="text-body-sm text-faint">
              {draft.removed.map((h) => h.name).join(', ')} will be archived when you save (history is kept; restore from Archived).
            </p>
          )}
        </FormCard>

        {/* Schedule */}
        <SectionTitle color="bg-primary">When</SectionTitle>
        <FormCard>
          <Field label="Days" hint={formatDays(targetDays(routine), routine.frequencyPerWeek)}>
            <DaysPicker
              days={routine.preferredDays}
              frequency={routine.frequencyPerWeek}
              onChange={(preferredDays, frequencyPerWeek) => setRoutine({ preferredDays, frequencyPerWeek })}
            />
          </Field>
          <Field label="Starts at">
            <TimeInput label="Start time" value={routine.preferredStart} onChange={(m) => setRoutine({ preferredStart: m })} />
            <p className="mt-1 text-body-sm text-faint">
              On your timeline it takes {formatTimeRange(routine.preferredStart, span)}
              {minutes % 15 !== 0 && minutes > 0 ? ` (${formatDuration(minutes)}, rounded up to the 15-minute grid)` : ''}.
            </p>
          </Field>
          <div className="flex items-center justify-between gap-3 border-t border-border pt-3">
            <div className="flex min-w-0 flex-col">
              <span className="flex items-center gap-1.5 text-label-lg font-semibold">
                <Icon name="shield" size={18} className="text-primary" /> Protected
              </span>
              <span className="text-body-sm text-muted">Re-run never moves these blocks.</span>
            </div>
            <Toggle label="Protected" checked={routine.protected} onChange={(v) => setRoutine({ protected: v })} />
          </div>
        </FormCard>

        {existing && (
          <button
            type="button"
            onClick={() => commit({ ...routine, active: !routine.active })}
            className="flex items-center justify-center gap-1.5 rounded-full border border-border py-2.5 text-label-lg font-semibold text-muted hover:text-text"
          >
            <Icon name="archive" size={18} />
            {routine.active ? 'Archive routine' : 'Restore routine'}
          </button>
        )}
      </div>

      <div className="pb-safe fixed inset-x-0 bottom-16 z-40 mx-auto max-w-xl px-4 pb-3">
        <button
          type="button"
          disabled={!canSave || save.isPending}
          onClick={() => commit(routine)}
          className="w-full rounded-full bg-primary py-3 text-label-lg font-semibold text-on-primary shadow-float active:scale-[0.98] disabled:opacity-40"
        >
          {save.isPending ? 'Saving…' : existing ? 'Save changes' : 'Create routine'}
        </button>
      </div>
    </Page>
  );
}

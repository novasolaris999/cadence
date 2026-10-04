import { useEffect, useRef, useState } from 'react';
import { newId } from '../data/api';
import { useDeleteTodos, useSaveTodo, useTodoLists } from '../data/queries';
import { dayChoices } from '../domain/todos';
import { formatDuration } from '../domain/time';
import type { ISODate, Todo } from '../domain/types';
import { cx } from './cx';
import { Chip, Field, TimeInput } from './form';
import { Icon, isIconName } from './Icon';
import { Sheet } from './Sheet';

export type TodoSheetMode = { kind: 'new'; listId?: string | null; date?: ISODate | null; starred?: boolean } | { kind: 'edit'; todo: Todo };

const LENGTHS = [15, 30, 45, 60, 90, 120];

const blank = (listId: string | null, date: ISODate | null, starred: boolean): Todo => ({
  id: newId(),
  listId,
  title: '',
  note: null,
  starred,
  dueDate: date,
  dueTime: null,
  durationMin: null,
  completedAt: null,
  sortOrder: 0,
  createdAt: new Date().toISOString(), // an instant, not a schedule date; the database sets its own
});

/** Add or edit a to-do: what, which list, urgent or not, which day, and (optionally) what time. */
export function TodoSheet({ mode, today, onClose }: { mode: TodoSheetMode | null; today: ISODate; onClose: () => void }) {
  if (!mode) return null;
  return <TodoForm key={mode.kind === 'edit' ? mode.todo.id : 'new'} mode={mode} today={today} onClose={onClose} />;
}

function TodoForm({ mode, today, onClose }: { mode: TodoSheetMode; today: ISODate; onClose: () => void }) {
  const { data: lists = [] } = useTodoLists();
  const save = useSaveTodo();
  const remove = useDeleteTodos();
  const editing = mode.kind === 'edit';
  const [draft, setDraft] = useState<Todo>(() =>
    mode.kind === 'edit' ? mode.todo : blank(mode.listId ?? null, mode.date ?? null, mode.starred ?? false),
  );
  const [confirmDelete, setConfirmDelete] = useState(false);
  const title = useRef<HTMLInputElement>(null);
  const set = (patch: Partial<Todo>) => setDraft((d) => ({ ...d, ...patch }));

  // A new to-do goes into the first list unless one was given.
  useEffect(() => {
    if (!editing && draft.listId === null && mode.kind === 'new' && mode.listId === undefined && lists[0]) set({ listId: lists[0].id });
  }, [lists]);

  const canSave = draft.title.trim().length > 0;
  const choices = dayChoices(today);
  const picked = choices.find((c) => c.date === draft.dueDate);
  const setDay = (date: ISODate | null) => set(date === null ? { dueDate: null, dueTime: null, durationMin: null } : { dueDate: date });

  const commit = (another: boolean) => {
    save.mutate({ ...draft, title: draft.title.trim(), note: draft.note?.trim() || null });
    if (!another) return onClose();
    // Keep the list, day, and star; clear the rest, ready for the next one.
    setDraft(blank(draft.listId, draft.dueDate, draft.starred));
    title.current?.focus();
  };

  return (
    <Sheet open onClose={onClose} title={editing ? 'Edit to-do' : 'New to-do'}>
      <div className="flex flex-col gap-4">
        <input
          ref={title}
          autoFocus={!editing}
          value={draft.title}
          onChange={(e) => set({ title: e.target.value })}
          onKeyDown={(e) => e.key === 'Enter' && canSave && commit(!editing)}
          placeholder="What needs doing? e.g. Oat milk"
          aria-label="To-do"
          className="w-full rounded-lg border border-border bg-surface-2 px-3 py-2.5 text-body-lg text-text outline-none placeholder:text-faint focus:border-primary"
        />

        <Field label="List">
          <div className="flex flex-wrap gap-1.5">
            {lists.map((l) => (
              <Chip key={l.id} active={draft.listId === l.id} onClick={() => set({ listId: l.id })}>
                <Icon name={isIconName(l.icon) ? l.icon : 'checklist'} size={14} /> {l.name}
              </Chip>
            ))}
          </div>
        </Field>

        <button
          type="button"
          onClick={() => set({ starred: !draft.starred })}
          aria-pressed={draft.starred}
          className={cx(
            'flex items-center gap-2.5 rounded-xl border p-3 text-left',
            draft.starred ? 'border-warn/50 bg-warn/10' : 'border-border bg-surface-2',
          )}
        >
          <Icon name="star" filled={draft.starred} size={22} className={draft.starred ? 'text-warn' : 'text-faint'} />
          <span className="flex flex-col">
            <span className="text-label-lg font-semibold">Urgent and important</span>
            <span className="text-body-sm text-muted">Starred to-dos are collected in Priority</span>
          </span>
        </button>

        <Field label="When">
          <div className="flex flex-wrap gap-1.5">
            <Chip active={draft.dueDate === null} onClick={() => setDay(null)}>
              Someday
            </Chip>
            {choices.map((c) => (
              <Chip key={c.label} active={draft.dueDate === c.date} onClick={() => setDay(c.date)}>
                {c.label}
              </Chip>
            ))}
            <label
              className={cx(
                'flex items-center gap-1 rounded-full border px-3 py-1 text-label-md font-semibold',
                draft.dueDate !== null && !picked ? 'border-primary bg-primary/10 text-primary-ink' : 'border-border bg-surface-2 text-muted',
              )}
            >
              <Icon name="event" size={14} />
              <input
                type="date"
                aria-label="Pick a day"
                value={draft.dueDate ?? ''}
                onChange={(e) => setDay(e.target.value || null)}
                className="w-[7.5rem] bg-transparent text-label-md outline-none"
              />
            </label>
          </div>
        </Field>

        {draft.dueDate !== null && (
          <Field label="Time" hint={draft.dueTime !== null ? 'On the timeline' : 'In the day’s to-do list'}>
            {draft.dueTime === null ? (
              <button
                type="button"
                onClick={() => set({ dueTime: 9 * 60, durationMin: 30 })}
                className="flex items-center gap-1 self-start rounded-full border border-dashed border-border px-3 py-1 text-label-md font-semibold text-muted hover:text-text"
              >
                <Icon name="schedule" size={16} /> Add a time
              </button>
            ) : (
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  <TimeInput label="Time" value={draft.dueTime} onChange={(m) => set({ dueTime: m })} />
                  <button type="button" onClick={() => set({ dueTime: null, durationMin: null })} className="text-label-md text-muted underline">
                    No time
                  </button>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {LENGTHS.map((d) => (
                    <Chip key={d} active={draft.durationMin === d} onClick={() => set({ durationMin: d })}>
                      {formatDuration(d)}
                    </Chip>
                  ))}
                </div>
              </div>
            )}
          </Field>
        )}

        <input
          value={draft.note ?? ''}
          onChange={(e) => set({ note: e.target.value || null })}
          placeholder="Note (optional)"
          aria-label="Note"
          className="w-full rounded-lg border border-border bg-surface-2 px-3 py-2 text-body-md text-text outline-none placeholder:text-faint focus:border-primary"
        />

        <div className="flex gap-2">
          {!editing && (
            <button
              type="button"
              disabled={!canSave}
              onClick={() => commit(true)}
              className="flex shrink-0 items-center gap-1 rounded-full border border-primary/30 px-4 py-3 text-label-lg font-semibold text-primary-ink disabled:opacity-40"
            >
              <Icon name="playlist_add" size={18} /> Add another
            </button>
          )}
          <button
            type="button"
            disabled={!canSave}
            onClick={() => commit(false)}
            className="w-full rounded-full bg-primary py-3 text-label-lg font-semibold text-on-primary shadow-card active:scale-[0.98] disabled:opacity-40"
          >
            {editing ? 'Save' : 'Add to-do'}
          </button>
        </div>

        {editing && (
          <button
            type="button"
            onClick={() => (confirmDelete ? (remove.mutate([draft.id]), onClose()) : setConfirmDelete(true))}
            className={cx(
              'flex items-center justify-center gap-1.5 rounded-full py-2 text-label-lg font-semibold',
              confirmDelete ? 'bg-miss/15 text-miss-ink' : 'text-muted hover:text-text',
            )}
          >
            <Icon name="delete" size={18} />
            {confirmDelete ? 'Tap again to delete' : 'Delete to-do'}
          </button>
        )}
      </div>
    </Sheet>
  );
}

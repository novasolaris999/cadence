import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { newId } from '../data/api';
import { statusPatch, useCategories, useCreateBlock, useDeleteBlock, useSaveTarget, useUpdateBlock } from '../data/queries';
import { formatDayShort, formatDuration, isoWeekday } from '../domain/time';
import type { Block, BlockStatus, ISODate, Minutes, Weekday } from '../domain/types';
import type { BlockView } from './blockView';
import { catBg } from './categoryColor';
import { cx } from './cx';
import { Chip, DURATIONS, Field, TimeInput } from './form';
import { Icon } from './Icon';
import { SegmentedControl } from './SegmentedControl';
import { Sheet } from './Sheet';
import { Toggle } from './Toggle';

export type BlockSheetMode =
  | { kind: 'add'; date: ISODate; start: Minutes }
  | { kind: 'edit'; view: BlockView };

interface Props {
  mode: BlockSheetMode | null;
  onClose: () => void;
  /** Called when an edit changes a target block's start time, so the screen can ask for the scope. */
  onMove: (block: Block, newStart: Minutes) => void;
}

/**
 * Add a block (tap + or an empty slot) or edit one (tap a block).
 * Adding offers "Just this day" (a one-off block) or "Repeats weekly", which hands off to the
 * new-target form prefilled with what you typed. A target is the recurring rule; a block is
 * one occurrence on one date.
 */
export function BlockSheet({ mode, onClose, onMove }: Props) {
  if (!mode) return null;
  return mode.kind === 'add' ? (
    <AddForm key={`${mode.date}-${mode.start}`} date={mode.date} start={mode.start} onClose={onClose} />
  ) : (
    <EditForm key={mode.view.block.id} view={mode.view} onClose={onClose} onMove={onMove} />
  );
}

function AddForm({ date, start: initialStart, onClose }: { date: ISODate; start: Minutes; onClose: () => void }) {
  const navigate = useNavigate();
  const { data: categories = [] } = useCategories();
  const create = useCreateBlock();
  const saveTarget = useSaveTarget();
  const [repeat, setRepeat] = useState<'once' | 'weekly'>('once');
  // "Make it daily": turns this into a routine on all seven days, created right here.
  const [daily, setDaily] = useState(false);
  const [title, setTitle] = useState('');
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [start, setStart] = useState(initialStart);
  const [duration, setDuration] = useState(30);
  const [note, setNote] = useState('');

  const save = () => {
    if (repeat === 'weekly') {
      const p = new URLSearchParams({ start: String(start), duration: String(duration), day: String(isoWeekday(date)) });
      if (title.trim()) p.set('name', title.trim());
      if (categoryId) p.set('category', categoryId);
      onClose();
      navigate(`/goals/new?${p}`);
      return;
    }
    if (daily) {
      saveTarget.mutate(
        {
          id: newId(),
          categoryId,
          name: title.trim(),
          description: note.trim() || null,
          icon: null,
          durationMin: duration,
          frequencyPerWeek: 7,
          preferredDays: [1, 2, 3, 4, 5, 6, 7] as Weekday[],
          preferredStart: start,
          windowEnd: null,
          protected: false,
          active: true,
          createdAt: new Date().toISOString(), // an instant; the database sets its own
          routineId: null,
          routineOrder: 0,
        },
        { onSuccess: onClose },
      );
      return;
    }
    create.mutate(
      {
        id: newId(),
        targetId: null,
        title: title.trim(),
        categoryId,
        date,
        start,
        durationMin: duration,
        status: 'planned',
        completedAt: null,
        note: note.trim() || null,
        origin: 'manual',
        scheduledFor: null,
        moved: false,
      },
      { onSuccess: onClose },
    );
  };

  const canSave = repeat === 'weekly' || title.trim().length > 0;

  return (
    <Sheet open onClose={onClose} title={`Add to ${formatDayShort(date)}`}>
      <div className="flex flex-col gap-4">
        <SegmentedControl
          label="Repeat"
          value={repeat}
          onChange={setRepeat}
          options={[
            { value: 'once', label: 'Just this day' },
            { value: 'weekly', label: 'Repeats weekly' },
          ]}
        />
        <input
          autoFocus
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={repeat === 'once' ? 'What is it? e.g. Dentist' : 'Name the habit, e.g. Gym session'}
          aria-label="Title"
          className="w-full rounded-lg border border-border bg-surface-2 px-3 py-2.5 text-body-lg text-text outline-none placeholder:text-faint focus:border-primary"
        />
        <Field label="Start">
          <TimeInput label="Start time" value={start} onChange={setStart} />
        </Field>
        <Field label="Duration" hint={formatDuration(duration)}>
          <div className="flex flex-wrap gap-1.5">
            {DURATIONS.map((d) => (
              <Chip key={d} active={duration === d} onClick={() => setDuration(d)}>
                {formatDuration(d)}
              </Chip>
            ))}
          </div>
        </Field>
        <Field label="Category">
          <div className="flex flex-wrap gap-1.5">
            {categories.map((c) => (
              <Chip key={c.id} active={categoryId === c.id} onClick={() => setCategoryId(categoryId === c.id ? null : c.id)}>
                <span className={cx('h-2 w-2 rounded-full', catBg(c))} />
                {c.name}
              </Chip>
            ))}
          </div>
        </Field>
        {repeat === 'once' && (
          <div className="flex items-center justify-between gap-3 rounded-lg bg-surface-2 px-3 py-2.5">
            <span className="flex min-w-0 flex-col">
              <span className="flex items-center gap-1.5 text-label-lg font-semibold">
                <Icon name="repeat" size={16} className="text-primary" /> Make it daily
              </span>
              <span className="text-body-sm text-muted">
                {daily ? 'Becomes a habit on every day at this time.' : 'Only on this day.'}
              </span>
            </span>
            <Toggle label="Make it daily" checked={daily} onChange={setDaily} />
          </div>
        )}
        {repeat === 'once' ? (
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Note (optional)"
            aria-label="Note"
            className="w-full rounded-lg border border-border bg-surface-2 px-3 py-2 text-body-md text-text outline-none placeholder:text-faint focus:border-primary"
          />
        ) : (
          <p className="flex items-start gap-1.5 rounded-lg bg-surface-2 p-2.5 text-body-sm text-muted">
            <Icon name="repeat" size={16} className="mt-0.5 text-primary" />
            Next you will pick the days and rules. It starts on {formatDayShort(date).split(',')[0]}s by default.
          </p>
        )}
        <button
          type="button"
          disabled={!canSave}
          onClick={save}
          className="w-full rounded-full bg-primary py-3 text-label-lg font-semibold text-on-primary shadow-card active:scale-[0.98] disabled:opacity-40"
        >
          {repeat === 'weekly' ? 'Continue to habit setup' : daily ? 'Add daily habit' : 'Add block'}
        </button>
      </div>
    </Sheet>
  );
}

const STATUS: { value: BlockStatus; label: string }[] = [
  { value: 'planned', label: 'Planned' },
  { value: 'done', label: 'Done' },
  { value: 'skipped', label: 'Skipped' },
];

function EditForm({
  view,
  onClose,
  onMove,
}: {
  view: BlockView;
  onClose: () => void;
  onMove: (block: Block, newStart: Minutes) => void;
}) {
  const { block, target } = view;
  const update = useUpdateBlock();
  const remove = useDeleteBlock();
  const [title, setTitle] = useState(block.title ?? '');
  const [start, setStart] = useState(block.start);
  const [duration, setDuration] = useState(block.durationMin);
  const [note, setNote] = useState(block.note ?? '');
  const [status, setStatus] = useState<BlockStatus>(block.status);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => setConfirmDelete(false), [block.id]);

  const save = () => {
    const timeChanged = start !== block.start;
    update.mutate(
      {
        id: block.id,
        patch: {
          title: title.trim() || (target ? null : block.title),
          durationMin: duration,
          note: note.trim() || null,
          ...(status !== block.status ? statusPatch(status, block) : {}),
          // One-off blocks and finished blocks move directly; target blocks ask for a scope.
          ...(timeChanged && (!target || block.status !== 'planned') ? { start, moved: true } : {}),
          // A new length is a change by hand too: Re-run leaves it alone.
          ...(duration !== block.durationMin ? { moved: true } : {}),
        },
      },
      {
        onSuccess: () => {
          onClose();
          if (timeChanged && target && block.status === 'planned') onMove({ ...block, durationMin: duration }, start);
        },
      },
    );
  };

  return (
    <Sheet open onClose={onClose} title={view.title}>
      <div className="flex flex-col gap-4">
        <p className="-mt-1 flex items-center gap-1.5 text-body-sm text-muted">
          <Icon name="event" size={16} />
          {formatDayShort(block.date)}
          {target && (
            <>
              <span>·</span>
              <Link to={`/goals/${target.id}`} onClick={onClose} className="text-primary-ink underline">
                Target rules
              </Link>
            </>
          )}
        </p>
        <SegmentedControl label="Status" value={status} onChange={setStatus} options={STATUS} />
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={target ? `${target.name} (rename just this one)` : 'Title'}
          aria-label="Title"
          className="w-full rounded-lg border border-border bg-surface-2 px-3 py-2.5 text-body-lg text-text outline-none placeholder:text-faint focus:border-primary"
        />
        <Field label="Start">
          <TimeInput label="Start time" value={start} onChange={setStart} />
        </Field>
        <Field label="Duration" hint={formatDuration(duration)}>
          <div className="flex flex-wrap gap-1.5">
            {[...new Set([...DURATIONS, block.durationMin])].sort((a, b) => a - b).map((d) => (
              <Chip key={d} active={duration === d} onClick={() => setDuration(d)}>
                {formatDuration(d)}
              </Chip>
            ))}
          </div>
        </Field>
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Note (optional)"
          aria-label="Note"
          className="w-full rounded-lg border border-border bg-surface-2 px-3 py-2 text-body-md text-text outline-none placeholder:text-faint focus:border-primary"
        />
        <button
          type="button"
          onClick={save}
          className="w-full rounded-full bg-primary py-3 text-label-lg font-semibold text-on-primary shadow-card active:scale-[0.98]"
        >
          Save
        </button>
        <button
          type="button"
          onClick={() => (confirmDelete ? remove.mutate(block.id, { onSuccess: onClose }) : setConfirmDelete(true))}
          className={cx(
            'flex items-center justify-center gap-1.5 rounded-full py-2 text-label-lg font-semibold',
            confirmDelete ? 'bg-miss/15 text-miss-ink' : 'text-muted hover:text-text',
          )}
        >
          <Icon name="delete" size={18} />
          {confirmDelete ? 'Tap again to delete this block' : 'Delete this block'}
        </button>
      </div>
    </Sheet>
  );
}

import { useState } from 'react';
import { cx } from '../../components/cx';
import { Icon, isIconName, type IconName } from '../../components/Icon';
import { Sheet } from '../../components/Sheet';
import { newId } from '../../data/api';
import { useDeleteTodoList, useSaveTodoList } from '../../data/queries';
import { isDone } from '../../domain/todos';
import type { Todo, TodoList } from '../../domain/types';

const LIST_ICONS: IconName[] = ['checklist', 'shopping_cart', 'directions_car', 'group', 'work', 'favorite', 'restaurant', 'menu_book', 'fitness_center', 'pill'];

/** Rename, recolor (icon), delete, and add lists. Deleting a list keeps its to-dos under "No list". */
export function ListsSheet({ open, lists, todos, onClose }: { open: boolean; lists: TodoList[]; todos: Todo[]; onClose: () => void }) {
  const save = useSaveTodoList();
  const [name, setName] = useState('');
  const [icon, setIcon] = useState<IconName>('checklist');
  const taken = (n: string, except?: string) => lists.some((l) => l.id !== except && l.name.trim().toLowerCase() === n.trim().toLowerCase());
  const canAdd = name.trim().length > 0 && !taken(name);

  const add = () => {
    if (!canAdd) return;
    save.mutate({ id: newId(), name: name.trim(), icon, sortOrder: Math.max(-1, ...lists.map((l) => l.sortOrder)) + 1 });
    setName('');
    setIcon('checklist');
  };

  return (
    <Sheet open={open} onClose={onClose} title="Lists">
      <div className="flex flex-col gap-4">
        <ul className="flex flex-col gap-1.5">
          {lists.map((l) => (
            <ListRow key={l.id} list={l} openCount={todos.filter((t) => t.listId === l.id && !isDone(t)).length} taken={(n) => taken(n, l.id)} />
          ))}
        </ul>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            add();
          }}
          className="flex flex-col gap-2.5 rounded-xl border border-dashed border-border p-3"
        >
          <span className="text-label-md font-semibold uppercase tracking-wider text-muted">New list</span>
          <div className="flex gap-2">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={40}
              placeholder="e.g. Home, Gifts, Work"
              aria-label="New list name"
              className="min-w-0 flex-1 rounded-lg border border-border bg-surface-2 px-3 py-2 text-body-md text-text outline-none placeholder:text-faint focus:border-primary"
            />
            <button type="submit" disabled={!canAdd} className="rounded-lg bg-primary px-4 text-label-lg font-semibold text-on-primary disabled:opacity-40">
              Add
            </button>
          </div>
          {name.trim() && taken(name) && <span className="text-body-sm text-miss-ink">A list with that name already exists.</span>}
          <IconPicker value={icon} onChange={setIcon} />
        </form>
      </div>
    </Sheet>
  );
}

function ListRow({ list, openCount, taken }: { list: TodoList; openCount: number; taken: (name: string) => boolean }) {
  const save = useSaveTodoList();
  const remove = useDeleteTodoList();
  const [name, setName] = useState(list.name);
  const [picking, setPicking] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const icon: IconName = isIconName(list.icon) ? list.icon : 'checklist';
  const commitName = () => {
    const n = name.trim();
    if (!n || taken(n)) return setName(list.name);
    if (n !== list.name) save.mutate({ ...list, name: n });
  };
  return (
    <li className="flex flex-col gap-2 rounded-xl bg-surface-2 p-2">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setPicking((v) => !v)}
          aria-label={`Change icon for ${list.name}`}
          aria-expanded={picking}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-surface text-primary-ink"
        >
          <Icon name={icon} size={18} />
        </button>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={commitName}
          onKeyDown={(e) => e.key === 'Enter' && (e.currentTarget as HTMLInputElement).blur()}
          maxLength={40}
          aria-label={`Name of ${list.name}`}
          className="min-w-0 flex-1 rounded-lg bg-transparent px-1 py-1.5 text-label-lg font-semibold text-text outline-none focus:bg-surface"
        />
        <button
          type="button"
          onClick={() => (confirm ? remove.mutate(list.id) : setConfirm(true))}
          onBlur={() => setConfirm(false)}
          aria-label={confirm ? `Tap again to delete ${list.name}` : `Delete ${list.name}`}
          className={cx(
            'flex h-9 shrink-0 items-center justify-center gap-1 rounded-full px-2 text-label-md font-semibold',
            confirm ? 'bg-miss/15 text-miss-ink' : 'text-muted hover:text-text',
          )}
        >
          <Icon name="delete" size={18} />
          {confirm && 'Delete?'}
        </button>
      </div>
      {confirm && openCount > 0 && (
        <p className="px-1 text-body-sm text-muted">Its {openCount} open to-do{openCount === 1 ? '' : 's'} will move to No list.</p>
      )}
      {picking && (
        <IconPicker
          value={icon}
          onChange={(i) => {
            save.mutate({ ...list, icon: i });
            setPicking(false);
          }}
        />
      )}
    </li>
  );
}

function IconPicker({ value, onChange }: { value: IconName; onChange: (i: IconName) => void }) {
  return (
    <div role="radiogroup" aria-label="Icon" className="flex flex-wrap gap-1.5">
      {LIST_ICONS.map((i) => (
        <button
          key={i}
          type="button"
          role="radio"
          aria-checked={value === i}
          aria-label={i.replace(/_/g, ' ')}
          onClick={() => onChange(i)}
          className={cx(
            'flex h-9 w-9 items-center justify-center rounded-full border',
            value === i ? 'border-primary bg-primary/10 text-primary-ink' : 'border-border text-muted hover:text-text',
          )}
        >
          <Icon name={i} size={18} />
        </button>
      ))}
    </div>
  );
}

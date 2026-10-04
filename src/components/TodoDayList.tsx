import { Link } from 'react-router';
import type { ISODate, Todo, TodoList } from '../domain/types';
import { isDone } from '../domain/todos';
import { Icon } from './Icon';
import { TodoRow } from './TodoRow';

/** A day's to-dos without a time (and, on today, the ones rolled over from earlier days). */
export function TodoDayList({
  todos,
  lists,
  today,
  onOpen,
  onAdd,
}: {
  todos: Todo[];
  lists: TodoList[];
  today: ISODate;
  onOpen: (t: Todo) => void;
  onAdd: () => void;
}) {
  if (todos.length === 0) return null;
  const byId = new Map(lists.map((l) => [l.id, l]));
  const done = todos.filter(isDone).length;
  return (
    <section className="mb-2 rounded-xl bg-surface p-1.5 shadow-card" aria-label="To-dos">
      <div className="flex items-center justify-between px-1.5 pt-1">
        <Link to="/todo" className="flex items-center gap-1.5 text-label-md font-semibold uppercase tracking-wider text-muted hover:text-text">
          <Icon name="checklist" size={16} className="text-primary" /> To-dos
        </Link>
        <span className="flex items-center gap-2">
          <span className="text-label-sm text-faint">
            {done} of {todos.length}
          </span>
          <button type="button" onClick={onAdd} aria-label="Add a to-do for this day" className="flex h-8 w-8 items-center justify-center rounded-full text-muted hover:bg-surface-2 hover:text-text">
            <Icon name="add" size={18} />
          </button>
        </span>
      </div>
      {todos.map((t) => (
        <TodoRow key={t.id} todo={t} list={t.listId ? (byId.get(t.listId) ?? null) : null} today={today} showList hideDay onOpen={() => onOpen(t)} />
      ))}
    </section>
  );
}

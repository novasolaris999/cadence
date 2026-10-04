import { useToggleTodo, useUpdateTodo } from '../data/queries';
import { dueLabel, isDone, isOverdue } from '../domain/todos';
import type { ISODate, Todo, TodoList } from '../domain/types';
import { CheckButton } from './CheckButton';
import { cx } from './cx';
import { Icon, isIconName } from './Icon';
import { OpenOverlay } from './OpenOverlay';

/**
 * One to-do: the standard check circle, its title, where it lives and when, and a star (urgent and
 * important). Tap the row to edit. Used on the To-do tab, Today, and Weekly, so it looks the same everywhere.
 */
export function TodoRow({
  todo,
  list,
  today,
  showList,
  hideDay,
  onOpen,
}: {
  todo: Todo;
  list: TodoList | null;
  today: ISODate;
  /** Name the list (Priority view, Today, Weekly). */
  showList?: boolean;
  /** Leave out the day when the row already sits under that day. */
  hideDay?: boolean;
  onOpen: () => void;
}) {
  const toggle = useToggleTodo();
  const update = useUpdateTodo();
  const done = isDone(todo);
  const overdue = isOverdue(todo, today);
  const day = dueLabel(todo, today);
  const showDay = day !== null && (!hideDay || overdue);
  return (
    <div onClick={onOpen} className="relative flex min-h-12 cursor-pointer items-center gap-1 rounded-xl px-1 py-1 hover:bg-surface-2">
      <OpenOverlay label={todo.title} onOpen={onOpen} />
      <CheckButton status={done ? 'done' : 'planned'} onToggle={() => toggle(todo)} title={todo.title} />
      <div className="flex min-w-0 flex-1 flex-col">
        <span className={cx('truncate text-label-lg font-semibold', done ? 'text-muted line-through' : 'text-text')}>{todo.title}</span>
        {(showDay || (showList && list) || todo.note) && (
          <span className="flex min-w-0 items-center gap-1.5 text-label-sm text-muted">
            {showList && list && (
              <span className="flex shrink-0 items-center gap-0.5">
                <Icon name={isIconName(list.icon) ? list.icon : 'checklist'} size={12} />
                {list.name}
              </span>
            )}
            {showList && list && showDay && <span aria-hidden>·</span>}
            {showDay && (
              <span className={cx('shrink-0 font-semibold', overdue ? 'text-warn-ink' : done ? 'text-muted' : 'text-primary-ink')}>{day}</span>
            )}
            {todo.note && <span className="truncate">{(showDay || (showList && list)) && '· '}{todo.note}</span>}
          </span>
        )}
      </div>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          update.mutate(todo.id, { starred: !todo.starred });
        }}
        aria-pressed={todo.starred}
        aria-label={todo.starred ? `Unstar ${todo.title}` : `Star ${todo.title} as urgent and important`}
        className={cx('relative flex h-8 w-8 shrink-0 items-center justify-center rounded-full', todo.starred ? 'text-warn' : 'text-faint hover:text-muted')}
      >
        <Icon name="star" filled={todo.starred} size={20} />
      </button>
    </div>
  );
}

import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { DEFAULT_SETTINGS } from '../data/api';
import { useSettings } from '../data/queries';
import { withBack } from '../domain/navigation';
import { useNow } from '../theme/useNow';
import { AddMenu } from './AddMenu';
import { useAddDay } from './addDay';
import { BlockSheet, type BlockSheetMode } from './BlockSheet';
import { CaptureSheet } from './CaptureSheet';
import { cx } from './cx';
import { Icon } from './Icon';
import { TodoSheet, type TodoSheetMode } from './TodoSheet';

/** The five tabs; forms (habit, routine) have their own floating Save button there instead. */
const TAB_ROOTS = ['/today', '/weekly', '/goals', '/todo', '/insights'];

/**
 * The one place to add things, on every tab: a pill centered just above the tab bar. "Capture" opens the sheet
 * where you type (or dictate) what to add; "+" opens four bubbles (Habit, Routine, To-do, One-off block). It never
 * moves, so the thumb finds it without looking; pages leave room below their content so nothing stays under it.
 */
export function ActionPill() {
  const location = useLocation();
  const navigate = useNavigate();
  const now = useNow();
  const settings = useSettings().data ?? DEFAULT_SETTINGS;
  const day = useAddDay() ?? now.today;
  const [menu, setMenu] = useState(false);
  const [capture, setCapture] = useState(false);
  const [todo, setTodo] = useState<TodoSheetMode | null>(null);
  const [block, setBlock] = useState<BlockSheetMode | null>(null);

  if (!TAB_ROOTS.includes(location.pathname)) return null;

  const back = location.pathname + location.search;
  // Today: the next free quarter hour from now; another day: your wake time.
  const start = day === now.today ? Math.min(Math.ceil((now.minutes + 1) / 15) * 15, 23 * 60 + 30) : settings.wakeAnchor;

  return (
    <>
      <div
        className={cx(
          'fixed bottom-[calc(4.75rem+env(safe-area-inset-bottom,0px))] left-1/2 flex -translate-x-1/2 items-center rounded-full bg-primary text-on-primary shadow-float',
          menu ? 'z-[56]' : 'z-40',
        )}
      >
        <button
          type="button"
          onClick={() => setCapture(true)}
          aria-label="Capture: type what to add"
          className="flex h-12 items-center gap-2 rounded-l-full pr-4 pl-5 text-label-lg font-semibold active:scale-95"
        >
          <Icon name="edit_square" size={20} />
          Capture
        </button>
        <span aria-hidden className="h-6 w-px bg-on-primary/30" />
        <button
          type="button"
          onClick={() => setMenu((v) => !v)}
          aria-label={menu ? 'Close add menu' : 'Add'}
          aria-expanded={menu}
          aria-controls="add-menu"
          className="flex h-12 w-14 items-center justify-center rounded-r-full active:scale-95"
        >
          <Icon name="add" size={24} className={cx('transition-transform duration-200 motion-reduce:transition-none', menu && 'rotate-45')} />
        </button>
      </div>

      <AddMenu
        open={menu}
        onClose={() => setMenu(false)}
        choices={[
          { label: 'Habit', icon: 'check_circle', onSelect: () => navigate(withBack('/goals/new', back)) },
          { label: 'Routine', icon: 'event_repeat', onSelect: () => navigate(withBack('/goals/routine/new', back)) },
          { label: 'To-do', icon: 'checklist', onSelect: () => setTodo({ kind: 'new', date: day }) },
          { label: 'One-off block', icon: 'event', onSelect: () => setBlock({ kind: 'add', date: day, start }) },
        ]}
      />
      <CaptureSheet open={capture} onClose={() => setCapture(false)} />
      <TodoSheet mode={todo} today={now.today} onClose={() => setTodo(null)} />
      <BlockSheet
        mode={block}
        onClose={() => setBlock(null)}
        onMove={() => {}}
        onTodo={(p) => setTodo({ kind: 'new', title: p.title, date: p.date, time: p.time, duration: p.duration })}
      />
    </>
  );
}

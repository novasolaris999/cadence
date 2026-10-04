import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { cx } from "../../components/cx";
import { Icon, isIconName, type IconName } from "../../components/Icon";
import { Page } from "../../components/Page";
import { TodoRow } from "../../components/TodoRow";
import { TodoSheet, type TodoSheetMode } from "../../components/TodoSheet";
import { newId } from "../../data/api";
import {
  useDeleteTodos,
  useSaveTodo,
  useTodoLists,
  useTodos,
} from "../../data/queries";
import { needsTodosMigration } from "../../data/supabaseApi";
import { isDone, priorityTodos, sortTodos } from "../../domain/todos";
import type { Todo } from "../../domain/types";
import { useNow } from "../../theme/useNow";
import { ListsSheet } from "./ListsSheet";

const PRIORITY = "priority";
const NO_LIST = "none";
const TAB_KEY = "cadence.todoTab";

const readTab = () => {
  try {
    return localStorage.getItem(TAB_KEY) ?? PRIORITY;
  } catch {
    return PRIORITY;
  }
};

/** To-do: Priority (starred, every list) plus one tab per list. Quick add at the top, done folded at the bottom. */
export function TodoScreen() {
  const now = useNow();
  const { data: lists = [], isPending: listsPending } = useTodoLists();
  const { data: todos = [] } = useTodos();
  const saveTodo = useSaveTodo();
  const deleteTodos = useDeleteTodos();
  const [tab, setTabState] = useState(readTab);
  const [sheet, setSheet] = useState<TodoSheetMode | null>(null);
  const [editingLists, setEditingLists] = useState(false);
  const [showDone, setShowDone] = useState(false);
  const [draft, setDraft] = useState("");

  const setTab = (t: string) => {
    setTabState(t);
    setShowDone(false);
    try {
      localStorage.setItem(TAB_KEY, t);
    } catch {
      /* a view preference; fine to lose */
    }
  };

  const listById = useMemo(() => new Map(lists.map((l) => [l.id, l])), [lists]);
  const orphans = todos.filter(
    (t) => t.listId === null || !listById.has(t.listId),
  );
  // A remembered tab whose list was deleted falls back to Priority.
  const current =
    tab === PRIORITY ||
    (tab === NO_LIST && orphans.length > 0) ||
    listById.has(tab)
      ? tab
      : PRIORITY;
  const list = listById.get(current) ?? null;
  // Keep the selected tab in view when the row scrolls sideways (many lists, narrow screen).
  const tabs = useRef<HTMLDivElement>(null);
  useEffect(() => {
    tabs.current
      ?.querySelector('[aria-selected="true"]')
      ?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [current, lists.length]);

  const inView =
    current === PRIORITY
      ? todos.filter((t) => t.starred)
      : current === NO_LIST
        ? orphans
        : todos.filter((t) => t.listId === current);
  const open =
    current === PRIORITY
      ? priorityTodos(todos)
      : sortTodos(inView.filter((t) => !isDone(t)));
  const done = sortTodos(inView.filter(isDone));
  const priorityCount = priorityTodos(todos).length;
  const countOpen = (id: string) =>
    todos.filter((t) => t.listId === id && !isDone(t)).length;

  // Group open to-dos by when: due now (today or rolled over), later, someday. Headings only when mixed.
  const groups: { title: string; items: Todo[] }[] = [
    {
      title: "Due",
      items: open.filter((t) => t.dueDate !== null && t.dueDate <= now.today),
    },
    {
      title: "Coming up",
      items: open.filter((t) => t.dueDate !== null && t.dueDate > now.today),
    },
    { title: "Someday", items: open.filter((t) => t.dueDate === null) },
  ].filter((g) => g.items.length > 0);

  const quickAdd = () => {
    const title = draft.trim();
    if (!title) return;
    saveTodo.mutate({
      id: newId(),
      listId:
        list?.id ?? (current === PRIORITY ? (lists[0]?.id ?? null) : null),
      title,
      note: null,
      starred: current === PRIORITY,
      dueDate: null,
      dueTime: null,
      durationMin: null,
      completedAt: null,
      sortOrder: 0,
      createdAt: new Date().toISOString(),
    });
    setDraft("");
  };

  const placeholder =
    current === PRIORITY
      ? "Add an urgent to-do"
      : list
        ? `Add to ${list.name}`
        : "Add a to-do";
  const row = (t: Todo) => (
    <TodoRow
      key={t.id}
      todo={t}
      list={t.listId ? (listById.get(t.listId) ?? null) : null}
      today={now.today}
      showList={current === PRIORITY}
      onOpen={() => setSheet({ kind: "edit", todo: t })}
    />
  );

  return (
    <Page>
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h1 className="text-headline-lg font-semibold">To-do</h1>
          <button
            type="button"
            onClick={() =>
              setSheet({
                kind: "new",
                listId: list?.id,
                starred: current === PRIORITY,
              })
            }
            className="flex h-9 items-center gap-1 rounded-full bg-primary px-3.5 text-label-lg font-semibold text-on-primary shadow-card active:scale-95"
          >
            <Icon name="add" size={18} /> New
          </button>
        </div>

        {needsTodosMigration() && (
          <p
            role="status"
            className="rounded-xl border border-warn/40 bg-warn/10 p-3 text-body-sm text-warn-ink"
          >
            Database update needed: run migration 0003 (to-dos) in Supabase to
            start saving to-dos.
          </p>
        )}

        {/* Tabs: Priority, then each list. Scrolls sideways when there are many. */}
        <div
          ref={tabs}
          className="-mx-4 flex gap-1.5 overflow-x-auto px-4 pb-1 [scrollbar-width:none]"
        >
          <div role="tablist" aria-label="Lists" className="flex gap-1.5">
            <Tab
              active={current === PRIORITY}
              onClick={() => setTab(PRIORITY)}
              icon="star"
              count={priorityCount}
            >
              Priority
            </Tab>
            {lists.map((l) => (
              <Tab
                key={l.id}
                active={current === l.id}
                onClick={() => setTab(l.id)}
                icon={isIconName(l.icon) ? l.icon : "checklist"}
                count={countOpen(l.id)}
              >
                {l.name}
              </Tab>
            ))}
            {orphans.length > 0 && (
              <Tab
                active={current === NO_LIST}
                onClick={() => setTab(NO_LIST)}
                icon="inbox"
                count={orphans.filter((t) => !isDone(t)).length}
              >
                No list
              </Tab>
            )}
          </div>
          <button
            type="button"
            onClick={() => setEditingLists(true)}
            aria-label="Edit lists"
            className="flex h-9 shrink-0 items-center gap-1 rounded-full border border-dashed border-border px-3 text-label-md font-semibold text-muted hover:text-text"
          >
            <Icon name="edit" size={16} /> Lists
          </button>
        </div>

        {current !== NO_LIST && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              quickAdd();
            }}
            className="flex items-center gap-2 rounded-xl border border-border bg-surface p-1.5 pl-3 shadow-card focus-within:border-primary"
          >
            <Icon
              name={current === PRIORITY ? "star" : "add"}
              size={18}
              className="text-faint"
            />
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder={placeholder}
              aria-label={placeholder}
              maxLength={200}
              className="min-w-0 flex-1 bg-transparent py-1.5 text-body-md text-text outline-none placeholder:text-faint"
            />
            <button
              type="submit"
              disabled={!draft.trim()}
              className="rounded-lg bg-primary px-3 py-1.5 text-label-md font-semibold text-on-primary disabled:opacity-40"
            >
              Add
            </button>
          </form>
        )}

        {open.length === 0 && !listsPending ? (
          <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-border px-4 py-8 text-center">
            <Icon
              name={current === PRIORITY ? "star" : "checklist"}
              size={28}
              className="text-faint"
            />
            <p className="text-body-md text-muted">
              {current === PRIORITY
                ? "Nothing urgent. Star a to-do to collect it here, whatever its list."
                : done.length > 0
                  ? "All done here."
                  : "Nothing here yet. Type above to add the first one."}
            </p>
          </div>
        ) : (
          groups.map((g) => (
            <section
              key={g.title}
              className="flex flex-col gap-0.5 rounded-xl bg-surface p-1.5 shadow-card"
            >
              {groups.length > 1 && <GroupTitle>{g.title}</GroupTitle>}
              {g.items.map(row)}
            </section>
          ))
        )}

        {done.length > 0 && current !== PRIORITY && (
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={() => setShowDone((v) => !v)}
                aria-expanded={showDone}
                className="flex items-center gap-1.5 text-label-md font-semibold uppercase tracking-wider text-muted hover:text-text"
              >
                <Icon name="check_circle" size={16} /> Done ({done.length})
                <Icon
                  name={showDone ? "keyboard_arrow_up" : "keyboard_arrow_down"}
                  size={16}
                />
              </button>
              {showDone && (
                <button
                  type="button"
                  onClick={() => deleteTodos.mutate(done.map((t) => t.id))}
                  className="text-label-md font-semibold text-muted underline hover:text-text"
                >
                  Clear done
                </button>
              )}
            </div>
            {showDone && (
              <section className="flex flex-col gap-0.5 rounded-xl bg-surface p-1.5 shadow-card">
                {done.map(row)}
              </section>
            )}
          </div>
        )}
      </div>
      <TodoSheet
        mode={sheet}
        today={now.today}
        onClose={() => setSheet(null)}
      />
      <ListsSheet
        open={editingLists}
        lists={lists}
        todos={todos}
        onClose={() => setEditingLists(false)}
      />
    </Page>
  );
}

function Tab({
  active,
  onClick,
  icon,
  count,
  children,
}: {
  active: boolean;
  onClick: () => void;
  icon: IconName;
  count: number;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={cx(
        "flex h-9 shrink-0 items-center gap-1.5 rounded-full border px-3 text-label-md font-semibold transition-colors",
        active
          ? "border-primary bg-primary text-on-primary"
          : "border-border bg-surface text-muted hover:text-text",
      )}
    >
      <Icon name={icon} size={16} filled={active && icon === "star"} />
      {children}
      {count > 0 && (
        <span
          className={cx(
            "rounded-full px-1.5 text-label-sm",
            active ? "bg-on-primary/20" : "bg-surface-3 text-text",
          )}
        >
          {count}
        </span>
      )}
    </button>
  );
}

function GroupTitle({ children }: { children: ReactNode }) {
  return (
    <h2 className="px-2 pt-1.5 text-label-sm font-semibold uppercase tracking-wider text-muted">
      {children}
    </h2>
  );
}

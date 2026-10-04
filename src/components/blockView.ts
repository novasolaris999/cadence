import { useMemo } from 'react';
import { useCategories, useRoutines, useTargets } from '../data/queries';
import { isNewTarget } from '../domain/novelty';
import { groupByRoutine, isAnytime, routineMinutes, routineSpan } from '../domain/routines';
import { today } from '../domain/time';
import type { Block, Category, ISODate, Routine, Target, Todo } from '../domain/types';

/** A block joined with its target and category, ready to render. */
export interface BlockView {
  block: Block;
  target: Target | null;
  category: Category | null;
  title: string;
  protected: boolean;
  /** The block's routine was created today or yesterday: drawn with a glow and a NEW tag. */
  isNew: boolean;
  /**
   * Set when this view is a routine card: its habits' blocks for that day, in order. The view's
   * `block` is then a stand-in spanning the whole routine (id 'routine:...'), used for layout and drag.
   */
  group?: RoutineCard;
  /** Set when this view is a timed to-do (id 'todo:...'). To-dos are never habits: no misses, no rates. */
  todo?: Todo;
}

export interface RoutineCard {
  routine: Routine;
  members: BlockView[];
  /** Total minutes of the habits (quick ones count 0). */
  minutes: number;
  done: number;
}

export const isRoutineId = (id: string) => id.startsWith('routine:');
export const TODO_PREFIX = 'todo:';

/**
 * A to-do drawn like a block, on the day it shows (`todoDay`; a rolled-over one shows on today).
 * Only its day, time, and length are used for layout.
 */
export function todoView(t: Todo, date: ISODate = t.dueDate!): BlockView {
  return {
    block: {
      id: TODO_PREFIX + t.id,
      targetId: null,
      title: t.title,
      categoryId: null,
      date,
      start: t.dueTime ?? 0,
      durationMin: t.durationMin ?? 30,
      status: t.completedAt ? 'done' : 'planned',
      completedAt: t.completedAt,
      note: t.note,
      origin: 'manual',
      scheduledFor: null,
      moved: false,
    },
    target: null,
    category: null,
    title: t.title,
    protected: false,
    isNew: false,
    todo: t,
  };
}

export function useBlockViews(blocks: Block[] | undefined): BlockView[] {
  const { data: targets = [] } = useTargets();
  const { data: categories = [] } = useCategories();
  return useMemo(() => {
    const tById = new Map(targets.map((t) => [t.id, t]));
    const cById = new Map(categories.map((c) => [c.id, c]));
    const now = today();
    return (blocks ?? []).map((block) => {
      const target = block.targetId ? (tById.get(block.targetId) ?? null) : null;
      const catId = block.categoryId ?? target?.categoryId ?? null;
      return {
        block,
        target,
        category: catId ? (cById.get(catId) ?? null) : null,
        title: block.title ?? target?.name ?? 'Untitled',
        protected: target?.protected ?? false,
        isNew: isNewTarget(target?.createdAt ?? null, now),
      };
    });
  }, [blocks, targets, categories]);
}

/**
 * Turns a day's block views into what the screens draw: routine habits that share a day and time
 * become one routine card; anytime habits (quick, no routine) are split out for their own checklist.
 */
export function useDayItems(views: BlockView[]): { items: BlockView[]; anytime: BlockView[] } {
  const { data: routines = [] } = useRoutines();
  const { data: targets = [] } = useTargets();
  const { data: categories = [] } = useCategories();
  return useMemo(() => {
    const rById = new Map(routines.map((r) => [r.id, r]));
    const vById = new Map(views.map((v) => [v.block.id, v]));
    const cById = new Map(categories.map((c) => [c.id, c]));
    const anytime = views.filter((v) => v.target && isAnytime(v.target));
    const rest = views.filter((v) => !(v.target && isAnytime(v.target)));
    const now = today();
    const items = groupByRoutine(
      rest.map((v) => v.block),
      targets,
      new Set(rById.keys()),
    ).map((item): BlockView => {
      if (item.kind === 'block') return vById.get(item.block.id)!;
      const { group } = item;
      const routine = rById.get(group.routineId)!;
      const members = group.blocks.map((b) => vById.get(b.id)!);
      const minutes = routineMinutes(group.blocks);
      const done = group.blocks.filter((b) => b.status === 'done').length;
      const status: Block['status'] =
        done === group.blocks.length ? 'done' : group.blocks.some((b) => b.status === 'planned') ? 'planned' : 'skipped';
      const first = group.blocks[0]!;
      return {
        block: {
          ...first,
          id: `routine:${routine.id}:${group.date}:${group.start}`,
          targetId: null,
          title: routine.name,
          categoryId: routine.categoryId,
          durationMin: Math.min(routineSpan(minutes), 24 * 60 - group.start),
          status,
          completedAt: null,
          note: null,
          moved: group.blocks.some((b) => b.moved),
        },
        target: null,
        category: routine.categoryId ? (cById.get(routine.categoryId) ?? null) : null,
        title: routine.name,
        protected: routine.protected,
        isNew: isNewTarget(routine.createdAt, now),
        group: { routine, members, minutes, done },
      };
    });
    return { items, anytime };
  }, [views, routines, targets, categories]);
}

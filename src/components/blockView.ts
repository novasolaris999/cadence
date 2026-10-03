import { useMemo } from 'react';
import { useCategories, useTargets } from '../data/queries';
import type { Block, Category, Target } from '../domain/types';

/** A block joined with its target and category, ready to render. */
export interface BlockView {
  block: Block;
  target: Target | null;
  category: Category | null;
  title: string;
  protected: boolean;
}

export function useBlockViews(blocks: Block[] | undefined): BlockView[] {
  const { data: targets = [] } = useTargets();
  const { data: categories = [] } = useCategories();
  return useMemo(() => {
    const tById = new Map(targets.map((t) => [t.id, t]));
    const cById = new Map(categories.map((c) => [c.id, c]));
    return (blocks ?? []).map((block) => {
      const target = block.targetId ? (tById.get(block.targetId) ?? null) : null;
      const catId = block.categoryId ?? target?.categoryId ?? null;
      return {
        block,
        target,
        category: catId ? (cById.get(catId) ?? null) : null,
        title: block.title ?? target?.name ?? 'Untitled',
        protected: target?.protected ?? false,
      };
    });
  }, [blocks, targets, categories]);
}

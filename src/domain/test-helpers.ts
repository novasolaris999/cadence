import type { Block, Target } from './types';

let seq = 0;

export function block(p: Partial<Block> & Pick<Block, 'date'>): Block {
  return {
    id: `b${++seq}`,
    targetId: 't1',
    title: null,
    categoryId: null,
    start: 9 * 60,
    durationMin: 30,
    status: 'planned',
    completedAt: null,
    note: null,
    origin: 'generated',
    scheduledFor: p.date,
    moved: false,
    ...p,
  };
}

export function target(p: Partial<Target> = {}): Target {
  return {
    id: 't1',
    categoryId: 'c1',
    name: 'Gym',
    description: null,
    icon: null,
    durationMin: 60,
    frequencyPerWeek: 3,
    preferredDays: [],
    preferredStart: 12 * 60,
    windowEnd: null,
    protected: false,
    active: true,
    createdAt: null,
    ...p,
  };
}

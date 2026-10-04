// In-memory store behind Demo mode. Edits last until you reload; nothing is sent to Supabase.
import type { Block, Category, DayLog, Routine, Settings, Target, Todo, TodoList } from '../domain/types';
import {
  buildSampleBlocks,
  buildSampleDayLogs,
  sampleCategories,
  sampleRoutines,
  sampleSettings,
  sampleTodoLists,
  buildSampleTodos,
  sampleTargets,
} from './sampleData';

export const sampleStore = {
  settings: { ...sampleSettings } as Settings,
  categories: [...sampleCategories] as Category[],
  targets: [...sampleTargets] as Target[],
  routines: [...sampleRoutines] as Routine[],
  todoLists: [...sampleTodoLists] as TodoList[],
  todos: buildSampleTodos() as Todo[],
  blocks: buildSampleBlocks() as Block[],
  dayLogs: buildSampleDayLogs() as DayLog[],
};

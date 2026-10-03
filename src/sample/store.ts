// In-memory stand-in for the database during phase 1. Changes last until you reload.
import type { Block, Category, DayLog, Settings, Target } from '../domain/types';
import {
  buildSampleBlocks,
  buildSampleDayLogs,
  sampleCategories,
  sampleSettings,
  sampleTargets,
} from './sampleData';

export const sampleStore = {
  settings: { ...sampleSettings } as Settings,
  categories: [...sampleCategories] as Category[],
  targets: [...sampleTargets] as Target[],
  blocks: buildSampleBlocks() as Block[],
  dayLogs: buildSampleDayLogs() as DayLog[],
};

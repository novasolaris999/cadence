import { describe, expect, it } from 'vitest';
import { blockFromRow, blockPatchToRow, blockToRow, settingsFromRow, targetFromRow, targetToRow, type BlockRow } from './mappers';

const row: BlockRow = {
  id: 'b1',
  target_id: 't1',
  title: null,
  category_id: null,
  date: '2026-10-05',
  start_time: '07:30:00',
  duration_min: 30,
  status: 'done',
  completed_at: '2026-10-05T07:41:00',
  note: null,
  origin: 'generated',
  scheduled_for: '2026-10-05',
  moved: false,
};

describe('mappers', () => {
  it('round-trips a block between row and app shape', () => {
    const b = blockFromRow(row);
    expect(b.start).toBe(450);
    expect(b.completedAt).toBe('2026-10-05T07:41');
    expect(blockToRow(b)).toEqual({ ...row, completed_at: '2026-10-05T07:41' });
  });

  it('accepts timestamps with a space separator', () => {
    expect(blockFromRow({ ...row, completed_at: '2026-10-05 07:41:00' }).completedAt).toBe('2026-10-05T07:41');
  });

  it('maps only the fields present in a patch', () => {
    expect(blockPatchToRow({ start: 1050, moved: true })).toEqual({ start_time: '17:30:00', moved: true });
  });

  it('keeps picked days and frequency consistent when saving a target', () => {
    const t = targetFromRow({
      id: 't1',
      category_id: null,
      name: ' Gym ',
      description: '',
      icon: null,
      duration_min: 60,
      frequency_per_week: 3,
      preferred_days: [5, 1, 3],
      preferred_start: '11:30:00',
      window_end: null,
      protected: false,
      active: true,
    });
    expect(t.preferredDays).toEqual([1, 3, 5]);
    const back = targetToRow({ ...t, preferredDays: [1, 3, 5, 5] });
    expect(back).toMatchObject({ name: 'Gym', description: null, preferred_days: [1, 3, 5], frequency_per_week: 3, preferred_start: '11:30:00' });
  });

  it('reads settings', () => {
    expect(settingsFromRow({ wake_anchor: '06:45:00', sleep_anchor: '00:30:00', theme: 'dark', on_time_tolerance_min: 20 })).toEqual({
      wakeAnchor: 405,
      sleepAnchor: 30,
      theme: 'dark',
      onTimeToleranceMin: 20,
    });
  });
});

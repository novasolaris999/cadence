import { describe, expect, it } from 'vitest';
import { returnPath, withBack } from './navigation';

describe('returnPath', () => {
  it('returns an in-app path', () => {
    expect(returnPath('/today?date=2026-10-08')).toBe('/today?date=2026-10-08');
  });
  it('falls back for missing or outside addresses', () => {
    expect(returnPath(null)).toBe('/goals');
    expect(returnPath('https://evil.example')).toBe('/goals');
    expect(returnPath('//evil.example')).toBe('/goals');
    expect(returnPath('/\\evil.example')).toBe('/goals');
  });
});

describe('withBack', () => {
  it('adds the return path to a link, keeping existing parameters', () => {
    expect(withBack('/goals/new', '/today')).toBe('/goals/new?back=%2Ftoday');
    expect(withBack('/goals/routine/new?template=sleep', '/weekly?week=2026-10-12')).toBe(
      '/goals/routine/new?template=sleep&back=%2Fweekly%3Fweek%3D2026-10-12',
    );
    expect(withBack('/goals/new', undefined)).toBe('/goals/new');
  });
});

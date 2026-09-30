import { describe, expect, it } from 'vitest';
import { addDays, isoWeekKey, monthKey, monthRange, toIsoDate, weekRange } from '@/core/news';

describe('news dates', () => {
  it('formats a date in UTC', () => {
    expect(toIsoDate(new Date('2026-09-17T23:59:59Z'))).toBe('2026-09-17');
  });

  it('adds days across month and year ends', () => {
    expect(addDays('2026-09-30', 1)).toBe('2026-10-01');
    expect(addDays('2026-01-01', -1)).toBe('2025-12-31');
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29');
  });

  it.each([
    ['2026-09-17', '2026-W38'],
    ['2026-09-14', '2026-W38'],
    ['2026-09-20', '2026-W38'],
    ['2026-09-21', '2026-W39'],
    // ISO weeks belong to the year that holds their Thursday.
    ['2026-01-01', '2026-W01'],
    ['2027-01-01', '2026-W53'],
    ['2024-12-30', '2025-W01'],
    ['2021-01-03', '2020-W53'],
  ])('puts %s in %s', (date, key) => {
    expect(isoWeekKey(date)).toBe(key);
  });

  it('gives the Monday and Sunday of a week', () => {
    expect(weekRange('2026-W38')).toEqual({ from: '2026-09-14', to: '2026-09-20' });
    expect(weekRange('2026-W01')).toEqual({ from: '2025-12-29', to: '2026-01-04' });
    expect(weekRange('2020-W53')).toEqual({ from: '2020-12-28', to: '2021-01-03' });
  });

  it('round-trips every day of a year through its week', () => {
    for (let date = '2026-01-01'; date <= '2026-12-31'; date = addDays(date, 1)) {
      const { from, to } = weekRange(isoWeekKey(date)) ?? { from: '', to: '' };
      expect(from <= date && date <= to).toBe(true);
    }
  });

  it('gives the first and last day of a month', () => {
    expect(monthKey('2026-09-17')).toBe('2026-09');
    expect(monthRange('2026-09')).toEqual({ from: '2026-09-01', to: '2026-09-30' });
    expect(monthRange('2028-02')).toEqual({ from: '2028-02-01', to: '2028-02-29' });
    expect(monthRange('2026-12')).toEqual({ from: '2026-12-01', to: '2026-12-31' });
  });

  it('returns null for keys it cannot read', () => {
    expect(weekRange('2026-38')).toBeNull();
    expect(weekRange('2026-W54')).toBeNull();
    expect(monthRange('2026-13')).toBeNull();
    expect(monthRange('September')).toBeNull();
  });
});

import { describe, expect, it } from 'vitest';
import { addMonths, editionInMonth, monthWeeks, stepEdition } from '@/core/news';

describe('monthWeeks', () => {
  it('starts on Monday and pads the first and last weeks with blanks', () => {
    // 1 October 2026 is a Thursday, 31 October a Saturday.
    const weeks = monthWeeks('2026-10');
    expect(weeks).toHaveLength(5);
    expect(weeks[0]).toEqual([
      null,
      null,
      null,
      '2026-10-01',
      '2026-10-02',
      '2026-10-03',
      '2026-10-04',
    ]);
    expect(weeks[4]).toEqual([
      '2026-10-26',
      '2026-10-27',
      '2026-10-28',
      '2026-10-29',
      '2026-10-30',
      '2026-10-31',
      null,
    ]);
  });

  it('gives every week seven days and every date once', () => {
    const weeks = monthWeeks('2026-02');
    expect(weeks.every((week) => week.length === 7)).toBe(true);
    expect(weeks.flat().filter((day) => day !== null)).toHaveLength(28);
  });

  it('needs no padding for a month that starts on a Monday and ends on a Sunday', () => {
    // February 2027 runs Monday 1 to Sunday 28.
    const weeks = monthWeeks('2027-02');
    expect(weeks).toHaveLength(4);
    expect(weeks.flat()).not.toContain(null);
  });

  it('gives nothing for a key that names no month', () => {
    expect(monthWeeks('2026-13')).toEqual([]);
  });
});

describe('addMonths', () => {
  it('steps across a year in both directions', () => {
    expect(addMonths('2026-12', 1)).toBe('2027-01');
    expect(addMonths('2026-01', -1)).toBe('2025-12');
    expect(addMonths('2026-10', 0)).toBe('2026-10');
  });
});

const dates = ['2026-10-06', '2026-10-05', '2026-10-02', '2026-09-28', '2026-09-03'];

describe('stepEdition', () => {
  it('moves a day to the next edition in that direction', () => {
    expect(stepEdition(dates, '2026-10-05', 1)).toBe('2026-10-06');
    expect(stepEdition(dates, '2026-10-05', -1)).toBe('2026-10-02');
  });

  it('skips days without an edition', () => {
    expect(stepEdition(dates, '2026-10-02', -1)).toBe('2026-09-28');
  });

  it('moves a week, or past it to the next edition when that day has none', () => {
    expect(stepEdition(dates, '2026-10-05', -7)).toBe('2026-09-28');
    expect(stepEdition(dates, '2026-10-06', -7)).toBe('2026-09-28');
  });

  it('stays put at either end', () => {
    expect(stepEdition(dates, '2026-10-06', 1)).toBeUndefined();
    expect(stepEdition(dates, '2026-09-03', -7)).toBeUndefined();
  });
});

describe('editionInMonth', () => {
  it('keeps the day of the month when it has an edition', () => {
    expect(editionInMonth(dates, '2026-09', '2026-10-28')).toBe('2026-09-28');
  });

  it('otherwise takes the nearest edition in that month', () => {
    expect(editionInMonth(dates, '2026-09', '2026-10-05')).toBe('2026-09-03');
    expect(editionInMonth(dates, '2026-10', '2026-09-03')).toBe('2026-10-02');
  });

  it('aims at the last day when the day is past the end of a shorter month', () => {
    expect(editionInMonth(['2026-09-30', '2026-09-03'], '2026-09', '2026-10-31')).toBe(
      '2026-09-30',
    );
  });

  it('gives nothing for a month without editions', () => {
    expect(editionInMonth(dates, '2026-08', '2026-09-03')).toBeUndefined();
  });

  it('takes the first or last edition of the month when asked', () => {
    expect(editionInMonth(dates, '2026-10', 'first')).toBe('2026-10-02');
    expect(editionInMonth(dates, '2026-10', 'last')).toBe('2026-10-06');
  });
});

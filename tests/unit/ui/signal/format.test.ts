import { describe, expect, it } from 'vitest';
import {
  formatDayMonth,
  formatMonthName,
  formatShort,
  formatWeekday,
  formatWeekdayLong,
} from '@/features/signal/format';

describe('news dates', () => {
  // Written by hand so the server and every browser print the same text: Node's ICU and
  // Safari disagree on en-GB's short September, and a mismatch makes React re-render.
  it('spells a short date the same everywhere', () => {
    expect(formatShort('2026-09-30')).toBe('30 Sep');
    expect(formatWeekday('2026-09-30')).toBe('Wed 30 Sep');
    expect(formatWeekday('2026-10-05')).toBe('Mon 5 Oct');
  });

  it('spells the long dates of the picker by hand too', () => {
    expect(formatDayMonth('2026-09-05')).toBe('5 September');
    expect(formatWeekdayLong('2026-10-06')).toBe('Tuesday 6 October');
    expect(formatMonthName('2026-10')).toBe('October 2026');
  });
});

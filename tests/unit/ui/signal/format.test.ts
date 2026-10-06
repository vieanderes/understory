import { describe, expect, it } from 'vitest';
import { formatShort, formatWeekday } from '@/features/signal/format';

describe('news dates', () => {
  // Written by hand so the server and every browser print the same text: Node's ICU and
  // Safari disagree on en-GB's short September, and a mismatch makes React re-render.
  it('spells a short date the same everywhere', () => {
    expect(formatShort('2026-09-30')).toBe('30 Sep');
    expect(formatWeekday('2026-09-30')).toBe('Wed 30 Sep');
    expect(formatWeekday('2026-10-05')).toBe('Mon 5 Oct');
  });
});

import { describe, expect, it } from 'vitest';
import { fixedClock } from '@/core/ports/clock';

describe('fixedClock', () => {
  it('returns the pinned instant every time', () => {
    const clock = fixedClock('2026-09-17T10:00:00Z');
    expect(clock.now().toISOString()).toBe('2026-09-17T10:00:00.000Z');
    expect(clock.now().toISOString()).toBe('2026-09-17T10:00:00.000Z');
  });

  it('hands out copies, so a caller cannot move the clock', () => {
    const clock = fixedClock('2026-09-17T10:00:00Z');
    clock.now().setFullYear(1999);
    expect(clock.now().getUTCFullYear()).toBe(2026);
  });
});

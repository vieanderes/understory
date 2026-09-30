/**
 * Time is an input. Every rule that depends on "now" (due cards, weekly goals, decay of
 * the mastery map) takes it through this port, so tests can pin it.
 */
export interface Clock {
  now(): Date;
}

export const systemClock: Clock = { now: () => new Date() };

export function fixedClock(iso: string): Clock {
  const at = new Date(iso);
  return { now: () => new Date(at) };
}

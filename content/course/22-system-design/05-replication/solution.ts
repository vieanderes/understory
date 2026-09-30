export type Target = 'primary' | 'replica';

// Decide where one user's read goes. lastWriteAt is undefined if they never wrote.
export function pickConnection(lastWriteAt: number | undefined, now: number, lagMs: number): Target {
  if (lastWriteAt === undefined) return 'replica';
  return now - lastWriteAt < lagMs ? 'primary' : 'replica';
}

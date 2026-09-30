import { formatMinutes, type TimeTotal } from '@/core/insight';

const lessons = (n: number) => `${n} ${n === 1 ? 'lesson' : 'lessons'}`;

/**
 * "23 lessons · about 3 h 50 min · 3 h 10 min left". A sum of estimates is an estimate,
 * so the total says "about"; what is left follows from it.
 */
export function timeLine(time: TimeTotal, { count = true }: { count?: boolean } = {}): string {
  const parts = [...(count ? [lessons(time.count)] : []), `about ${formatMinutes(time.total)}`];
  if (time.left === 0) parts.push('all done');
  else parts.push(`${formatMinutes(time.left)} left`);
  return parts.join(' · ');
}

/** "about 6 h 10 min left", for a line that names what it is counting. */
export function timeLeft(time: TimeTotal): string {
  return time.left === 0 ? 'nothing left' : `about ${formatMinutes(time.left)} left`;
}

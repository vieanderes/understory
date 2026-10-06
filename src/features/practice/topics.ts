import { INTERESTS, type Interest } from '@/core/profile/interests';
import type { SessionMinutes } from '@/core/practice';

/** `python,algorithms` to known interests, in the canonical order, unknown ids dropped. */
export function parseTopics(value: string | null | undefined): Interest[] {
  const asked = new Set((value ?? '').split(','));
  return INTERESTS.filter((id) => asked.has(id));
}

/** The session URL. Topics ride in the query so the minutes route stays static. */
export function sessionHref(minutes: SessionMinutes, topics: readonly Interest[]): string {
  const base = `/practise/session/${minutes}`;
  return topics.length === 0 ? base : `${base}?topics=${topics.join(',')}`;
}

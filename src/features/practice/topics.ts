import { INTEREST_COPY, INTERESTS, matchesInterests, type Interest } from '@/core/profile/interests';
import type { SessionMinutes } from '@/core/practice';
import type { ProgressState } from '@/core/progress/reducer';

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

const lessonOfCardKey = (cardKey: string) => /^(?:lesson|skill):([^#]+)#/.exec(cardKey)?.[1];

/**
 * The topics chosen before the learner touches anything: what they said they care about,
 * else what they have started, else none, which means everything.
 */
export function defaultTopics(state: ProgressState): Interest[] {
  const said = state.profile?.interests ?? [];
  if (said.length > 0) return INTERESTS.filter((id) => said.includes(id));
  const lessons = [
    ...state.completedLessons,
    ...Object.keys(state.cards).flatMap((key) => lessonOfCardKey(key) ?? []),
  ];
  return INTERESTS.filter((id) => lessons.some((lesson) => matchesInterests(lesson, [id])));
}

export const topicLabel = (id: Interest) => INTEREST_COPY[id].label;

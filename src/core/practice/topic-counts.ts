import { INTERESTS, matchesInterests, type Interest } from '@/core/profile/interests';
import type { ProgressState } from '@/core/progress/reducer';
import type { Catalog } from './catalog';
import { dueByLowestRetrievability } from './session';

export interface TopicCount {
  /** Items of the topic due for review now. */
  due: number;
  /** Lessons of the topic with practice items that the learner has not taken yet. */
  fresh: number;
}

const lessonOf = (cardKey: string) => /^(?:lesson|skill):([^#]+)#/.exec(cardKey)?.[1];

/** What each topic has waiting, so a topic can say why it is worth picking today. */
export function topicCounts(
  state: ProgressState,
  catalog: Catalog,
  now: Date,
): Record<Interest, TopicCount> {
  const due = dueByLowestRetrievability(state, now).flatMap((d) => lessonOf(d.cardKey) ?? []);
  const lessons = new Set([
    ...catalog.skillItems.map((i) => i.lessonId),
    ...catalog.recallCards.map((c) => c.lessonId),
  ]);
  const fresh = [...lessons].filter((id) => !state.completedLessons.has(id));
  return Object.fromEntries(
    INTERESTS.map((topic) => [
      topic,
      {
        due: due.filter((id) => matchesInterests(id, [topic])).length,
        fresh: fresh.filter((id) => matchesInterests(id, [topic])).length,
      },
    ]),
  ) as Record<Interest, TopicCount>;
}

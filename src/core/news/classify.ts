import type { Interests, NewsItem } from './schema';
import { countTerm } from './text';

/** A keyword in the headline says more about the story than one in the description. */
const TITLE_HIT_WEIGHT = 3;
const EXCERPT_HIT_WEIGHT = 1;

interface TopicStrength {
  id: string;
  strength: number;
}

/**
 * Topics by keyword rules, strongest first. The first topic is the item's primary topic:
 * `selectDay` caps the day by it and the extractive brief takes its "why" sentence from it.
 *
 * Hints from the feed list (already in `item.topics`) are kept after the keyword matches,
 * so a curated feed is never left without a topic but a clear keyword still leads.
 */
export function classify(item: NewsItem, interests: Interests): string[] {
  const excerpt = item.excerpt ?? '';
  const matched: TopicStrength[] = [];
  for (const topic of interests.topics) {
    let hits = 0;
    for (const keyword of topic.keywords) {
      hits +=
        TITLE_HIT_WEIGHT * countTerm(item.title, keyword) +
        EXCERPT_HIT_WEIGHT * countTerm(excerpt, keyword);
    }
    if (hits > 0) matched.push({ id: topic.id, strength: hits * topic.weight });
  }
  matched.sort((a, b) => b.strength - a.strength || a.id.localeCompare(b.id));

  const known = new Set(interests.topics.map((topic) => topic.id));
  const hints = item.topics.filter((hint) => known.has(hint));
  return [...new Set([...matched.map((topic) => topic.id), ...hints])];
}

import { hostOf } from './canonicalise';
import type { Interests, NewsItem } from './schema';
import { containsTerm } from './text';

const MS_PER_HOUR = 3_600_000;

/** A comment costs more effort than an upvote, so it counts double. */
const COMMENT_WEIGHT = 2;

/**
 * Engagement is log-scaled and reaches 1 at this many weighted interactions. About the
 * size of a very large Hacker News thread: beyond it, more noise is not more signal.
 */
const ENGAGEMENT_SATURATION = 3_000;

/** A second topic adds a little. Breadth should not beat one strong match. */
const SECOND_TOPIC_SHARE = 0.25;

const SCORE_DECIMALS = 3;

/** Why an item must never be shown, or null. Checked before any weighting. */
export function exclusionReason(item: NewsItem, interests: Interests): string | null {
  for (const term of interests.blocked.terms) {
    if (containsTerm(item.title, term)) return `blocked term: ${term.toLowerCase()}`;
  }
  const host = hostOf(item.canonicalUrl) ?? '';
  for (const domain of interests.blocked.domains) {
    const blocked = domain.toLowerCase();
    if (host === blocked || host.endsWith(`.${blocked}`)) return `blocked domain: ${blocked}`;
  }
  return null;
}

/**
 * 0 to 1.25: the primary topic in full, plus a share of the best other topic. `classify`
 * puts the strongest match first, so a security story that mentions agents is weighed as
 * a security story.
 */
function topicPart(item: NewsItem, interests: Interests): number {
  const [primary = 0, ...others] = item.topics
    .map((id) => interests.topics.find((topic) => topic.id === id)?.weight)
    .filter((weight): weight is number => weight !== undefined);
  return primary + SECOND_TOPIC_SHARE * Math.max(0, ...others);
}

function sourcePart(item: NewsItem, interests: Interests): number {
  return (
    interests.sourceWeights.ids[item.source.id] ?? interests.sourceWeights.kinds[item.source.kind]
  );
}

/** 0 to 1, rising with points and comments, steeply at first and then barely. */
function engagementPart(item: NewsItem): number {
  const interactions = (item.points ?? 0) + COMMENT_WEIGHT * (item.comments ?? 0);
  return Math.min(1, Math.log1p(interactions) / Math.log1p(ENGAGEMENT_SATURATION));
}

/** 1 when new, 0.5 after one half-life, and so on. Never above 1. */
function recencyPart(item: NewsItem, interests: Interests, now: Date): number {
  const ageHours = Math.max(0, (now.getTime() - Date.parse(item.publishedAt)) / MS_PER_HOUR);
  return 0.5 ** (ageHours / interests.halfLifeHours);
}

/**
 * score = wTopic * topic + wSource * source + wEngagement * engagement + wRecency * recency
 *
 * Every part is between 0 and about 1, so the weights in interests.yaml read as plain
 * priorities. An excluded item scores 0, which `selectDay` treats as "never".
 */
export function score(item: NewsItem, interests: Interests, now: Date): number {
  if (exclusionReason(item, interests) !== null) return 0;
  const { weights } = interests;
  const total =
    weights.topic * topicPart(item, interests) +
    weights.source * sourcePart(item, interests) +
    weights.engagement * engagementPart(item) +
    weights.recency * recencyPart(item, interests, now);
  return Number(total.toFixed(SCORE_DECIMALS));
}

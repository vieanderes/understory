import { newsTopicRank, type Interest } from '@/core/profile/interests';
import { isoWeekKey, weekRange } from './dates';
import type { IsoDate, NewsItem } from './schema';

/*
 * How an edition is read, as opposed to how it is made: the line under a headline, the
 * order a learner sees, and the archive's weeks. The pipeline's output stays untouched.
 */

/**
 * The extractive brief opens with a frame around the headline ("X published "..."."), which
 * only repeats the title above it. Drop that sentence and keep what follows.
 */
function afterHeadlineFrame(text: string): string {
  const open = text.indexOf('"');
  const close = open === -1 ? -1 : text.indexOf('"', open + 1);
  if (close === -1) return text;
  const end = text.indexOf('.', close);
  return end === -1 ? '' : text.slice(end + 1).trim();
}

/** One line on what happened that says more than the headline, or null when nothing does. */
export function storySummary(item: NewsItem): string | null {
  const brief = item.brief;
  if (brief?.generatedBy === 'llm') return brief.whatHappened;
  const rest = brief ? afterHeadlineFrame(brief.whatHappened) : '';
  if (rest.length > 0) return rest;
  const excerpt = item.excerpt?.trim() ?? '';
  return excerpt.length > 0 ? excerpt : null;
}

/**
 * Extractive briefs share one "why it matters" per topic, so a day of agent stories says
 * the same sentence five times. Each reason is shown once, on the first story that has it.
 */
export function withoutRepeatedWhy(items: readonly NewsItem[]): Map<string, string | null> {
  const seen = new Set<string>();
  const result = new Map<string, string | null>();
  for (const item of items) {
    const why = item.brief?.whyItMatters.trim() ?? '';
    result.set(item.id, why.length > 0 && !seen.has(why) ? why : null);
    if (why.length > 0) seen.add(why);
  }
  return result;
}

/** Stories on a followed topic first. The sort is stable, so the edition's order holds. */
export function orderByInterest<T extends Pick<NewsItem, 'topics'>>(
  items: readonly T[],
  interests: readonly Interest[],
): T[] {
  if (interests.length === 0) return [...items];
  const rank = (item: T) => Math.min(1, ...item.topics.map((t) => newsTopicRank(t, interests)));
  return items
    .map((item, index) => ({ item, index, rank: rank(item) }))
    .sort((a, b) => a.rank - b.rank || a.index - b.index)
    .map(({ item }) => item);
}

export interface EditionWeek<T> {
  /** `2026-W41` */
  key: string;
  monday: IsoDate;
  editions: T[];
}

/** Editions, newest first, grouped by ISO week. */
export function editionWeeks<T extends { date: IsoDate }>(
  editions: readonly T[],
): EditionWeek<T>[] {
  const weeks: EditionWeek<T>[] = [];
  for (const edition of editions) {
    const key = isoWeekKey(edition.date);
    const last = weeks.at(-1);
    if (last?.key === key) {
      last.editions.push(edition);
    } else {
      weeks.push({ key, monday: weekRange(key)?.from ?? edition.date, editions: [edition] });
    }
  }
  return weeks;
}

/** The keys either side of `current` in a newest-first list: a day, a week or a month. */
export function neighbours(
  keys: readonly string[],
  current: string,
): { earlier: string | undefined; later: string | undefined } {
  const at = keys.indexOf(current);
  if (at === -1) return { earlier: undefined, later: undefined };
  return { earlier: keys[at + 1], later: at > 0 ? keys[at - 1] : undefined };
}

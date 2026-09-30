import { isoWeekKey, monthKey, monthRange, weekRange, type DateRange } from './dates';
import type { DigestPeriod, NewsDay, NewsDigest, NewsItem, Thread, TopicCount } from './schema';

interface PeriodRules {
  keyOf: (date: string) => string;
  rangeOf: (key: string) => DateRange | null;
  topItems: number;
  /** A topic is a thread when it appears on at least this many days of the period. */
  threadMinDays: number;
}

const RULES: Readonly<Record<DigestPeriod, PeriodRules>> = {
  week: { keyOf: isoWeekKey, rangeOf: weekRange, topItems: 10, threadMinDays: 2 },
  month: { keyOf: monthKey, rangeOf: monthRange, topItems: 20, threadMinDays: 4 },
};

/** Enough to show a thread. The full list is one query away in the day files. */
const THREAD_ITEMS_MAX = 8;

interface TopicTally {
  count: number;
  days: Set<string>;
  items: NewsItem[];
}

function byScore(a: NewsItem, b: NewsItem): number {
  return b.score - a.score || a.id.localeCompare(b.id);
}

/** Every item of the period once. When two days carry one item, the better score stays. */
function uniqueItems(days: readonly NewsDay[]): Map<string, NewsItem> {
  const seen = new Map<string, NewsItem>();
  for (const day of days) {
    for (const item of day.items) {
      const previous = seen.get(item.id);
      if (previous === undefined || item.score > previous.score) seen.set(item.id, item);
    }
  }
  return seen;
}

function tallyTopics(
  days: readonly NewsDay[],
  unique: ReadonlySet<string>,
): Map<string, TopicTally> {
  const tallies = new Map<string, TopicTally>();
  const counted = new Set<string>();
  for (const day of days) {
    for (const item of day.items) {
      if (!unique.has(item.id)) continue;
      for (const topic of item.topics) {
        const tally = tallies.get(topic) ?? { count: 0, days: new Set(), items: [] };
        tally.days.add(day.date);
        // An item repeated on a second day extends the thread but is counted once.
        if (!counted.has(`${topic} ${item.id}`)) {
          counted.add(`${topic} ${item.id}`);
          tally.count += 1;
          tally.items.push(item);
        }
        tallies.set(topic, tally);
      }
    }
  }
  return tallies;
}

/**
 * The week or month a set of days adds up to. The period is the one the latest day falls
 * in, unless `key` pins another. Days outside it are ignored, so a caller may pass more
 * than it needs. Returns null when no day falls in the period.
 *
 * Pure and derived: a digest can always be rebuilt from the day files.
 */
export function rollup(
  days: readonly NewsDay[],
  period: DigestPeriod,
  key?: string,
): NewsDigest | null {
  const rules = RULES[period];
  const sorted = [...days].sort((a, b) => a.date.localeCompare(b.date));
  const latest = sorted.at(-1);
  if (latest === undefined) return null;

  const periodKey = key ?? rules.keyOf(latest.date);
  const range = rules.rangeOf(periodKey);
  const inPeriod = sorted.filter((day) => rules.keyOf(day.date) === periodKey);
  if (range === null || inPeriod.length === 0) return null;

  const unique = uniqueItems(inPeriod);
  const tallies = tallyTopics(inPeriod, new Set(unique.keys()));

  const topicCounts: TopicCount[] = [...tallies]
    .map(([topic, tally]) => ({ topic, count: tally.count }))
    .sort((a, b) => b.count - a.count || a.topic.localeCompare(b.topic));

  const threads: Thread[] = [...tallies]
    .filter(([, tally]) => tally.days.size >= rules.threadMinDays && tally.items.length >= 2)
    .map(([topic, tally]) => ({
      topic,
      days: tally.days.size,
      itemIds: [...tally.items]
        .sort(byScore)
        .slice(0, THREAD_ITEMS_MAX)
        .map((item) => item.id),
    }))
    .sort((a, b) => b.days - a.days || a.topic.localeCompare(b.topic));

  return {
    period,
    key: periodKey,
    from: range.from,
    to: range.to,
    // The newest day's stamp, not the wall clock, so rebuilding a digest changes no bytes.
    generatedAt:
      inPeriod
        .map((day) => day.generatedAt)
        .sort()
        .at(-1) ?? latest.generatedAt,
    days: inPeriod.map((day) => day.date),
    itemCount: unique.size,
    topItems: [...unique.values()].sort(byScore).slice(0, rules.topItems),
    topicCounts,
    threads,
  };
}

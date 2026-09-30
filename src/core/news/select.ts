import type { NewsItem } from './schema';

export interface SelectionOptions {
  /** Items in a day. A digest someone finishes beats a feed nobody does. */
  max: number;
  /** Items sharing one primary topic. */
  perTopicMax: number;
  /** Items from one source. */
  perSourceMax: number;
  /** Items must score above zero and at least this. */
  minScore: number;
}

export const DEFAULT_SELECTION: SelectionOptions = {
  max: 12,
  perTopicMax: 4,
  perSourceMax: 5,
  minScore: 0,
};

function bump(counts: Map<string, number>, key: string): void {
  counts.set(key, (counts.get(key) ?? 0) + 1);
}

/**
 * Greedy pick by score with two diversity caps, so one loud topic or one busy source
 * cannot fill the day. An item with no topic matches none of the reader's interests and is
 * left out. Ties break by id, which makes a re-run over the same input pick the same day.
 */
export function selectDay(
  items: readonly NewsItem[],
  options: Partial<SelectionOptions> = {},
): NewsItem[] {
  const { max, perTopicMax, perSourceMax, minScore } = { ...DEFAULT_SELECTION, ...options };
  const ranked = [...items].sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));
  const perTopic = new Map<string, number>();
  const perSource = new Map<string, number>();
  const picked: NewsItem[] = [];

  for (const item of ranked) {
    if (picked.length >= max) break;
    const topic = item.topics[0];
    if (topic === undefined || item.score <= 0 || item.score < minScore) continue;
    if ((perTopic.get(topic) ?? 0) >= perTopicMax) continue;
    if ((perSource.get(item.source.id) ?? 0) >= perSourceMax) continue;
    bump(perTopic, topic);
    bump(perSource, item.source.id);
    picked.push(item);
  }
  return picked;
}

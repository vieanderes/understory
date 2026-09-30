import { DAY_ITEMS_HARD_CAP, type Brief, type NewsDay, type NewsItem } from './schema';

/**
 * A stored brief is kept, so a re-run costs no second model call and the text a reader saw
 * does not change under them. The one upgrade allowed: a model-written brief may replace
 * an extractive one (the first run had no key, the second did).
 */
function chooseBrief(stored: Brief | undefined, incoming: Brief | undefined): Brief | undefined {
  if (stored === undefined) return incoming;
  if (stored.generatedBy === 'extractive' && incoming?.generatedBy === 'llm') return incoming;
  return stored;
}

function mergeItem(stored: NewsItem, incoming: NewsItem): NewsItem {
  // Numbers and topics come from the newer run. Identity and first sight stay. When the
  // chosen brief is undefined, neither side had one, so the spread carries none either.
  const brief = chooseBrief(stored.brief, incoming.brief);
  return { ...incoming, fetchedAt: stored.fetchedAt, ...(brief !== undefined && { brief }) };
}

function countBriefs(items: readonly NewsItem[], by: Brief['generatedBy']): number {
  return items.filter((item) => item.brief?.generatedBy === by).length;
}

/**
 * Re-running a day must be safe at any hour: merge by item id, keep what was already
 * published, order by score and stop at the hard cap.
 */
export function mergeDay(stored: NewsDay | null, incoming: NewsDay): NewsDay {
  if (stored === null) return incoming;
  if (stored.date !== incoming.date) {
    throw new Error(`Cannot merge ${stored.date} into ${incoming.date}.`);
  }

  const byId = new Map(stored.items.map((item) => [item.id, item]));
  for (const item of incoming.items) {
    const previous = byId.get(item.id);
    byId.set(item.id, previous === undefined ? item : mergeItem(previous, item));
  }
  const items = [...byId.values()]
    .sort((a, b) => b.score - a.score || a.id.localeCompare(b.id))
    .slice(0, DAY_ITEMS_HARD_CAP);

  return {
    date: incoming.date,
    generatedAt: incoming.generatedAt,
    items,
    stats: {
      ...incoming.stats,
      selected: items.length,
      llmBriefs: countBriefs(items, 'llm'),
      extractiveBriefs: countBriefs(items, 'extractive'),
    },
  };
}

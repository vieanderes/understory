export type Vector = number[];
export type EmbedBatch = (texts: string[]) => Promise<Vector[]>;

const BATCH_SIZE = 100;
const IN_FLIGHT = 4;

// From the promises lesson: calls `fn` for every item, at most `limit` at once.
async function mapWithLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = [];
  let next = 0;
  async function worker(): Promise<void> {
    while (next < items.length) {
      const index = next;
      next += 1;
      results[index] = await fn(items[index] as T);
    }
  }
  const workers: Promise<void>[] = [];
  for (let i = 0; i < Math.min(limit, items.length); i++) workers.push(worker());
  await Promise.all(workers);
  return results;
}

// Returns one vector per text, in the order of `texts`.
export async function embedAll(texts: string[], embedBatch: EmbedBatch): Promise<Vector[]> {
  // One call per text, all started at once. Batch them, and cap the calls in flight.
  return Promise.all(texts.map(async (text) => (await embedBatch([text]))[0] ?? []));
}

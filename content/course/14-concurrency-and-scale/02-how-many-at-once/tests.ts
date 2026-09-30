import { embedAll, type Vector } from './solution';

// A fake embedding API. Each vector is [the text's number], so order is easy to check.
// It records every batch size and the most calls it had in flight at once.
function fakeApi(ticksFor: (call: number) => number = () => 3) {
  const stats = { sizes: [] as number[], inFlight: 0, most: 0 };
  async function embedBatch(texts: string[]): Promise<Vector[]> {
    const call = stats.sizes.length;
    stats.sizes.push(texts.length);
    stats.inFlight += 1;
    stats.most = Math.max(stats.most, stats.inFlight);
    for (let tick = 0; tick < ticksFor(call); tick++) await Promise.resolve();
    stats.inFlight -= 1;
    return texts.map((text) => [Number(text)]);
  }
  return { embedBatch, stats };
}

const numbered = (count: number) => Array.from({ length: count }, (_, i) => String(i));

test('sends texts in batches of at most 100', async () => {
  const { embedBatch, stats } = fakeApi();
  await embedAll(numbered(250), embedBatch);
  expect(stats.sizes).toEqual([100, 100, 50]);
});

test('returns one vector per text, in order, even when early batches finish last', async () => {
  const { embedBatch } = fakeApi((call) => 20 - call);
  const vectors = await embedAll(numbered(450), embedBatch);
  expect(vectors).toHaveLength(450);
  expect(vectors[0]).toEqual([0]);
  expect(vectors[199]).toEqual([199]);
  expect(vectors[449]).toEqual([449]);
});

test('never has more than 4 calls in flight', async () => {
  const { embedBatch, stats } = fakeApi();
  await embedAll(numbered(1000), embedBatch);
  expect(stats.sizes).toHaveLength(10);
  expect(stats.most).toBe(4);
});

test('makes no call for an empty list', async () => {
  const { embedBatch, stats } = fakeApi();
  expect(await embedAll([], embedBatch)).toEqual([]);
  expect(stats.sizes).toHaveLength(0);
});

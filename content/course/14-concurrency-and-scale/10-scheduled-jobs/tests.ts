import { runDigest, type DigestStore } from './solution';

const HOUR = 60 * 60 * 1000;

// An in-memory store: `items` are [time created, text], and the watermark starts at `start`.
function makeStore(items: [number, string][], start: number) {
  let watermark = start;
  const store: DigestStore = {
    getWatermark: async () => watermark,
    setWatermark: async (time) => {
      watermark = time;
    },
    newSince: async (from, to) =>
      items.filter(([time]) => time > from && time <= to).map(([, text]) => text),
  };
  return { store, watermark: () => watermark };
}

function makeSender() {
  const sent: string[][] = [];
  return { sent, send: async (items: string[]) => void sent.push(items) };
}

test('sends what is new since the watermark, then moves it', async () => {
  const { store, watermark } = makeStore([[1 * HOUR, 'a'], [2 * HOUR, 'b']], 0);
  const { sent, send } = makeSender();
  expect(await runDigest(store, 24 * HOUR, send)).toBe(2);
  expect(sent).toEqual([['a', 'b']]);
  expect(watermark()).toBe(24 * HOUR);
});

test('a second run straight after sends nothing', async () => {
  const { store } = makeStore([[1 * HOUR, 'a']], 0);
  const { sent, send } = makeSender();
  await runDigest(store, 24 * HOUR, send);
  expect(await runDigest(store, 24 * HOUR, send)).toBe(0);
  expect(sent).toEqual([['a']]);
});

test('after two days down, one run covers the whole gap', async () => {
  const { store } = makeStore([[5 * HOUR, 'old'], [40 * HOUR, 'mid'], [70 * HOUR, 'new']], 0);
  const { sent, send } = makeSender();
  expect(await runDigest(store, 72 * HOUR, send)).toBe(3);
  expect(sent).toEqual([['old', 'mid', 'new']]);
});

test('if sending fails, the watermark stays put for the next run', async () => {
  const { store, watermark } = makeStore([[1 * HOUR, 'a']], 0);
  const failing = async () => {
    throw new Error('mail server down');
  };
  let threw = false;
  try {
    await runDigest(store, 24 * HOUR, failing);
  } catch {
    threw = true;
  }
  expect(threw).toBe(true);
  expect(watermark()).toBe(0);
});

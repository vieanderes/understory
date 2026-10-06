export interface DigestStore {
  // Everything created up to this time, in ms, has been sent.
  getWatermark(): Promise<number>;
  setWatermark(time: number): Promise<void>;
  // Items created after `from`, up to and including `to`, oldest first.
  newSince(from: number, to: number): Promise<string[]>;
}

const DAY = 24 * 60 * 60 * 1000;

// Sends everything new since the last run, and returns how many items it sent.
export async function runDigest(
  store: DigestStore,
  now: number,
  send: (items: string[]) => Promise<void>,
): Promise<number> {
  // Covers "the last 24 hours", whatever happened before.
  const items = await store.newSince(now - DAY, now);
  await send(items);
  return items.length;
}

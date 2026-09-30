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
  const from = await store.getWatermark();
  const items = await store.newSince(from, now);
  if (items.length > 0) await send(items);
  // Saved only after the send worked, so a failed run is covered next time.
  await store.setWatermark(now);
  return items.length;
}

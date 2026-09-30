import { describe, expect, it } from 'vitest';
import type { EventStore, StoredEvent } from '@/core/ports/event-store';

const event = (id: string, extra: Record<string, unknown> = {}): StoredEvent => ({
  id,
  type: 'x',
  ...extra,
});

/** One suite, every adapter. A new store is correct when it passes this unchanged. */
export function eventStoreContract(name: string, make: () => Promise<EventStore> | EventStore) {
  describe(`${name} (EventStore contract)`, () => {
    it('starts empty', async () => {
      const store = await make();
      expect(await store.readAll()).toEqual([]);
      expect(await store.count()).toBe(0);
    });

    it('returns what was appended', async () => {
      const store = await make();
      await store.append([event('a'), event('b', { payload: { n: 1 } })]);
      const ids = (await store.readAll()).map((e) => e.id).sort();
      expect(ids).toEqual(['a', 'b']);
      expect(await store.count()).toBe(2);
    });

    it('is idempotent by id, and the first write wins', async () => {
      const store = await make();
      await store.append([event('a', { n: 1 })]);
      await store.append([event('a', { n: 2 }), event('b')]);
      const all = await store.readAll();
      expect(all).toHaveLength(2);
      expect(all.find((e) => e.id === 'a')?.n).toBe(1);
    });

    it('keeps fields it does not understand', async () => {
      const store = await make();
      await store.append([
        event('a', { type: 'from_the_future', v: 9, payload: { deep: [1, { x: 'y' }] } }),
      ]);
      expect((await store.readAll())[0]).toEqual({
        id: 'a',
        type: 'from_the_future',
        v: 9,
        payload: { deep: [1, { x: 'y' }] },
      });
    });

    it('does not let a caller mutate what is stored', async () => {
      const store = await make();
      const original = event('a', { payload: { n: 1 } });
      await store.append([original]);
      (original.payload as { n: number }).n = 99;
      const read = await store.readAll();
      (read[0]!.payload as { n: number }).n = 77;
      expect(((await store.readAll())[0]!.payload as { n: number }).n).toBe(1);
    });

    it('accepts an empty append', async () => {
      const store = await make();
      await store.append([]);
      expect(await store.count()).toBe(0);
    });

    it('clears events and keeps meta', async () => {
      const store = await make();
      await store.setMeta('deviceId', 'd1');
      await store.append([event('a')]);
      await store.clear();
      expect(await store.count()).toBe(0);
      expect(await store.getMeta('deviceId')).toBe('d1');
    });

    it('reads and overwrites meta', async () => {
      const store = await make();
      expect(await store.getMeta('missing')).toBeUndefined();
      await store.setMeta('k', '1');
      await store.setMeta('k', '2');
      expect(await store.getMeta('k')).toBe('2');
    });
  });
}

import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { EventStore, StoredEvent } from '@/core/ports/event-store';

interface UnderstoryDb extends DBSchema {
  events: { key: string; value: StoredEvent };
  meta: { key: string; value: string };
}

const DB_VERSION = 1;

/**
 * The log in IndexedDB. `idb` is a thin promise wrapper; anything heavier (an ORM, its
 * own sync) would fight an append-only log. The key is the event id, so a duplicate
 * append is a no-op and a sync merge is a plain union.
 */
export class IdbEventStore implements EventStore {
  private db: Promise<IDBPDatabase<UnderstoryDb>> | null = null;

  constructor(private readonly name = 'understory') {}

  private open(): Promise<IDBPDatabase<UnderstoryDb>> {
    this.db ??= openDB<UnderstoryDb>(this.name, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('events'))
          db.createObjectStore('events', { keyPath: 'id' });
        if (!db.objectStoreNames.contains('meta')) db.createObjectStore('meta');
      },
    });
    return this.db;
  }

  async append(events: readonly StoredEvent[]): Promise<void> {
    if (events.length === 0) return;
    const tx = (await this.open()).transaction('events', 'readwrite');
    // `add` rejects on an existing key, which would abort the whole transaction, so look
    // first. All of it runs in one transaction: either every new event lands or none.
    await Promise.all(
      events.map(async (event) => {
        if ((await tx.store.getKey(event.id)) === undefined) await tx.store.add(event);
      }),
    );
    await tx.done;
  }

  async readAll(): Promise<StoredEvent[]> {
    return (await this.open()).getAll('events');
  }

  async count(): Promise<number> {
    return (await this.open()).count('events');
  }

  async clear(): Promise<void> {
    await (await this.open()).clear('events');
  }

  async getMeta(key: string): Promise<string | undefined> {
    return (await this.open()).get('meta', key);
  }

  async setMeta(key: string, value: string): Promise<void> {
    await (await this.open()).put('meta', value, key);
  }

  async close(): Promise<void> {
    if (!this.db) return;
    (await this.db).close();
    this.db = null;
  }
}

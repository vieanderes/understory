import type { EventStore, StoredEvent } from '@/core/ports/event-store';

/** The reference implementation: used in tests and as the fallback when IndexedDB is refused. */
export class MemoryEventStore implements EventStore {
  private readonly events = new Map<string, StoredEvent>();
  private readonly meta = new Map<string, string>();

  async append(events: readonly StoredEvent[]): Promise<void> {
    for (const event of events) {
      if (!this.events.has(event.id)) this.events.set(event.id, structuredClone(event));
    }
  }

  async readAll(): Promise<StoredEvent[]> {
    return [...this.events.values()].map((event) => structuredClone(event));
  }

  async count(): Promise<number> {
    return this.events.size;
  }

  async clear(): Promise<void> {
    this.events.clear();
  }

  async getMeta(key: string): Promise<string | undefined> {
    return this.meta.get(key);
  }

  async setMeta(key: string, value: string): Promise<void> {
    this.meta.set(key, value);
  }
}

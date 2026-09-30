/**
 * Where the append-only log lives. The store holds raw JSON, not typed events: an event
 * written by a newer app version must survive a round trip through an older one, so
 * nothing is parsed or dropped on the way in or out. Upcasting happens on read, in core.
 *
 * Contract (tests/unit/adapters/event-store/contract.ts runs it against every adapter):
 *  - append is idempotent by `id`: appending the same event twice stores it once
 *  - readAll returns every stored event, in no promised order (the reducer sorts)
 *  - meta is a tiny key-value space for the device id and similar, outside the log
 */
export interface StoredEvent {
  readonly id: string;
  readonly [key: string]: unknown;
}

export interface EventStore {
  append(events: readonly StoredEvent[]): Promise<void>;
  readAll(): Promise<StoredEvent[]>;
  count(): Promise<number>;
  /** Removes every event. Meta is kept, so the device keeps its identity. */
  clear(): Promise<void>;
  getMeta(key: string): Promise<string | undefined>;
  setMeta(key: string, value: string): Promise<void>;
}

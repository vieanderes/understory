export interface Clock {
  now(): number;
}

export interface LruCacheOptions {
  capacity: number;
  defaultTtlMs?: number;
  clock?: Clock;
}

export interface SetOptions {
  ttlMs?: number;
}

interface Entry<V> {
  value: V;
  expiresAt: number;
}

const systemClock: Clock = { now: () => Date.now() };

export class LruCache<K, V> {
  // A Map iterates in insertion order, so the first key is always the least recently used.
  // Deleting and re-inserting a key moves it to the end in O(1).
  readonly #entries = new Map<K, Entry<V>>();
  readonly #capacity: number;
  readonly #defaultTtlMs: number;
  readonly #clock: Clock;
  // A lower bound on the earliest expiry. It lets a full cache skip the O(n) purge when
  // nothing can have expired, which keeps set O(1) amortised.
  #earliestExpiry = Infinity;

  constructor({ capacity, defaultTtlMs = Infinity, clock = systemClock }: LruCacheOptions) {
    if (!Number.isInteger(capacity) || capacity < 1) {
      throw new RangeError(`capacity must be a positive integer, got ${capacity}`);
    }
    if (!(defaultTtlMs >= 0)) {
      throw new RangeError(`defaultTtlMs must be zero or more, got ${defaultTtlMs}`);
    }
    this.#capacity = capacity;
    this.#defaultTtlMs = defaultTtlMs;
    this.#clock = clock;
  }

  get(key: K): V | undefined {
    const entry = this.#live(key);
    if (!entry) return undefined;
    this.#entries.delete(key);
    this.#entries.set(key, entry);
    return entry.value;
  }

  set(key: K, value: V, { ttlMs = this.#defaultTtlMs }: SetOptions = {}): void {
    const expiresAt = this.#clock.now() + ttlMs;
    // Delete first so a replaced key moves to the most recent end and never forces an eviction.
    this.#entries.delete(key);
    if (this.#entries.size >= this.#capacity) this.#purgeExpired();
    if (this.#entries.size >= this.#capacity) {
      const oldest = this.#entries.keys().next();
      if (!oldest.done) this.#entries.delete(oldest.value);
    }
    this.#entries.set(key, { value, expiresAt });
    this.#earliestExpiry = Math.min(this.#earliestExpiry, expiresAt);
  }

  has(key: K): boolean {
    return this.#live(key) !== undefined;
  }

  delete(key: K): boolean {
    const live = this.#live(key) !== undefined;
    this.#entries.delete(key);
    return live;
  }

  get size(): number {
    this.#purgeExpired();
    return this.#entries.size;
  }

  #live(key: K): Entry<V> | undefined {
    const entry = this.#entries.get(key);
    if (!entry) return undefined;
    if (this.#isExpired(entry)) {
      this.#entries.delete(key);
      return undefined;
    }
    return entry;
  }

  #isExpired(entry: Entry<V>): boolean {
    return this.#clock.now() >= entry.expiresAt;
  }

  #purgeExpired(): void {
    if (this.#clock.now() < this.#earliestExpiry) return;
    let earliest = Infinity;
    for (const [key, entry] of this.#entries) {
      if (this.#isExpired(entry)) this.#entries.delete(key);
      else earliest = Math.min(earliest, entry.expiresAt);
    }
    this.#earliestExpiry = earliest;
  }
}

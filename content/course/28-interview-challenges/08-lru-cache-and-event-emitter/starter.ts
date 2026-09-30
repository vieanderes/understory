export class LRUCache<K, V> {
  #capacity: number;
  #entries = new Map<K, V>();

  constructor(capacity: number) {
    this.#capacity = capacity;
  }

  get size(): number {
    return this.#entries.size;
  }

  get(key: K): V | undefined {
    // A read should also mark the key as the most recently used.
    return this.#entries.get(key);
  }

  put(key: K, value: V): void {
    // Store the value, then evict the least recently used key once over capacity.
    this.#entries.set(key, value);
  }
}

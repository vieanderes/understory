// A Map iterates in insertion order, so the first key is always the least recently used,
// as long as every read and every write moves its key to the end.
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
    if (!this.#entries.has(key)) return undefined;
    const value = this.#entries.get(key) as V;
    this.#entries.delete(key);
    this.#entries.set(key, value);
    return value;
  }

  put(key: K, value: V): void {
    this.#entries.delete(key);
    this.#entries.set(key, value);
    if (this.#entries.size > this.#capacity) {
      const oldest = this.#entries.keys().next().value as K;
      this.#entries.delete(oldest);
    }
  }
}

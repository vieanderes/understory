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

export class LruCache<K, V> {
  constructor(options: LruCacheOptions) {
    void options;
  }

  get(key: K): V | undefined {
    void key;
    throw new Error('Not implemented');
  }

  set(key: K, value: V, options?: SetOptions): void {
    void key;
    void value;
    void options;
    throw new Error('Not implemented');
  }

  has(key: K): boolean {
    void key;
    throw new Error('Not implemented');
  }

  delete(key: K): boolean {
    void key;
    throw new Error('Not implemented');
  }

  get size(): number {
    throw new Error('Not implemented');
  }
}

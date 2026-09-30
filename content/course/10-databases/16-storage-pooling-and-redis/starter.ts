export interface Entry {
  value: string;
  expiresAt: number;
}

export type Cache = Record<string, Entry>;

export function cacheGet(cache: Cache, key: string, now: number): string | null {
  // Replace this. It never checks the expiry, so a stale value is served for ever.
  const entry = cache[key];
  return entry === undefined ? null : entry.value;
}

export function cacheSet(cache: Cache, key: string, value: string, ttlSeconds: number, now: number): void {
  // Replace this. It stores the value with no expiry at all.
  cache[key] = { value, expiresAt: Infinity };
}

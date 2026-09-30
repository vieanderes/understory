export interface Entry {
  value: string;
  expiresAt: number;
}

export type Cache = Record<string, Entry>;

export function cacheGet(cache: Cache, key: string, now: number): string | null {
  const entry = cache[key];
  if (entry === undefined) return null;
  if (now >= entry.expiresAt) {
    delete cache[key];
    return null;
  }
  return entry.value;
}

export function cacheSet(cache: Cache, key: string, value: string, ttlSeconds: number, now: number): void {
  cache[key] = { value, expiresAt: now + ttlSeconds };
}

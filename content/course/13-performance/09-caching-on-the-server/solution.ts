// Caches load(id) for ttlMs milliseconds. now() reads the clock.
export function createCache<T>(load: (id: string) => Promise<T>, ttlMs: number, now: () => number) {
  const entries = new Map<string, { value: T; expires: number }>();

  async function get(id: string): Promise<T> {
    const hit = entries.get(id);
    if (hit && hit.expires > now()) return hit.value;
    const value = await load(id);
    entries.set(id, { value, expires: now() + ttlMs });
    return value;
  }

  function invalidate(id: string): void {
    entries.delete(id);
  }

  return { get, invalidate };
}

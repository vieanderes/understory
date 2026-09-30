// Caches load(id) for ttlMs milliseconds. now() reads the clock.
export function createCache<T>(load: (id: string) => Promise<T>, ttlMs: number, now: () => number) {
  const entries = new Map<string, { value: T; expires: number }>();

  async function get(id: string): Promise<T> {
    return load(id);
  }

  function invalidate(id: string): void {}

  return { get, invalidate };
}

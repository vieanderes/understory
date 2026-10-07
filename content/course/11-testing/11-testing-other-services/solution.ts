export type Json = null | boolean | number | string | Json[] | { [key: string]: Json };

export function scrubFixture(fixture: Json, sensitiveKeys: string[]): Json {
  const sensitive = new Set(sensitiveKeys.map((key) => key.toLowerCase()));
  // One map for the whole fixture, so a value seen twice gets the same placeholder.
  const seen = new Map<string, string>();
  const counts = new Map<string, number>();

  function placeholder(original: string, key: string): string {
    const known = seen.get(original);
    if (known !== undefined) return known;
    // An email stays an email, so a schema check on the fixture still passes.
    const isEmail = original.includes('@');
    const prefix = isEmail ? '@' : key;
    const n = (counts.get(prefix) ?? 0) + 1;
    counts.set(prefix, n);
    const made = isEmail ? `user-${n}@example.com` : `${key}-${n}`;
    seen.set(original, made);
    return made;
  }

  function walk(value: Json, key: string | null): Json {
    if (typeof value === 'string') {
      if (value.startsWith('Bearer ')) return 'Bearer REDACTED';
      if (key === null || !sensitive.has(key)) return value;
      return placeholder(value, key);
    }
    if (Array.isArray(value)) return value.map((item) => walk(item, key));
    if (value !== null && typeof value === 'object') {
      const out: { [key: string]: Json } = {};
      for (const [name, child] of Object.entries(value)) out[name] = walk(child, name.toLowerCase());
      return out;
    }
    return value;
  }

  return walk(fixture, null);
}

export type Json = null | boolean | number | string | Json[] | { [key: string]: Json };

export interface PlantRecord {
  id: string;
  data: { [key: string]: Json }; // already normalised: only the fields you store
}

// Given: a small, fast 32-bit hash (FNV-1a). Production code would use SHA-256.
export function fnv1a(text: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
}

export function canonical(value: Json): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value !== null && typeof value === 'object') {
    // Sorted at every level, so the vendor's key order can't change the text.
    const keys = Object.keys(value).sort();
    return `{${keys.map((key) => `${JSON.stringify(key)}:${canonical(value[key]!)}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

export function detectChanges(stored: ReadonlyMap<string, string>, records: PlantRecord[]) {
  const changed: string[] = [];
  const hashes = new Map<string, string>();
  for (const record of records) {
    const hash = fnv1a(canonical(record.data));
    hashes.set(record.id, hash);
    if (stored.get(record.id) !== hash) changed.push(record.id);
  }
  return { changed, hashes };
}

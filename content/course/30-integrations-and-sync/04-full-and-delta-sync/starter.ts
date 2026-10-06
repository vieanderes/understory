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
  // Keeps whatever key order the vendor happened to send.
  return JSON.stringify(value);
}

export function detectChanges(stored: ReadonlyMap<string, string>, records: PlantRecord[]) {
  // Rewrites every record, every night.
  const changed: string[] = records.map((record) => record.id);
  const hashes = new Map<string, string>();
  return { changed, hashes };
}

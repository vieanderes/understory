/*
 * Item ids must be the same on every machine and in the Swift port, and src/core has no
 * crypto module. FNV-1a over UTF-16 code units, 64 bits wide, is enough: ids only need to
 * be stable and collision-free across a few thousand URLs a year, not unguessable.
 */

const FNV_OFFSET_BASIS_64 = 0xcbf29ce484222325n;
const FNV_PRIME_64 = 0x100000001b3n;
const MASK_64 = 0xffffffffffffffffn;
const HEX_DIGITS_64 = 16;

export function fnv1a64(input: string): string {
  let hash = FNV_OFFSET_BASIS_64;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= BigInt(input.charCodeAt(index));
    hash = (hash * FNV_PRIME_64) & MASK_64;
  }
  return hash.toString(16).padStart(HEX_DIGITS_64, '0');
}

/** The id of a news item: the hash of its canonical URL. */
export function itemId(canonicalUrl: string): string {
  return fnv1a64(canonicalUrl);
}

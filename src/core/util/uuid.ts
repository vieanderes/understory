import type { Rng } from './rng';

/**
 * UUIDv7 (RFC 9562): a 48-bit millisecond Unix timestamp followed by random bits, so
 * ids sort chronologically. `crypto.randomUUID` is a global, not a port, so it cannot
 * be called from core. This pure generator takes the timestamp and randomness as
 * explicit inputs; a real adapter can wrap `crypto.getRandomValues` behind `IdGen`
 * later (src/core/ports/id-gen.ts).
 */
export function uuidv7(timestampMs: number, rng: Rng): string {
  const bytes: number[] = new Array<number>(16).fill(0);
  let t = Math.trunc(timestampMs);
  for (let i = 5; i >= 0; i -= 1) {
    bytes[i] = t % 256;
    t = Math.floor(t / 256);
  }
  for (let i = 6; i < 16; i += 1) {
    bytes[i] = Math.floor(rng.next() * 256);
  }
  // Version 7 occupies the top nibble of byte 6. The loop above always assigns
  // indices 6..15, so these reads cannot be undefined (assertion, not a guess).
  bytes[6] = (bytes[6]! & 0x0f) | 0x70;
  // The RFC 4122 variant (10xxxxxx) occupies the top two bits of byte 8.
  bytes[8] = (bytes[8]! & 0x3f) | 0x80;
  const hex = bytes.map((b) => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

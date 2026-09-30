import { describe, expect, it } from 'vitest';
import { mulberry32 } from '@/core/util/rng';
import { uuidv7 } from '@/core/util/uuid';

const UUID_V7_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

describe('uuidv7', () => {
  it('produces a well-formed UUIDv7 string', () => {
    const id = uuidv7(Date.parse('2026-09-17T10:00:00Z'), mulberry32(1));
    expect(id).toMatch(UUID_V7_RE);
  });

  it('is deterministic for the same timestamp and rng seed', () => {
    const timestamp = Date.parse('2026-09-17T10:00:00Z');
    expect(uuidv7(timestamp, mulberry32(5))).toBe(uuidv7(timestamp, mulberry32(5)));
  });

  it('sorts chronologically: an earlier timestamp gives a lexicographically smaller id', () => {
    const rng = mulberry32(2);
    const earlier = uuidv7(Date.parse('2026-01-01T00:00:00Z'), rng);
    const later = uuidv7(Date.parse('2026-06-01T00:00:00Z'), mulberry32(2));
    expect(earlier < later).toBe(true);
  });

  it('differs for different rng draws at the same timestamp', () => {
    const timestamp = Date.parse('2026-09-17T10:00:00Z');
    expect(uuidv7(timestamp, mulberry32(1))).not.toBe(uuidv7(timestamp, mulberry32(2)));
  });

  it('encodes a timestamp with a fractional or zero start correctly (byte boundary)', () => {
    const id = uuidv7(0, mulberry32(1));
    expect(id).toMatch(UUID_V7_RE);
    expect(id.startsWith('00000000-0000-7')).toBe(true);
  });
});

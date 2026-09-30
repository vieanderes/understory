import { describe, expect, it } from 'vitest';
import {
  CLIENT_STALE_FLOOR,
  PROFILES,
  clientStale,
  duration,
  entryState,
  lifeOf,
  prerenderable,
  type Entry,
} from '@/core/labs/cache-layer-explorer';

/*
 * The numbers come from cacheLife.md, "Preset cache profiles". If Next.js changes them,
 * these tests are where it shows.
 */

const entry = (over: Partial<Entry> = {}): Entry => ({
  value: 1,
  filledAt: 0,
  staleUntil: null,
  hard: false,
  ...over,
});

describe('cache profiles', () => {
  it('matches the preset table in the Next.js docs', () => {
    expect(PROFILES.default).toEqual({ stale: 300, revalidate: 900, expire: null });
    expect(PROFILES.seconds).toEqual({ stale: 30, revalidate: 1, expire: 60 });
    expect(PROFILES.minutes).toEqual({ stale: 300, revalidate: 60, expire: 3600 });
    expect(PROFILES.hours).toEqual({ stale: 300, revalidate: 3600, expire: 86400 });
    expect(PROFILES.days).toEqual({ stale: 300, revalidate: 86400, expire: 604800 });
    expect(PROFILES.weeks).toEqual({ stale: 300, revalidate: 604800, expire: 2592000 });
    expect(PROFILES.max).toEqual({ stale: 300, revalidate: 2592000, expire: 31536000 });
  });

  it('reads a profile by name', () => {
    expect(lifeOf('hours').revalidate).toBe(3600);
  });

  it('keeps a page in a tab for at least 30 seconds, whatever stale says', () => {
    expect(CLIENT_STALE_FLOOR).toBe(30);
    expect(clientStale('seconds')).toBe(30);
    expect(clientStale('hours')).toBe(300);
  });

  it('prerenders every preset except seconds, whose expire is under five minutes', () => {
    expect(prerenderable('seconds')).toBe(false);
    for (const name of ['minutes', 'hours', 'days', 'weeks', 'default', 'max'] as const) {
      expect(prerenderable(name)).toBe(true);
    }
  });
});

describe('entryState', () => {
  it('is empty with no entry', () => {
    expect(entryState(null, 'hours', 0)).toBe('empty');
  });

  it('is fresh until revalidate, then stale, then expired', () => {
    expect(entryState(entry(), 'hours', 3599)).toBe('fresh');
    expect(entryState(entry(), 'hours', 3600)).toBe('stale');
    expect(entryState(entry(), 'hours', 86399)).toBe('stale');
    expect(entryState(entry(), 'hours', 86400)).toBe('expired');
  });

  it('never expires on a profile with no expire', () => {
    expect(entryState(entry(), 'default', 60 * 60 * 24 * 365 * 10)).toBe('stale');
  });

  it('is expired at once after updateTag, so the next request waits', () => {
    expect(entryState(entry({ hard: true }), 'max', 0)).toBe('expired');
  });

  it('is stale inside a revalidateTag window and expired past it', () => {
    expect(entryState(entry({ staleUntil: 100 }), 'max', 99)).toBe('stale');
    expect(entryState(entry({ staleUntil: 100 }), 'max', 100)).toBe('expired');
  });
});

describe('duration', () => {
  it('writes seconds as a short label', () => {
    expect(duration(0)).toBe('0s');
    expect(duration(45)).toBe('45s');
    expect(duration(90)).toBe('1m 30s');
    expect(duration(3600)).toBe('1h');
    expect(duration(7260)).toBe('2h 1m');
    expect(duration(86400)).toBe('1d');
    expect(duration(604800)).toBe('7d');
  });
});

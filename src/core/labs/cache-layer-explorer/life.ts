import type { EntryState, Entry, Life, ProfileName, Tick } from './types';

/*
 * The preset cache profiles, from
 * node_modules/next/dist/docs/01-app/03-api-reference/04-functions/cacheLife.md,
 * "Preset cache profiles". `expire: null` is that table's "never".
 */
export const PROFILES: Readonly<Record<ProfileName, Life>> = {
  default: { stale: 300, revalidate: 900, expire: null },
  seconds: { stale: 30, revalidate: 1, expire: 60 },
  minutes: { stale: 300, revalidate: 60, expire: 3600 },
  hours: { stale: 300, revalidate: 3600, expire: 86400 },
  days: { stale: 300, revalidate: 86400, expire: 604800 },
  weeks: { stale: 300, revalidate: 604800, expire: 2592000 },
  max: { stale: 300, revalidate: 2592000, expire: 31536000 },
};

/**
 * The router keeps a page for at least 30 seconds whatever `stale` says, so that a
 * prefetched link is still usable when it is clicked (cacheLife.md, "Client cache
 * behavior"). It applies to time running out, not to a tag call.
 */
export const CLIENT_STALE_FLOOR = 30;

export function lifeOf(profile: ProfileName): Life {
  return PROFILES[profile];
}

export function clientStale(profile: ProfileName): number {
  return Math.max(CLIENT_STALE_FLOOR, lifeOf(profile).stale);
}

/**
 * What the shared store would do with this entry now.
 *
 * `fresh` answers straight away. `stale` answers with the old value and starts a
 * background refresh. `expired` makes the request wait for fresh data.
 */
export function entryState(entry: Entry | null, profile: ProfileName, now: Tick): EntryState {
  if (entry === null) return 'empty';
  // `updateTag` expires the entry at once: the next request waits rather than serve stale.
  if (entry.hard) return 'expired';
  // `revalidateTag` sets a window in which stale content may still be served.
  if (entry.staleUntil !== null) return now < entry.staleUntil ? 'stale' : 'expired';
  const { revalidate, expire } = lifeOf(profile);
  const age = now - entry.filledAt;
  if (expire !== null && age >= expire) return 'expired';
  return age >= revalidate ? 'stale' : 'fresh';
}

/** Whole seconds as a short label: 90 becomes "1m 30s", 7200 "2h". */
export function duration(seconds: number): string {
  if (seconds <= 0) return '0s';
  const units: readonly [number, string][] = [
    [86400, 'd'],
    [3600, 'h'],
    [60, 'm'],
    [1, 's'],
  ];
  const parts: string[] = [];
  let left = Math.floor(seconds);
  for (const [size, suffix] of units) {
    const count = Math.floor(left / size);
    if (count > 0) parts.push(`${count}${suffix}`);
    left -= count * size;
    if (parts.length === 2) break;
  }
  return parts.join(' ');
}

/**
 * Whether cached content with this lifetime is included in a prerender.
 *
 * cacheLife.md, "Prerendering behavior": a `revalidate` of 0 or an `expire` under five
 * minutes makes the content a dynamic hole resolved at request time, and a `stale` under
 * 30 seconds is excluded because a prefetch would expire before the click. Of the
 * presets only `seconds` falls under a threshold, through its one minute `expire`.
 */
export function prerenderable(profile: ProfileName): boolean {
  const { stale, revalidate, expire } = lifeOf(profile);
  if (revalidate === 0) return false;
  if (expire !== null && expire < 300) return false;
  return stale >= CLIENT_STALE_FLOOR;
}

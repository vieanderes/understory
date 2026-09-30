import { describe, expect, it } from 'vitest';
import {
  initialWorld,
  routeOf,
  actorOf,
  step,
  currentPath,
} from '@/core/labs/cache-layer-explorer';
import { play, scenario } from './helpers';

describe('initialWorld', () => {
  it('starts with nothing built, no store filled and every browser empty', () => {
    const s = scenario();
    const world = initialWorld(s);
    expect(world.now).toBe(0);
    expect(world.source).toBe(1);
    expect(world.entry).toBeNull();
    expect(world.pages).toEqual({});
    expect(world.clients.a).toEqual({ history: [], cursor: -1, cached: {} });
    expect(world.served).toBeNull();
  });

  it('finds a route and an actor by id', () => {
    const s = scenario();
    expect(routeOf(s, '/list')?.usesCache).toBe(true);
    expect(routeOf(s, '/nope')).toBeUndefined();
    expect(actorOf(s, 'staff')?.label).toBe('Staff');
  });
});

describe('build', () => {
  it('reads the cached function once and prerenders the routes that use it', () => {
    const s = scenario();
    const world = play(s, [{ kind: 'build' }]);
    expect(world.entry).toEqual({ value: 1, filledAt: 0, staleUntil: null, hard: false });
    expect(Object.keys(world.pages)).toEqual(['/list']);
    expect(world.memo).toEqual({ reads: 2, misses: 1 });
    expect(world.note).toContain('/list prerendered');
  });

  it('prerenders nothing when the lifetime is too short', () => {
    const s = scenario({
      cache: { label: 'list', life: 'seconds', tag: 'list', reads: 2, memoised: true },
    });
    const world = play(s, [{ kind: 'build' }]);
    expect(world.pages).toEqual({});
    expect(world.note).toContain('too short to prerender');
  });
});

describe('publish', () => {
  it('moves the source on and tells no cache', () => {
    const s = scenario();
    const world = play(s, [{ kind: 'build' }, { kind: 'publish' }]);
    expect(world.source).toBe(2);
    expect(world.entry?.value).toBe(1);
    expect(world.note).toContain('No cache was told');
  });
});

describe('a document load', () => {
  it('is answered by the prerendered page, with no render and no read', () => {
    const s = scenario();
    const world = play(s, [{ kind: 'build' }, { kind: 'visit', actor: 'a', path: '/list' }]);
    expect(world.served).toEqual({
      source: 'prerendered-page',
      actor: 'a',
      value: 1,
      waited: false,
      refreshed: false,
    });
    expect(world.memo).toBeNull();
    expect(world.clients.a?.cached['/list']).toEqual({ value: 1, storedAt: 0 });
    expect(currentPath(world, 'a')).toBe('/list');
  });

  it('waits for the cached read when nothing is stored yet', () => {
    const s = scenario();
    const world = play(s, [{ kind: 'visit', actor: 'a', path: '/list' }]);
    expect(world.served?.source).toBe('use-cache-entry');
    expect(world.served?.waited).toBe(true);
    expect(world.entry?.value).toBe(1);
    expect(world.note).toContain('Nothing was stored');
  });

  it('renders a route with no cached read every time', () => {
    const s = scenario();
    const world = play(s, [{ kind: 'build' }, { kind: 'visit', actor: 'a', path: '/about' }]);
    expect(world.served?.source).toBe('rendered');
    expect(world.memo).toEqual({ reads: 2, misses: 1 });
  });

  it('reaches the entry rather than a prerender when the lifetime is too short', () => {
    const s = scenario({
      cache: { label: 'list', life: 'seconds', tag: 'list', reads: 3, memoised: false },
    });
    const world = play(s, [{ kind: 'build' }, { kind: 'visit', actor: 'a', path: '/list' }]);
    expect(world.served?.source).toBe('use-cache-entry');
    expect(world.memo).toEqual({ reads: 3, misses: 3 });
  });

  it('empties that browser’s router cache first', () => {
    const s = scenario();
    const world = play(s, [
      { kind: 'build' },
      { kind: 'visit', actor: 'a', path: '/list' },
      { kind: 'navigate', actor: 'a', path: '/about' },
      { kind: 'visit', actor: 'a', path: '/list' },
    ]);
    expect(Object.keys(world.clients.a?.cached ?? {})).toEqual(['/list']);
  });
});

describe('a stale entry', () => {
  it('serves the old value and refreshes behind it', () => {
    const s = scenario();
    const world = play(s, [
      { kind: 'build' },
      { kind: 'publish' },
      { kind: 'wait', seconds: 3600 },
      { kind: 'visit', actor: 'a', path: '/list' },
    ]);
    expect(world.served).toMatchObject({ value: 1, refreshed: true, waited: false });
    expect(world.entry).toEqual({ value: 2, filledAt: 3600, staleUntil: null, hard: false });
    expect(world.pages['/list']?.value).toBe(2);
    expect(world.note).toContain('refreshed behind it to v2');
  });

  it('waits once the entry has expired', () => {
    const s = scenario();
    const world = play(s, [
      { kind: 'build' },
      { kind: 'publish' },
      { kind: 'wait', seconds: 86400 },
      { kind: 'visit', actor: 'a', path: '/list' },
    ]);
    expect(world.served).toMatchObject({ value: 2, waited: true, refreshed: false });
  });

  it('says what a wait changed, and nothing when it changed nothing', () => {
    const s = scenario();
    const built = play(s, [{ kind: 'build' }]);
    expect(step(s, built, { kind: 'wait', seconds: 60 }).note).toContain('still fresh');
    expect(step(s, built, { kind: 'wait', seconds: 3600 }).note).toContain('revalidate');
    expect(step(s, built, { kind: 'wait', seconds: 86400 }).note).toContain('wait for fresh data');
  });
});

describe('a client transition', () => {
  it('is answered by the tab itself inside the stale window', () => {
    const s = scenario();
    const world = play(s, [
      { kind: 'build' },
      { kind: 'visit', actor: 'a', path: '/list' },
      { kind: 'navigate', actor: 'a', path: '/about' },
      { kind: 'navigate', actor: 'a', path: '/list' },
    ]);
    expect(world.served).toMatchObject({ source: 'client-router-cache', value: 1 });
    expect(world.note).toContain('with no request');
  });

  it('asks the server again once the stale window has passed', () => {
    const s = scenario();
    const world = play(s, [
      { kind: 'build' },
      { kind: 'visit', actor: 'a', path: '/list' },
      { kind: 'navigate', actor: 'a', path: '/about' },
      { kind: 'wait', seconds: 300 },
      { kind: 'navigate', actor: 'a', path: '/list' },
    ]);
    expect(world.served?.source).toBe('prerendered-page');
  });
});

describe('Back', () => {
  it('reuses the stored page whatever the stale time says', () => {
    const s = scenario();
    const world = play(s, [
      { kind: 'build' },
      { kind: 'visit', actor: 'a', path: '/list' },
      { kind: 'navigate', actor: 'a', path: '/about' },
      { kind: 'wait', seconds: 100000 },
      { kind: 'back', actor: 'a' },
    ]);
    expect(world.served).toMatchObject({ source: 'client-router-cache', value: 1 });
    expect(currentPath(world, 'a')).toBe('/list');
  });

  it('has nowhere to go from the first page', () => {
    const s = scenario();
    const world = play(s, [
      { kind: 'build' },
      { kind: 'visit', actor: 'a', path: '/list' },
      { kind: 'back', actor: 'a' },
    ]);
    expect(world.served).toBeNull();
    expect(world.note).toContain('nowhere to go');
  });

  it('asks the server when the router cache has been cleared', () => {
    const s = scenario();
    const world = play(s, [
      { kind: 'build' },
      { kind: 'visit', actor: 'a', path: '/list' },
      { kind: 'navigate', actor: 'a', path: '/about' },
      { kind: 'action', actor: 'a', call: { fn: 'refresh' } },
      { kind: 'back', actor: 'a' },
    ]);
    expect(world.served?.source).toBe('prerendered-page');
    expect(world.note).toContain('router cache had gone');
  });
});

describe('a reload', () => {
  it('empties the router cache and asks the server for the page on screen', () => {
    const s = scenario();
    const world = play(s, [
      { kind: 'build' },
      { kind: 'visit', actor: 'a', path: '/list' },
      { kind: 'reload', actor: 'a' },
    ]);
    expect(world.served?.source).toBe('prerendered-page');
    expect(Object.keys(world.clients.a?.cached ?? {})).toEqual(['/list']);
    expect(world.note).toContain('empties the router cache');
  });

  it('does nothing in a browser with no page open', () => {
    const s = scenario();
    const world = play(s, [{ kind: 'build' }, { kind: 'reload', actor: 'a' }]);
    expect(world.note).toContain('no page open');
  });
});

describe('a Server Action', () => {
  const opened = [
    { kind: 'build' },
    { kind: 'visit', actor: 'a', path: '/list' },
    { kind: 'navigate', actor: 'a', path: '/about' },
  ] as const;

  it('updateTag expires the entry at once, so the next request waits', () => {
    const s = scenario();
    const world = play(s, [
      ...opened,
      { kind: 'action', actor: 'staff', call: { fn: 'updateTag', tag: 'list' } },
    ]);
    expect(world.source).toBe(2);
    expect(world.entry?.hard).toBe(true);
    expect(world.pages['/list']?.invalidated).toBe(true);
    const next = step(s, world, { kind: 'visit', actor: 'staff', path: '/list' });
    expect(next.served).toMatchObject({ source: 'use-cache-entry', value: 2, waited: true });
  });

  it('revalidateTag with max serves the old value while a refresh runs', () => {
    const s = scenario();
    const world = play(s, [
      ...opened,
      { kind: 'action', actor: 'staff', call: { fn: 'revalidateTag', tag: 'list', window: 'max' } },
    ]);
    expect(world.entry?.staleUntil).toBe(31536000);
    const next = step(s, world, { kind: 'visit', actor: 'staff', path: '/list' });
    expect(next.served).toMatchObject({ value: 1, refreshed: true, waited: false });
    expect(next.entry?.value).toBe(2);
  });

  it('clears the router cache of the browser that called it, and no other', () => {
    const s = scenario();
    const world = play(s, [
      ...opened,
      { kind: 'action', actor: 'staff', call: { fn: 'updateTag', tag: 'list' } },
    ]);
    expect(world.clients.a?.cached['/list']).toEqual({ value: 1, storedAt: 0 });

    const own = play(s, [
      ...opened,
      { kind: 'action', actor: 'a', call: { fn: 'updateTag', tag: 'list' } },
    ]);
    expect(own.clients.a?.cached).toEqual({});
  });

  it('refresh touches no server store, only the caller’s tab', () => {
    const s = scenario();
    const world = play(s, [...opened, { kind: 'action', actor: 'a', call: { fn: 'refresh' } }]);
    expect(world.entry).toEqual({ value: 1, filledAt: 0, staleUntil: null, hard: false });
    expect(world.pages['/list']?.invalidated).toBe(false);
    expect(world.clients.a?.cached).toEqual({});
    expect(world.note).toContain("the server's stores were not touched");
  });

  it('leaves the entry alone when the tag does not match', () => {
    const s = scenario();
    const world = play(s, [
      ...opened,
      { kind: 'action', actor: 'staff', call: { fn: 'updateTag', tag: 'other' } },
    ]);
    expect(world.entry?.hard).toBe(false);
    expect(world.note).toContain("is not 'list'");
  });

  it('reaches nothing when the cached read carries no tag', () => {
    const s = scenario({
      cache: { label: 'list', life: 'hours', tag: null, reads: 1, memoised: true },
    });
    const world = play(s, [
      ...opened,
      { kind: 'action', actor: 'staff', call: { fn: 'updateTag', tag: 'list' } },
    ]);
    expect(world.entry?.hard).toBe(false);
    expect(world.note).toContain('no cacheTag');
  });

  it('a tag call before the build leaves no entry behind', () => {
    const s = scenario();
    const world = play(s, [
      { kind: 'action', actor: 'staff', call: { fn: 'updateTag', tag: 'list' } },
    ]);
    expect(world.entry).toBeNull();
    const other = play(s, [
      { kind: 'action', actor: 'staff', call: { fn: 'revalidateTag', tag: 'list', window: 60 } },
    ]);
    expect(other.entry).toBeNull();
  });
});

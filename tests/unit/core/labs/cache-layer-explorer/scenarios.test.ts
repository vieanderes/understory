import { describe, expect, it } from 'vitest';
import {
  DEFAULT_SCENARIO_ID,
  LEFT_OUT,
  SCENARIOS,
  buildScenario,
  eventAt,
  run,
  scenarioDef,
  variantOf,
  type ScenarioDef,
} from '@/core/labs/cache-layer-explorer';

describe('the shipped scenarios', () => {
  it('are four, each with a prompt, a story and a timeline that starts with a build', () => {
    expect(SCENARIOS).toHaveLength(4);
    for (const s of SCENARIOS) {
      expect(s.prompt).toMatch(/^Before you step:/);
      expect(s.story.length).toBeGreaterThan(20);
      expect(s.timeline[0]).toEqual({ kind: 'build' });
      expect(s.actors.length).toBeGreaterThan(1);
      expect(s.routes.some((route) => route.usesCache)).toBe(true);
      expect(s.variants.length).toBeGreaterThan(0);
    }
  });

  it('name each case after what it shows, not after its setting', () => {
    expect(SCENARIOS.map((s) => s.title)).toEqual([
      'Where a first visit is served from',
      'Three components, one read',
      'Old data now, fresh data next',
      'What a tag update cannot reach',
    ]);
  });

  it('use a different setting in every case', () => {
    const settings = SCENARIOS.map((s) => s.routes[0]?.path);
    expect(new Set(settings).size).toBe(SCENARIOS.length);
  });

  it('runs every scenario and variant without leaving a step unanswered', () => {
    for (const def of SCENARIOS) {
      for (const variant of def.variants) {
        const built = buildScenario(def.id, variant.id);
        const { frames } = run(built.scenario);
        expect(frames).toHaveLength(built.scenario.timeline.length + 1);
        for (const frame of frames) expect(frame.note.length).toBeGreaterThan(10);
      }
    }
  });

  it('falls back to the first scenario and the first variant on an unknown id', () => {
    expect(scenarioDef('nope')).toBeUndefined();
    expect(buildScenario('nope', 'nope').id).toBe(DEFAULT_SCENARIO_ID);
    const def = scenarioDef('one-render-one-read') as ScenarioDef;
    expect(variantOf(def, 'nope')).toBe('memoised');
    expect(variantOf(def, undefined)).toBe('memoised');
    expect(variantOf(def, 'plain')).toBe('plain');
  });

  it('names the event behind each frame, and nothing before the first', () => {
    const built = buildScenario('first-visit', 'default');
    expect(eventAt(built.scenario, 0)).toBeUndefined();
    expect(eventAt(built.scenario, 1)).toEqual({ kind: 'build' });
  });

  it('says what the model leaves out', () => {
    expect(LEFT_OUT.length).toBeGreaterThanOrEqual(8);
    expect(LEFT_OUT.join(' ')).toContain('use cache: private');
  });
});

describe('where a first visit is served from', () => {
  it('reads the catalogue once at build and never again for two visitors', () => {
    const built = buildScenario('first-visit', 'default');
    const { frames } = run(built.scenario);
    expect(frames[1]?.memo).toEqual({ reads: 2, misses: 1 });
    expect(frames[2]?.served?.source).toBe('prerendered-page');
    expect(frames[2]?.memo).toBeNull();
    expect(frames[3]?.served?.source).toBe('prerendered-page');
    expect(frames[3]?.memo).toBeNull();
    // /loans has no cached read, so it is rendered when it is asked for.
    expect(frames[4]?.served?.source).toBe('rendered');
  });
});

describe('three components, one read', () => {
  it('collapses three asks into one when the read is memoised, and not when it is not', () => {
    const memoised = run(buildScenario('one-render-one-read', 'memoised').scenario);
    expect(memoised.frames[1]?.memo).toEqual({ reads: 3, misses: 1 });
    const plain = run(buildScenario('one-render-one-read', 'plain').scenario);
    expect(plain.frames[1]?.memo).toEqual({ reads: 3, misses: 3 });
  });

  it('throws the memo away with the request, so the next visit renders again', () => {
    const { frames } = run(buildScenario('one-render-one-read', 'memoised').scenario);
    // cacheLife('seconds') is too short to prerender, so every request renders.
    expect(frames[2]?.memo).toEqual({ reads: 3, misses: 1 });
    expect(frames[2]?.served?.source).toBe('use-cache-entry');
  });
});

describe('old data now, fresh data next', () => {
  it('serves the old forecast an hour on and refreshes behind it', () => {
    const { frames } = run(buildScenario('old-data-now', 'past-revalidate').scenario);
    const stale = frames[5];
    expect(stale?.served).toMatchObject({ value: 1, refreshed: true, waited: false });
    // The reload that follows gets what the refresh left.
    expect(frames[6]?.served?.value).toBe(2);
  });

  it('makes the request wait once a day has passed', () => {
    const { frames } = run(buildScenario('old-data-now', 'past-expire').scenario);
    expect(frames[5]?.served).toMatchObject({ value: 2, waited: true, refreshed: false });
  });
});

describe('what a tag update cannot reach', () => {
  const frames = (variant: string) =>
    run(buildScenario('what-a-tag-update-misses', variant).scenario).frames;

  it('shows Back serving the old menu from the visitor’s own tab', () => {
    const f = frames('update-by-staff');
    expect(f[2]?.served?.source).toBe('prerendered-page');
    expect(f[3]?.served?.source).toBe('rendered');
    // Staff publish v2: the entry expires and the prerender goes with it.
    expect(f[4]?.entry?.hard).toBe(true);
    expect(f[4]?.pages['/menu']?.invalidated).toBe(true);
    // The visitor's own tab still holds v1, and Back reuses it.
    expect(f[5]?.served).toMatchObject({ source: 'client-router-cache', value: 1 });
    // The next document load waits for the new menu.
    expect(f[6]?.served).toMatchObject({ source: 'use-cache-entry', value: 2, waited: true });
  });

  it('serves the old menu while a refresh runs when staff call revalidateTag', () => {
    const f = frames('revalidate-by-staff');
    expect(f[5]?.served).toMatchObject({ source: 'client-router-cache', value: 1 });
    expect(f[6]?.served).toMatchObject({ value: 1, refreshed: true, waited: false });
  });

  it('makes Back ask the server when the visitor published it themselves', () => {
    const f = frames('update-by-visitor');
    expect(f[4]?.clients.a?.cached).toEqual({});
    expect(f[5]?.served).toMatchObject({ source: 'use-cache-entry', value: 2, waited: true });
  });

  it('leaves both server stores untouched when the action only calls refresh', () => {
    const f = frames('refresh-by-staff');
    expect(f[4]?.entry?.hard).toBe(false);
    expect(f[4]?.pages['/menu']?.invalidated).toBe(false);
    // Back still shows v1, and so does the next visitor: nothing invalidated the menu.
    expect(f[5]?.served?.value).toBe(1);
    expect(f[6]?.served).toMatchObject({ source: 'prerendered-page', value: 1 });
  });
});

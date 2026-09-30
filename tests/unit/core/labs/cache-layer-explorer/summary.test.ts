import { describe, expect, it } from 'vitest';
import {
  STORE_NAME,
  STORE_WHERE,
  STORE_IDS,
  buildScenario,
  callText,
  eventText,
  lifeNote,
  run,
  stepStatus,
  storeRows,
} from '@/core/labs/cache-layer-explorer';
import { play, scenario } from './helpers';

describe('store names', () => {
  it('names and places all four stores', () => {
    for (const id of STORE_IDS) {
      expect(STORE_NAME[id].length).toBeGreaterThan(3);
      expect(STORE_WHERE[id].length).toBeGreaterThan(10);
    }
  });
});

describe('storeRows', () => {
  const s = scenario();

  it('gives one row per browser plus one for each server store', () => {
    const rows = storeRows(s, play(s, []));
    expect(rows.map((row) => row.key)).toEqual([
      'client-router-cache:a',
      'client-router-cache:staff',
      'prerendered-page',
      'use-cache-entry',
      'request-memo',
    ]);
    expect(rows.every((row) => row.state === 'empty')).toBe(true);
  });

  it('marks only the store that answered, and only the browser that asked', () => {
    const world = play(s, [
      { kind: 'build' },
      { kind: 'visit', actor: 'a', path: '/list' },
      { kind: 'navigate', actor: 'a', path: '/about' },
      { kind: 'navigate', actor: 'a', path: '/list' },
    ]);
    const rows = storeRows(s, world);
    expect(rows.filter((row) => row.answered).map((row) => row.key)).toEqual([
      'client-router-cache:a',
    ]);
  });

  it('shows what each store holds, with the entry’s age', () => {
    const world = play(s, [
      { kind: 'build' },
      { kind: 'wait', seconds: 90 },
      { kind: 'visit', actor: 'a', path: '/list' },
    ]);
    const by = (key: string) => storeRows(s, world).find((row) => row.key === key);
    expect(by('use-cache-entry')?.holds).toBe('list v1, 1m 30s old');
    expect(by('use-cache-entry')?.state).toBe('fresh');
    expect(by('prerendered-page')?.holds).toBe('/list v1');
    expect(by('client-router-cache:a')?.holds).toBe('/list v1');
    expect(by('client-router-cache:staff')?.holds).toBe('empty');
    expect(by('request-memo')?.holds).toContain('thrown away');
  });

  it('says when the lifetime is too short to prerender', () => {
    const short = scenario({
      cache: { label: 'list', life: 'seconds', tag: 'list', reads: 3, memoised: true },
    });
    const world = play(short, [{ kind: 'build' }]);
    const row = storeRows(short, world).find((r) => r.key === 'prerendered-page');
    expect(row?.holds).toBe('not prerendered: the lifetime is too short');
    expect(row?.state).toBe('empty');
  });

  it('says where each store lives once, not once per browser', () => {
    const rows = storeRows(s, play(s, []));
    expect(rows.filter((row) => row.showWhere).map((row) => row.key)).toEqual([
      'client-router-cache:a',
      'prerendered-page',
      'use-cache-entry',
      'request-memo',
    ]);
  });

  it('says why the entry expired when a tag call did it, not how old it is', () => {
    const updated = play(s, [
      { kind: 'build' },
      { kind: 'wait', seconds: 90 },
      { kind: 'action', actor: 'staff', call: { fn: 'updateTag', tag: 'list' } },
    ]);
    expect(storeRows(s, updated).find((r) => r.key === 'use-cache-entry')?.holds).toBe(
      'list v1, expired by a tag update',
    );

    const revalidated = play(s, [
      { kind: 'build' },
      { kind: 'action', actor: 'staff', call: { fn: 'revalidateTag', tag: 'list', window: 'max' } },
    ]);
    expect(storeRows(s, revalidated).find((r) => r.key === 'use-cache-entry')?.holds).toBe(
      'list v1, stale since a tag call',
    );
  });

  it('marks the prerender as invalidated after a tag call', () => {
    const world = play(s, [
      { kind: 'build' },
      { kind: 'action', actor: 'staff', call: { fn: 'updateTag', tag: 'list' } },
    ]);
    const rows = storeRows(s, world);
    expect(rows.find((r) => r.key === 'prerendered-page')?.state).toBe('invalidated');
    expect(rows.find((r) => r.key === 'use-cache-entry')?.state).toBe('expired');
  });

  it('counts the reads that went past the memo during a render', () => {
    const world = play(s, [{ kind: 'build' }]);
    expect(storeRows(s, world).find((r) => r.key === 'request-memo')?.holds).toBe(
      '1 of 2 reads went past it',
    );
  });
});

describe('callText', () => {
  it('writes each call the way it appears in code', () => {
    expect(callText({ fn: 'refresh' })).toBe('refresh()');
    expect(callText({ fn: 'updateTag', tag: 'menu' })).toBe("updateTag('menu')");
    expect(callText({ fn: 'revalidateTag', tag: 'menu', window: 'max' })).toBe(
      "revalidateTag('menu', 'max')",
    );
    expect(callText({ fn: 'revalidateTag', tag: 'menu', window: 60 })).toBe(
      "revalidateTag('menu', { expire: 60 })",
    );
  });
});

describe('eventText', () => {
  const s = scenario();

  it('writes one short line per event', () => {
    expect(eventText(s, { kind: 'build' })).toBe('next build');
    expect(eventText(s, { kind: 'publish' })).toBe('The list changes at the source');
    expect(eventText(s, { kind: 'wait', seconds: 3600 })).toBe('1h passes');
    expect(eventText(s, { kind: 'visit', actor: 'a', path: '/list' })).toBe(
      'Visitor A opens /list',
    );
    expect(eventText(s, { kind: 'navigate', actor: 'a', path: '/about' })).toBe(
      'Visitor A follows a link to /about',
    );
    expect(eventText(s, { kind: 'back', actor: 'a' })).toBe('Visitor A presses Back');
    expect(eventText(s, { kind: 'reload', actor: 'a' })).toBe('Visitor A reloads the page');
    expect(eventText(s, { kind: 'action', actor: 'staff', call: { fn: 'refresh' } })).toBe(
      'Staff save, then refresh()',
    );
  });

  it('falls back to the id of an actor a scenario does not list', () => {
    expect(eventText(s, { kind: 'back', actor: 'ghost' })).toBe('ghost presses Back');
  });
});

describe('stepStatus', () => {
  const s = scenario();

  it('is the note alone when nothing was served', () => {
    expect(stepStatus(play(s, [{ kind: 'build' }]))).toContain('prerendered');
    expect(stepStatus(play(s, [{ kind: 'build' }]))).not.toContain('Answered');
  });

  it('names the store that answered and what it cost', () => {
    const fresh = play(s, [{ kind: 'build' }, { kind: 'visit', actor: 'a', path: '/list' }]);
    expect(stepStatus(fresh)).toContain('Answered from the prerendered page, v1.');

    const waited = play(s, [{ kind: 'visit', actor: 'a', path: '/list' }]);
    expect(stepStatus(waited)).toContain('The request waited.');

    const refreshed = play(s, [
      { kind: 'build' },
      { kind: 'publish' },
      { kind: 'wait', seconds: 3600 },
      { kind: 'visit', actor: 'a', path: '/list' },
    ]);
    expect(stepStatus(refreshed)).toContain('A refresh ran behind it.');
  });

  it('says a request-time render was not a store', () => {
    const rendered = play(s, [{ kind: 'build' }, { kind: 'visit', actor: 'a', path: '/about' }]);
    expect(stepStatus(rendered)).toContain('Answered rendered at request time, v1.');
  });
});

describe('lifeNote', () => {
  it('reads the three numbers of the profile out in words', () => {
    expect(lifeNote(scenario())).toBe(
      "cacheLife('hours') on the list: a tab may reuse it for 5m, the server refreshes after 1h, and it expires after 1d. It is long enough to prerender.",
    );
  });

  it('says when a profile never expires, and when it is too short to prerender', () => {
    const forever = scenario({
      cache: { label: 'list', life: 'default', tag: null, reads: 1, memoised: true },
    });
    expect(lifeNote(forever)).toContain('never expires');
    const short = scenario({
      cache: { label: 'list', life: 'seconds', tag: null, reads: 1, memoised: true },
    });
    expect(lifeNote(short)).toContain('too short to prerender');
  });
});

describe('every shipped scenario', () => {
  it('has a status line on every frame', () => {
    for (const def of ['first-visit', 'one-render-one-read', 'old-data-now'] as const) {
      const built = buildScenario(def, 'default');
      for (const frame of run(built.scenario).frames) {
        expect(stepStatus(frame).length).toBeGreaterThan(10);
      }
    }
  });
});

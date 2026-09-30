import { actorOf } from './engine';
import { duration, entryState, lifeOf, prerenderable } from './life';
import type { Call, Event, Scenario, StoreId, World } from './types';

/*
 * Every word the view shows. Kept here so the wording is tested with the rules it
 * describes, and so the view holds layout only.
 */

export const STORE_NAME: Readonly<Record<StoreId, string>> = {
  'client-router-cache': 'Router cache',
  'prerendered-page': 'Prerendered page',
  'use-cache-entry': 'use cache entry',
  'request-memo': 'Request memo',
};

/** Where each store lives, short enough to sit under its name at 390 px. */
export const STORE_WHERE: Readonly<Record<StoreId, string>> = {
  'client-router-cache': "in the visitor's tab",
  'prerendered-page': 'on disk or a CDN',
  'use-cache-entry': "the server's store",
  'request-memo': 'one render only',
};

export interface StoreRow {
  /** Unique per row: the router cache has one row per browser. */
  readonly key: string;
  readonly store: StoreId;
  readonly name: string;
  /** What is in it now, in a few words. */
  readonly holds: string;
  readonly state: 'empty' | 'fresh' | 'stale' | 'expired' | 'invalidated' | 'held';
  /** True when this row answered the step just taken. */
  readonly answered: boolean;
  /** False on the second and later rows of one store, so the place is said once. */
  readonly showWhere: boolean;
}

function versionList(entries: readonly [string, number][]): string {
  return entries.map(([path, value]) => `${path} v${value}`).join(', ');
}

/** The four stores as rows, nearest the learner first, with the router cache per browser. */
export function storeRows(scenario: Scenario, world: World): StoreRow[] {
  const { label, life } = scenario.cache;
  const answered = world.served?.source;
  const rows: StoreRow[] = [];

  for (const actor of scenario.actors) {
    const client = world.clients[actor.id];
    const held = Object.entries(client?.cached ?? {}).map(
      ([path, held2]) => [path, held2.value] as [string, number],
    );
    rows.push({
      key: `client-router-cache:${actor.id}`,
      store: 'client-router-cache',
      name: `${STORE_NAME['client-router-cache']}, ${actor.label}`,
      holds: held.length === 0 ? 'empty' : versionList(held),
      state: held.length === 0 ? 'empty' : 'held',
      // Only the browser that made the request answered it.
      answered: answered === 'client-router-cache' && world.served?.actor === actor.id,
      showWhere: rows.length === 0,
    });
  }

  const pages = Object.entries(world.pages);
  const invalidated = pages.some(([, page]) => page.invalidated);
  rows.push({
    key: 'prerendered-page',
    store: 'prerendered-page',
    name: STORE_NAME['prerendered-page'],
    holds:
      pages.length === 0
        ? prerenderable(life)
          ? 'empty'
          : 'not prerendered: the lifetime is too short'
        : versionList(pages.map(([path, page]) => [path, page.value] as [string, number])),
    state: pages.length === 0 ? 'empty' : invalidated ? 'invalidated' : 'fresh',
    answered: answered === 'prerendered-page',
    showWhere: true,
  });

  const state = entryState(world.entry, life, world.now);
  rows.push({
    key: 'use-cache-entry',
    store: 'use-cache-entry',
    name: STORE_NAME['use-cache-entry'],
    holds: entryHolds(world, label),
    state,
    answered: answered === 'use-cache-entry',
    showWhere: true,
  });

  rows.push({
    key: 'request-memo',
    store: 'request-memo',
    name: STORE_NAME['request-memo'],
    holds:
      world.memo === null
        ? 'empty: thrown away with the request'
        : `${world.memo.misses} of ${world.memo.reads} reads went past it`,
    state: world.memo === null ? 'empty' : 'held',
    answered: false,
    showWhere: true,
  });

  return rows;
}

/**
 * What the entry holds, and why it is in the state it is in. An age alone misleads after
 * a tag call: "0s old" next to "expired" reads as though time did it.
 */
function entryHolds(world: World, label: string): string {
  const entry = world.entry;
  if (entry === null) return 'empty';
  const held = `${label} v${entry.value}`;
  if (entry.hard) return `${held}, expired by a tag update`;
  if (entry.staleUntil !== null) return `${held}, stale since a tag call`;
  return `${held}, ${duration(world.now - entry.filledAt)} old`;
}

export function callText(call: Call): string {
  if (call.fn === 'refresh') return 'refresh()';
  if (call.fn === 'updateTag') return `updateTag('${call.tag}')`;
  const window = call.window === 'max' ? "'max'" : `{ expire: ${call.window} }`;
  return `revalidateTag('${call.tag}', ${window})`;
}

/** One line per event in the timeline. */
export function eventText(scenario: Scenario, event: Event): string {
  const who = (id: string) => actorOf(scenario, id)?.label ?? id;
  switch (event.kind) {
    case 'build':
      return 'next build';
    case 'publish':
      return `The ${scenario.cache.label} changes at the source`;
    case 'wait':
      return `${duration(event.seconds)} passes`;
    case 'visit':
      return `${who(event.actor)} opens ${event.path}`;
    case 'navigate':
      return `${who(event.actor)} follows a link to ${event.path}`;
    case 'back':
      return `${who(event.actor)} presses Back`;
    case 'reload':
      return `${who(event.actor)} reloads the page`;
    case 'action':
      return `${who(event.actor)} save, then ${callText(event.call)}`;
  }
}

/** The status line: what the step just taken did, in words, for a screen reader. */
export function stepStatus(world: World): string {
  const served = world.served;
  if (served === null) return world.note;
  const from =
    served.source === 'rendered'
      ? 'rendered at request time'
      : `from the ${STORE_NAME[served.source].toLowerCase()}`;
  const cost = served.waited
    ? ' The request waited.'
    : served.refreshed
      ? ' A refresh ran behind it.'
      : '';
  return `${world.note} Answered ${from}, v${served.value}.${cost}`;
}

/** The lifetime in words, shown next to the picker. */
export function lifeNote(scenario: Scenario): string {
  const { life, label } = scenario.cache;
  const { stale, revalidate, expire } = lifeOf(life);
  const expires = expire === null ? 'never expires' : `expires after ${duration(expire)}`;
  const shell = prerenderable(life)
    ? 'It is long enough to prerender.'
    : 'It is too short to prerender, so the route resolves it per request.';
  return `cacheLife('${life}') on the ${label}: a tab may reuse it for ${duration(stale)}, the server refreshes after ${duration(revalidate)}, and it ${expires}. ${shell}`;
}

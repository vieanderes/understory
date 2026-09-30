import { clientStale, entryState, lifeOf, prerenderable } from './life';
import type {
  ActorId,
  Client,
  Entry,
  Event,
  Memo,
  Page,
  ProfileName,
  Route,
  Scenario,
  AnswerSource,
  Served,
  World,
} from './types';

/*
 * One step of the model. Every rule below names the Next.js 16 document it comes from,
 * under node_modules/next/dist/docs/01-app/. Where the model simplifies, `LEFT_OUT` in
 * run.ts says so and the view shows that list.
 */

const YEAR = 31536000;

export function routeOf(scenario: Scenario, path: string): Route | undefined {
  return scenario.routes.find((route) => route.path === path);
}

export function actorOf(scenario: Scenario, id: ActorId) {
  return scenario.actors.find((actor) => actor.id === id);
}

function emptyClient(): Client {
  return { history: [], cursor: -1, cached: {} };
}

export function initialWorld(scenario: Scenario): World {
  const clients: Record<ActorId, Client> = {};
  for (const actor of scenario.actors) clients[actor.id] = emptyClient();
  return {
    now: 0,
    source: 1,
    entry: null,
    pages: {},
    clients,
    memo: null,
    served: null,
    note: 'Nothing has happened yet. The app has not been built.',
  };
}

/** What one render memoises: one read past the memo when memoised, all of them when not. */
function renderMemo(scenario: Scenario): Memo {
  const { reads, memoised } = scenario.cache;
  return { reads, misses: memoised ? 1 : reads };
}

function withClient(world: World, actor: ActorId, client: Client): Record<ActorId, Client> {
  return { ...world.clients, [actor]: client };
}

/** A document load starts a new router cache: the old one is cleared (glossary, Client Cache). */
function loadDocument(client: Client, path: string): Client {
  const history = [...client.history.slice(0, client.cursor + 1), path];
  return { history, cursor: history.length - 1, cached: {} };
}

function pushHistory(client: Client, path: string): Client {
  const history = [...client.history.slice(0, client.cursor + 1), path];
  return { ...client, history, cursor: history.length - 1 };
}

function remember(client: Client, path: string, value: number, at: number): Client {
  return { ...client, cached: { ...client.cached, [path]: { value, storedAt: at } } };
}

interface ServerAnswer {
  readonly served: Served;
  readonly entry: Entry | null;
  readonly pages: Record<string, Page>;
  readonly memo: Memo | null;
  readonly note: string;
}

/**
 * What the server sends for one request, and what it leaves in its own stores.
 *
 * The order is the one in 08-caching.md, "Where cached content is stored": prerendered
 * HTML answers first when it exists, otherwise the shared `use cache` store, and a
 * request that finds nothing usable renders and fills both.
 */
function serverAnswer(
  scenario: Scenario,
  world: World,
  path: string,
  actor: ActorId,
): ServerAnswer {
  const route = routeOf(scenario, path);
  const { label, life } = scenario.cache;
  const pages = { ...world.pages };
  const page = pages[path];

  // A route with no cached read is rendered at request time, every time.
  if (route !== undefined && !route.usesCache) {
    return {
      served: { source: 'rendered', actor, value: world.source, waited: true, refreshed: false },
      entry: world.entry,
      pages,
      memo: renderMemo(scenario),
      note: `${path} has no cached read, so it was rendered now.`,
    };
  }

  const state = entryState(world.entry, life, world.now);
  const shell = prerenderable(life) && page !== undefined && !page.invalidated;
  const from: AnswerSource = shell ? 'prerendered-page' : 'use-cache-entry';

  if (state === 'fresh' && world.entry !== null) {
    return {
      served: { source: from, actor, value: world.entry.value, waited: false, refreshed: false },
      entry: world.entry,
      pages,
      // The prerendered HTML needs no render at all. Without it the route renders, and
      // the memo collapses the components asking before the entry is reached once.
      memo: shell ? null : renderMemo(scenario),
      note: shell
        ? `Answered from the prerendered ${path}. No render, no read.`
        : `Answered from the ${label} entry in the shared store, with no read of its own.`,
    };
  }

  if (state === 'stale' && world.entry !== null) {
    // stale-while-revalidate: the old value goes out now and a refresh runs behind it
    // (cacheLife.md, `revalidate`). The refresh lands before the next event.
    const filled: Entry = {
      value: world.source,
      filledAt: world.now,
      staleUntil: null,
      hard: false,
    };
    pages[path] = { value: world.source, builtAt: world.now, invalidated: false };
    return {
      served: { source: from, actor, value: world.entry.value, waited: false, refreshed: true },
      entry: filled,
      pages,
      memo: renderMemo(scenario),
      note: `Served the old ${label}, v${world.entry.value}, and refreshed behind it to v${world.source}.`,
    };
  }

  // Empty or expired: the request waits for fresh data (updateTag.md, "Good to know").
  const filled: Entry = { value: world.source, filledAt: world.now, staleUntil: null, hard: false };
  if (prerenderable(life)) {
    pages[path] = { value: world.source, builtAt: world.now, invalidated: false };
  }
  return {
    served: {
      source: 'use-cache-entry',
      actor,
      value: world.source,
      waited: true,
      refreshed: false,
    },
    entry: filled,
    pages,
    memo: renderMemo(scenario),
    note:
      state === 'empty'
        ? `Nothing was stored, so the request waited for the ${label} and filled the entry.`
        : `The ${label} entry had expired, so the request waited for fresh data, v${world.source}.`,
  };
}

/** A client transition or a Back that the router cache can answer. */
function clientHit(
  world: World,
  actor: ActorId,
  path: string,
  ignoreStale: boolean,
  life: ProfileName,
) {
  const held = world.clients[actor]?.cached[path];
  if (held === undefined) return null;
  if (ignoreStale) return held;
  return world.now - held.storedAt < clientStale(life) ? held : null;
}

export function step(scenario: Scenario, world: World, event: Event): World {
  const { label, life, tag } = scenario.cache;
  const base = { ...world, memo: null, served: null };

  switch (event.kind) {
    case 'build': {
      const entry: Entry = {
        value: world.source,
        filledAt: world.now,
        staleUntil: null,
        hard: false,
      };
      const pages: Record<string, Page> = {};
      for (const route of scenario.routes) {
        if (!route.usesCache) continue;
        if (!prerenderable(life)) continue;
        pages[route.path] = { value: world.source, builtAt: world.now, invalidated: false };
      }
      const prerendered = Object.keys(pages);
      return {
        ...base,
        entry,
        pages,
        memo: renderMemo(scenario),
        note: prerendered.length
          ? `Built. The ${label} was read once and ${prerendered.join(' and ')} prerendered from it.`
          : `Built. The ${label} lifetime is too short to prerender, so it is a hole filled per request.`,
      };
    }

    case 'publish':
      return {
        ...base,
        source: world.source + 1,
        note: `The ${label} changed at the source, now v${world.source + 1}. No cache was told.`,
      };

    case 'wait':
      return {
        ...base,
        now: world.now + event.seconds,
        note: waitNote(scenario, world, event.seconds),
      };

    case 'visit': {
      const answer = serverAnswer(scenario, world, event.path, event.actor);
      const loaded = loadDocument(world.clients[event.actor] ?? emptyClient(), event.path);
      const client = remember(loaded, event.path, answer.served.value, world.now);
      return {
        ...base,
        entry: answer.entry,
        pages: answer.pages,
        memo: answer.memo,
        served: answer.served,
        clients: withClient(world, event.actor, client),
        note: `${actorLabel(scenario, event.actor)} opened ${event.path}. ${answer.note}`,
      };
    }

    case 'reload': {
      const current = currentPath(world, event.actor);
      if (current === null)
        return { ...base, note: 'Nothing to reload: this browser has no page open.' };
      const answer = serverAnswer(scenario, world, current, event.actor);
      const cleared: Client = { ...(world.clients[event.actor] as Client), cached: {} };
      const client = remember(cleared, current, answer.served.value, world.now);
      return {
        ...base,
        entry: answer.entry,
        pages: answer.pages,
        memo: answer.memo,
        served: answer.served,
        clients: withClient(world, event.actor, client),
        note: `${actorLabel(scenario, event.actor)} reloaded ${current}, which empties the router cache. ${answer.note}`,
      };
    }

    case 'navigate': {
      const held = clientHit(world, event.actor, event.path, false, life);
      const client0 = world.clients[event.actor] ?? emptyClient();
      if (held !== null) {
        const client = pushHistory(client0, event.path);
        return {
          ...base,
          clients: withClient(world, event.actor, client),
          served: {
            source: 'client-router-cache',
            actor: event.actor,
            value: held.value,
            waited: false,
            refreshed: false,
          },
          note: `${actorLabel(scenario, event.actor)} moved to ${event.path}. Their own tab answered, with no request.`,
        };
      }
      const answer = serverAnswer(scenario, world, event.path, event.actor);
      const client = remember(
        pushHistory(client0, event.path),
        event.path,
        answer.served.value,
        world.now,
      );
      return {
        ...base,
        entry: answer.entry,
        pages: answer.pages,
        memo: answer.memo,
        served: answer.served,
        clients: withClient(world, event.actor, client),
        note: `${actorLabel(scenario, event.actor)} moved to ${event.path}. ${answer.note}`,
      };
    }

    case 'back': {
      const client0 = world.clients[event.actor] ?? emptyClient();
      if (client0.cursor <= 0) return { ...base, note: 'Back has nowhere to go in this browser.' };
      const path = client0.history[client0.cursor - 1] as string;
      // Back and forward reuse the stored page whatever the stale time says, to keep the
      // scroll position and avoid layout shift (staleTimes.md, "Good to know").
      const held = clientHit(world, event.actor, path, true, life);
      if (held !== null) {
        return {
          ...base,
          clients: withClient(world, event.actor, { ...client0, cursor: client0.cursor - 1 }),
          served: {
            source: 'client-router-cache',
            actor: event.actor,
            value: held.value,
            waited: false,
            refreshed: false,
          },
          note: `${actorLabel(scenario, event.actor)} pressed Back to ${path}. Their tab still held the page, so nothing was asked of the server.`,
        };
      }
      const answer = serverAnswer(scenario, world, path, event.actor);
      const moved: Client = { ...client0, cursor: client0.cursor - 1 };
      return {
        ...base,
        entry: answer.entry,
        pages: answer.pages,
        memo: answer.memo,
        served: answer.served,
        clients: withClient(
          world,
          event.actor,
          remember(moved, path, answer.served.value, world.now),
        ),
        note: `${actorLabel(scenario, event.actor)} pressed Back to ${path}, and their router cache had gone. ${answer.note}`,
      };
    }

    case 'action': {
      const source = world.source + 1;
      const call = event.call;
      // Any of these called from a Server Action clears the whole client cache of the
      // browser that made the request, at once (cacheLife.md, "Client cache behavior").
      const caller: Client = { ...(world.clients[event.actor] ?? emptyClient()), cached: {} };
      const clients = withClient(world, event.actor, caller);
      const who = actorLabel(scenario, event.actor);

      if (call.fn === 'refresh') {
        return {
          ...base,
          source,
          clients,
          note: `${who} saved v${source} and called refresh(). Only their own tab was cleared: the server's stores were not touched.`,
        };
      }

      const reaches = tag !== null && tag === call.tag;
      if (!reaches) {
        return {
          ...base,
          source,
          clients,
          note:
            tag === null
              ? `${who} saved v${source}, but the cached read has no cacheTag, so '${call.tag}' reaches nothing.`
              : `${who} saved v${source}. The tag '${call.tag}' is not '${tag}', so the entry was left alone.`,
        };
      }

      const pages = invalidatePages(world.pages);
      if (call.fn === 'updateTag') {
        return {
          ...base,
          source,
          clients,
          pages,
          entry: world.entry === null ? null : { ...world.entry, hard: true, staleUntil: null },
          note: `${who} saved v${source} and called updateTag('${call.tag}'). The entry expired at once, so the next request waits for fresh data.`,
        };
      }

      const window = call.window === 'max' ? YEAR : call.window;
      return {
        ...base,
        source,
        clients,
        pages,
        entry:
          world.entry === null
            ? null
            : { ...world.entry, hard: false, staleUntil: world.now + window },
        note: `${who} saved v${source} and called revalidateTag('${call.tag}'). The entry is stale, so the next request is served the old value while a refresh runs.`,
      };
    }
  }
}

function invalidatePages(pages: Readonly<Record<string, Page>>): Record<string, Page> {
  const next: Record<string, Page> = {};
  for (const [path, page] of Object.entries(pages)) next[path] = { ...page, invalidated: true };
  return next;
}

export function currentPath(world: World, actor: ActorId): string | null {
  const client = world.clients[actor];
  if (client === undefined || client.cursor < 0) return null;
  return client.history[client.cursor] ?? null;
}

function actorLabel(scenario: Scenario, id: ActorId): string {
  return actorOf(scenario, id)?.label ?? id;
}

/** What the wait changed, if anything: the point of waiting is to cross a lifetime. */
function waitNote(scenario: Scenario, world: World, seconds: number): string {
  const { life } = scenario.cache;
  const before = entryState(world.entry, life, world.now);
  const after = entryState(world.entry, life, world.now + seconds);
  if (before === after) return `Time passed. The entry is still ${before}.`;
  const { revalidate } = lifeOf(life);
  if (after === 'stale') {
    return `Time passed the ${revalidate} second revalidate, so the entry is stale: the next request gets the old value and starts a refresh.`;
  }
  if (after === 'expired') {
    return 'Time passed the expire, so the next request has to wait for fresh data.';
  }
  return `Time passed. The entry is ${after}.`;
}

/*
 * The four stores a Next.js 16 answer can come from, and the events that move between
 * them. Names and behaviour follow the Cache Components model in
 * node_modules/next/dist/docs/01-app/01-getting-started/08-caching.md, section "Where
 * cached content is stored", and the Client Cache entry in 01-app/04-glossary.md.
 */

/** A store, in the order an answer is looked for: nearest the learner first. */
export type StoreId =
  'client-router-cache' | 'prerendered-page' | 'use-cache-entry' | 'request-memo';

export const STORE_IDS = [
  'client-router-cache',
  'prerendered-page',
  'use-cache-entry',
  'request-memo',
] as const satisfies readonly StoreId[];

/** A named cache profile. The numbers are in `PROFILES`. */
export type ProfileName = 'default' | 'seconds' | 'minutes' | 'hours' | 'days' | 'weeks' | 'max';

export const PROFILE_NAMES = [
  'seconds',
  'minutes',
  'hours',
  'days',
  'weeks',
  'default',
  'max',
] as const satisfies readonly ProfileName[];

/** `expire: null` is the `default` profile's "never". */
export interface Life {
  readonly stale: number;
  readonly revalidate: number;
  readonly expire: number | null;
}

/** Simulated seconds since the build. No wall clock anywhere in the engine. */
export type Tick = number;

/** Whoever holds a browser. A scenario names them, so "staff" and "a visitor" read plainly. */
export type ActorId = string;

export interface Actor {
  readonly id: ActorId;
  /** Shown in the timeline and the store table: "Visitor A", "Staff". */
  readonly label: string;
}

/** A route in the scenario's app. `usesCache` is false for a page with no cached read. */
export interface Route {
  readonly path: string;
  readonly usesCache: boolean;
}

/** What one revalidation call does, per 03-api-reference/04-functions. */
export type Call =
  | { readonly fn: 'updateTag'; readonly tag: string }
  | { readonly fn: 'revalidateTag'; readonly tag: string; readonly window: 'max' | number }
  | { readonly fn: 'refresh' };

export type Event =
  /** `next build`: the cached read runs once and the routes are prerendered. */
  | { readonly kind: 'build' }
  /** The source of truth changes. No cache hears about it. */
  | { readonly kind: 'publish' }
  /** Time passes, so a lifetime can run out. */
  | { readonly kind: 'wait'; readonly seconds: number }
  /** A document load: typing the URL, or following a link from outside the app. */
  | { readonly kind: 'visit'; readonly actor: ActorId; readonly path: string }
  /** A client transition through `<Link>`, inside the app. */
  | { readonly kind: 'navigate'; readonly actor: ActorId; readonly path: string }
  /** The browser's Back button. */
  | { readonly kind: 'back'; readonly actor: ActorId }
  /** A hard reload of the current page. */
  | { readonly kind: 'reload'; readonly actor: ActorId }
  /** A Server Action, run from one actor's browser. */
  | { readonly kind: 'action'; readonly actor: ActorId; readonly call: Call };

/** The `use cache` entry in the shared server store. */
export interface Entry {
  /** Which version of the source data this entry holds. */
  readonly value: number;
  readonly filledAt: Tick;
  /** Set by `revalidateTag`: stale content may be served until this tick. */
  readonly staleUntil: Tick | null;
  /** Set by `updateTag`: nothing stale may be served, so the next request waits. */
  readonly hard: boolean;
}

/** One prerendered route: HTML plus an RSC payload on disk or behind a CDN. */
export interface Page {
  readonly value: number;
  readonly builtAt: Tick;
  /** A tag call reaches the prerender too, because its payload holds the tagged content. */
  readonly invalidated: boolean;
}

/** One browser tab's in-memory router cache. */
export interface Client {
  /** Where this browser has been, oldest first. */
  readonly history: readonly string[];
  /** Index in `history` of the page on screen. -1 before the first load. */
  readonly cursor: number;
  /** Router cache entries by path. Cleared whole by a document load or a tag call. */
  readonly cached: Readonly<Record<string, { readonly value: number; readonly storedAt: Tick }>>;
}

/** What one server render memoised. Non-null only on the frame whose event rendered. */
export interface Memo {
  /** How many components asked for the data. */
  readonly reads: number;
  /** How many of those reached past the memo. 1 when memoised, `reads` when not. */
  readonly misses: number;
}

export type EntryState = 'empty' | 'fresh' | 'stale' | 'expired';
export type PageState = 'empty' | 'fresh' | 'invalidated';

/** Where an answer came from. `rendered` is a request-time render, which no store held. */
export type AnswerSource = StoreId | 'rendered';

/** What answered one event, and what it cost. */
export interface Served {
  readonly source: AnswerSource;
  /** Whose request this was, so only that browser's row is marked as having answered. */
  readonly actor: ActorId;
  readonly value: number;
  /** True when the entry had expired, so the request waited for fresh data. */
  readonly waited: boolean;
  /** True when a stale entry answered and a refresh ran behind it. */
  readonly refreshed: boolean;
}

export interface World {
  readonly now: Tick;
  /** The version of the source of truth. A publish bumps it. */
  readonly source: number;
  readonly entry: Entry | null;
  readonly pages: Readonly<Record<string, Page>>;
  readonly clients: Readonly<Record<ActorId, Client>>;
  readonly memo: Memo | null;
  /** What the last event did, in one sentence, and which store answered it. */
  readonly served: Served | null;
  readonly note: string;
}

export interface Scenario {
  readonly id: string;
  readonly title: string;
  /** Shown before the first step: what to predict. */
  readonly prompt: string;
  /** One sentence of setting. */
  readonly story: string;
  readonly actors: readonly Actor[];
  readonly routes: readonly Route[];
  /** The one cached read this lab follows. */
  readonly cache: {
    /** How the cached function is called in prose: "the menu". */
    readonly label: string;
    readonly life: ProfileName;
    /** `null` for a cached read with no `cacheTag`, which no tag call can reach. */
    readonly tag: string | null;
    /** How many components read it during one render. */
    readonly reads: number;
    /** False when the read is not memoised, so each component reads again. */
    readonly memoised: boolean;
  };
  readonly timeline: readonly Event[];
}

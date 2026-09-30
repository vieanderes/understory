import type { Call, Event, Scenario } from './types';

/*
 * Four cases, plain settings, running from the one everybody gets right to the one that
 * catches experienced engineers. Each says what to predict before the first step.
 */

export interface Variant {
  readonly id: string;
  readonly label: string;
}

export interface ScenarioDef extends Scenario {
  /** What the one extra control changes. Every scenario has at least the default. */
  readonly variantLabel: string;
  readonly variants: readonly Variant[];
}

const A = { id: 'a', label: 'Visitor A' };
const B = { id: 'b', label: 'Visitor B' };
const STAFF = { id: 'staff', label: 'Staff' };

const FIRST_VISIT: ScenarioDef = {
  id: 'first-visit',
  title: 'Where a first visit is served from',
  story: 'A library catalogue page, built once and opened by two people.',
  prompt: 'Before you step: two people open the same page. How many times is the catalogue read?',
  actors: [A, B],
  routes: [
    { path: '/catalogue', usesCache: true },
    { path: '/loans', usesCache: false },
  ],
  cache: { label: 'catalogue', life: 'days', tag: 'catalogue', reads: 2, memoised: true },
  timeline: [
    { kind: 'build' },
    { kind: 'visit', actor: 'a', path: '/catalogue' },
    { kind: 'visit', actor: 'b', path: '/catalogue' },
    { kind: 'navigate', actor: 'b', path: '/loans' },
  ],
  variantLabel: 'Lifetime',
  variants: [{ id: 'default', label: 'cacheLife(days)' }],
};

const ONE_RENDER: ScenarioDef = {
  id: 'one-render-one-read',
  title: 'Three components, one read',
  story: 'A to-do list where three components each ask for the same tasks.',
  prompt:
    'Before you step: one render, three components asking. How many reads reach the database?',
  actors: [A, B],
  routes: [{ path: '/tasks', usesCache: true }],
  cache: { label: 'task list', life: 'seconds', tag: null, reads: 3, memoised: true },
  timeline: [
    { kind: 'build' },
    { kind: 'visit', actor: 'a', path: '/tasks' },
    { kind: 'reload', actor: 'a' },
    { kind: 'visit', actor: 'b', path: '/tasks' },
  ],
  variantLabel: 'The read is',
  variants: [
    { id: 'memoised', label: 'wrapped in cache()' },
    { id: 'plain', label: 'called directly' },
  ],
};

const OLD_DATA_NOW: ScenarioDef = {
  id: 'old-data-now',
  title: 'Old data now, fresh data next',
  story: 'A weather dashboard on cacheLife(hours), read an hour after the forecast changed.',
  prompt:
    'Before you step: the forecast changed and an hour passed. What does the next visitor see?',
  actors: [A, B],
  routes: [{ path: '/forecast', usesCache: true }],
  cache: { label: 'forecast', life: 'hours', tag: 'forecast', reads: 1, memoised: true },
  timeline: [
    { kind: 'build' },
    { kind: 'visit', actor: 'a', path: '/forecast' },
    { kind: 'publish' },
    { kind: 'wait', seconds: 3600 },
    { kind: 'visit', actor: 'b', path: '/forecast' },
    { kind: 'reload', actor: 'b' },
  ],
  variantLabel: 'Time that passes',
  variants: [
    { id: 'past-revalidate', label: 'an hour, past revalidate' },
    { id: 'past-expire', label: 'a day, past expire' },
  ],
};

const TAG_UPDATE: ScenarioDef = {
  id: 'what-a-tag-update-misses',
  title: 'What a tag update cannot reach',
  story: 'A cafe menu. Staff publish a new one while a visitor is on another page.',
  prompt: 'Before you step: after the new menu is published, what does Back show visitor A?',
  actors: [A, B, STAFF],
  routes: [
    { path: '/menu', usesCache: true },
    { path: '/order', usesCache: false },
  ],
  cache: { label: 'menu', life: 'max', tag: 'menu', reads: 2, memoised: true },
  timeline: [
    { kind: 'build' },
    { kind: 'visit', actor: 'a', path: '/menu' },
    { kind: 'navigate', actor: 'a', path: '/order' },
    { kind: 'action', actor: 'staff', call: { fn: 'updateTag', tag: 'menu' } },
    { kind: 'back', actor: 'a' },
    { kind: 'visit', actor: 'b', path: '/menu' },
  ],
  variantLabel: 'The action',
  variants: [
    { id: 'update-by-staff', label: "staff call updateTag('menu')" },
    { id: 'revalidate-by-staff', label: "staff call revalidateTag('menu', 'max')" },
    { id: 'update-by-visitor', label: "visitor A calls updateTag('menu')" },
    { id: 'refresh-by-staff', label: 'staff call refresh()' },
  ],
};

export const SCENARIOS: readonly ScenarioDef[] = [
  FIRST_VISIT,
  ONE_RENDER,
  OLD_DATA_NOW,
  TAG_UPDATE,
];

export const SCENARIO_IDS = SCENARIOS.map((s) => s.id) as [string, ...string[]];

export const DEFAULT_SCENARIO_ID = FIRST_VISIT.id;

export function scenarioDef(id: string): ScenarioDef | undefined {
  return SCENARIOS.find((s) => s.id === id);
}

/** A variant id that is not this scenario's falls back to its first. */
export function variantOf(def: ScenarioDef, id: string | undefined): string {
  const found = def.variants.find((v) => v.id === id);
  return (found ?? (def.variants[0] as Variant)).id;
}

const CALLS: Readonly<Record<string, { actor: string; call: Call }>> = {
  'update-by-staff': { actor: 'staff', call: { fn: 'updateTag', tag: 'menu' } },
  'revalidate-by-staff': {
    actor: 'staff',
    call: { fn: 'revalidateTag', tag: 'menu', window: 'max' },
  },
  'update-by-visitor': { actor: 'a', call: { fn: 'updateTag', tag: 'menu' } },
  'refresh-by-staff': { actor: 'staff', call: { fn: 'refresh' } },
};

export interface Built {
  readonly id: string;
  readonly variant: string;
  readonly scenario: Scenario;
  readonly story: string;
  readonly prompt: string;
}

/** The scenario with its variant applied: one object for the view to draw. */
export function buildScenario(id: string, variant: string): Built {
  const def = scenarioDef(id) ?? (SCENARIOS[0] as ScenarioDef);
  const chosen = variantOf(def, variant);
  return {
    id: def.id,
    variant: chosen,
    story: def.story,
    prompt: def.prompt,
    scenario: applyVariant(def, chosen),
  };
}

function applyVariant(def: ScenarioDef, variant: string): Scenario {
  if (def.id === ONE_RENDER.id) {
    return { ...def, cache: { ...def.cache, memoised: variant === 'memoised' } };
  }
  if (def.id === OLD_DATA_NOW.id) {
    const seconds = variant === 'past-expire' ? 86400 : 3600;
    return {
      ...def,
      timeline: def.timeline.map((e) => (e.kind === 'wait' ? { ...e, seconds } : e)),
    };
  }
  if (def.id === TAG_UPDATE.id) {
    const chosen = CALLS[variant];
    if (chosen === undefined) return def;
    const timeline: Event[] = def.timeline.map((event) =>
      event.kind === 'action' ? { kind: 'action', actor: chosen.actor, call: chosen.call } : event,
    );
    return { ...def, timeline };
  }
  return def;
}

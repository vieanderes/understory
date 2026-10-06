import * as z from '@/core/zod';
import {
  DEFAULT_SCENARIO_ID,
  PROFILE_NAMES,
  SCENARIO_IDS,
  STORE_IDS,
  scenarioDef,
  variantOf,
  type Actor,
  type Call,
  type Event,
  type ProfileName,
  type Route,
  type ScenarioDef,
  type StoreId,
} from '@/core/labs/cache-layer-explorer';

/** The lesson's own case, added to the list and selected when a lesson supplies one. */
export const LESSON_SCENARIO_ID = 'from-the-lesson';

export interface Preset {
  scenario: string;
  variant: string;
  /** A case built from the lesson's timeline, or null when the lesson gave none. */
  custom: ScenarioDef | null;
  /** The store rows a lesson asked for. Empty means every row. */
  stores: readonly StoreId[];
}

const eventSchema = z.object({
  event: z.enum(['build', 'publish', 'wait', 'visit', 'navigate', 'back', 'reload', 'action']),
  actor: z.string().min(1).max(20).optional(),
  path: z.string().startsWith('/').max(60).optional(),
  seconds: z.number().int().positive().max(31536000).optional(),
  call: z.string().min(1).max(60).optional(),
});

/**
 * What a lesson may set. A lesson names the cached route, its lifetime and tag, and a
 * timeline of what people do, so a lab step can put the learner in one exact moment.
 */
const presetSchema = z.object({
  scenario: z.enum(SCENARIO_IDS).optional(),
  variant: z.string().optional(),
  route: z.string().startsWith('/').max(60).optional(),
  cacheLife: z.enum(PROFILE_NAMES).optional(),
  cacheTag: z.string().min(1).max(256).nullable().optional(),
  reads: z.number().int().min(1).max(9).optional(),
  stores: z.array(z.enum(STORE_IDS)).optional(),
  timeline: z.array(eventSchema).min(1).optional(),
});

/** `updateTag('menu')`, `revalidateTag('menu', 'max')` or `refresh()`, as a lesson writes it. */
export function parseCall(text: string): Call | null {
  const refresh = /^refresh\(\s*\)$/.exec(text);
  if (refresh) return { fn: 'refresh' };
  const update = /^updateTag\(\s*'([^']{1,256})'\s*\)$/.exec(text);
  if (update) return { fn: 'updateTag', tag: update[1] as string };
  const revalidate = /^revalidateTag\(\s*'([^']{1,256})'\s*(?:,\s*'(max)'\s*)?\)$/.exec(text);
  if (revalidate) return { fn: 'revalidateTag', tag: revalidate[1] as string, window: 'max' };
  return null;
}

/** "A" becomes Visitor A, "staff" becomes Staff. */
function label(id: string): string {
  if (/^[A-Za-z]$/.test(id)) return `Visitor ${id.toUpperCase()}`;
  return id.charAt(0).toUpperCase() + id.slice(1);
}

type RawEvent = z.infer<typeof eventSchema>;

/** An event a lesson wrote, or null if it is missing what its kind needs. */
function toEvent(raw: RawEvent): Event | null {
  const actor = raw.actor?.toLowerCase();
  switch (raw.event) {
    case 'build':
      return { kind: 'build' };
    case 'publish':
      return { kind: 'publish' };
    case 'wait':
      return raw.seconds === undefined ? null : { kind: 'wait', seconds: raw.seconds };
    case 'visit':
    case 'navigate':
      if (actor === undefined || raw.path === undefined) return null;
      return { kind: raw.event, actor, path: raw.path };
    case 'back':
    case 'reload':
      return actor === undefined ? null : { kind: raw.event, actor };
    case 'action': {
      // A lesson that names no actor means a third party: someone else's browser, which
      // is what makes the router cache of the visitor on screen survive the call.
      const call = raw.call === undefined ? null : parseCall(raw.call);
      return call === null ? null : { kind: 'action', actor: actor ?? 'staff', call };
    }
  }
}

function buildLessonScenario(
  route: string,
  life: ProfileName,
  tag: string | null,
  reads: number,
  events: readonly Event[],
): ScenarioDef | null {
  if (events.length === 0) return null;
  const ids = new Set<string>();
  const paths = new Set<string>([route]);
  for (const event of events) {
    if ('actor' in event) ids.add(event.actor);
    if ('path' in event) paths.add(event.path);
  }
  const actors: Actor[] = [...ids].map((id) => ({ id, label: label(id) }));
  const routes: Route[] = [...paths].map((path) => ({ path, usesCache: path === route }));
  return {
    id: LESSON_SCENARIO_ID,
    title: 'The case in this lesson',
    story: `${route} is cached with cacheLife('${life}')${tag === null ? '' : ` and cacheTag('${tag}')`}.`,
    prompt: 'Before each step: say which store answers.',
    actors: actors.length > 0 ? actors : [{ id: 'a', label: 'Visitor A' }],
    routes,
    cache: { label: route.replace(/^\//, ''), life, tag, reads, memoised: true },
    timeline: events,
    variantLabel: 'The case',
    variants: [{ id: 'default', label: 'as the lesson sets it' }],
  };
}

/** A typo in a lesson gives the default case whole, never half of one. */
export function parsePreset(preset: Record<string, unknown> | undefined): Preset {
  const parsed = presetSchema.safeParse(preset ?? {});
  const data = parsed.success ? parsed.data : {};

  const events = (data.timeline ?? []).map(toEvent);
  const custom =
    data.route === undefined || events.some((event) => event === null)
      ? null
      : buildLessonScenario(
          data.route,
          data.cacheLife ?? 'default',
          data.cacheTag ?? null,
          data.reads ?? 2,
          events as Event[],
        );

  const chosen = custom !== null ? LESSON_SCENARIO_ID : (data.scenario ?? DEFAULT_SCENARIO_ID);
  const def = custom ?? scenarioDef(chosen) ?? (scenarioDef(DEFAULT_SCENARIO_ID) as ScenarioDef);
  return {
    scenario: def.id,
    variant: variantOf(def, data.variant),
    custom,
    stores: data.stores ?? [],
  };
}

import { initialWorld, step } from './engine';
import type { Event, Scenario, World } from './types';

/** What this model leaves out, on purpose. The view lists these under "What this leaves out". */
export const LEFT_OUT: readonly string[] = [
  'More than one cached read. A real route has many, nested, each with its own lifetime and tags.',
  '`use cache: private` and `use cache: remote`, and the session-specific App Shell that reading cookies or headers produces.',
  'Prefetching. A link in view prefetches the App Shell, so the router cache often holds a page before the click.',
  'The line between a prerender and the App Shell. Content with a stale under five minutes is prerendered but left out of the shell.',
  '`revalidatePath`, `unstable_cache`, fetch tags, and cookies.set clearing the router cache.',
  'Bots. A crawler is served a full dynamic render at request time, not the static shell.',
  'A CDN in front of the prerendered HTML, and a new deploy, which starts every store empty because the build id is part of the cache key.',
  'Timing. A background refresh here lands before the next step; a real one takes as long as the work does.',
  'The uncached page segment. Here a route either uses the cached read or is rendered per request.',
];

export interface Run {
  /** `frames[0]` is the state before anything ran; `frames[i]` follows `timeline[i - 1]`. */
  readonly frames: readonly World[];
}

/**
 * Runs the whole timeline up front, so the view is a pure function of `frames[index]`
 * and stepping back costs nothing.
 */
export function run(scenario: Scenario): Run {
  let world = initialWorld(scenario);
  const frames: World[] = [world];
  for (const event of scenario.timeline) {
    world = step(scenario, world, event);
    frames.push(world);
  }
  return { frames };
}

/** The event that produced `frames[index]`, or undefined for the first frame. */
export function eventAt(scenario: Scenario, index: number): Event | undefined {
  return index <= 0 ? undefined : scenario.timeline[index - 1];
}

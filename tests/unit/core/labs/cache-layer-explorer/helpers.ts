import {
  initialWorld,
  step,
  type Event,
  type Scenario,
  type World,
} from '@/core/labs/cache-layer-explorer';

/** A two-route, two-browser app to test one rule at a time. */
export function scenario(over: Partial<Scenario> = {}): Scenario {
  return {
    id: 'test',
    title: 'Test',
    prompt: 'Predict.',
    story: 'A test app.',
    actors: [
      { id: 'a', label: 'Visitor A' },
      { id: 'staff', label: 'Staff' },
    ],
    routes: [
      { path: '/list', usesCache: true },
      { path: '/about', usesCache: false },
    ],
    cache: { label: 'list', life: 'hours', tag: 'list', reads: 2, memoised: true },
    timeline: [],
    ...over,
  };
}

/** Applies events in order and returns the last world. */
export function play(s: Scenario, events: readonly Event[], from?: World): World {
  return events.reduce((world, event) => step(s, world, event), from ?? initialWorld(s));
}

import { LATEST_VERSION, storyEventSchema, type EventType, type StoryEvent } from './events';

/*
 * Pure upcasters, chained per (type, v) up to the latest shape (docs/ARCHITECTURE.md
 * "Event versioning"). Stored events are never rewritten; this only affects the
 * in-memory value the reducer sees. Unknown event types, and known events whose `v`
 * is newer than this build understands, are kept as `UnknownEvent` and ignored by the
 * reducer, so an older client survives a newer one.
 */

export interface UnknownEvent {
  readonly type: 'unknown';
  readonly originalType: string;
  readonly reason: string;
  readonly raw: unknown;
}

/** One step in a type's version history: turns a v = n payload-shaped record into
 * v = n + 1. `chain[n]` is the upcaster from version n to n + 1. */
export type Upcaster = (raw: Record<string, unknown>) => Record<string, unknown>;

/**
 * Applies `chain` starting at the event's own `v` (or 0 if absent) until it reaches
 * `latestVersion`, or until the chain runs out of steps for the version reached. Pure
 * and total: never throws. Exported so the chaining behaviour itself can be unit
 * tested end to end with a synthetic type, without touching the real registry below.
 */
export function applyUpcastChain(
  raw: Record<string, unknown>,
  chain: readonly Upcaster[],
  latestVersion: number,
): Record<string, unknown> {
  let event = raw;
  let v = typeof event.v === 'number' ? event.v : 0;
  while (v < latestVersion) {
    const step = chain[v];
    if (!step) break; // no upcaster registered for this version: give up where we are
    event = step(event);
    v += 1;
  }
  return { ...event, v };
}

/** No shipped event type has changed shape yet, so every chain is empty. A future
 * breaking payload change adds an entry here, for example:
 * `step_answered: [(raw) => ({ ...raw, payload: { ...raw.payload, hintsUsed: raw.payload.hints } })]`. */
const UPCASTERS: Partial<Record<EventType, readonly Upcaster[]>> = {};

function isEventType(type: string): type is EventType {
  return Object.hasOwn(LATEST_VERSION, type);
}

/** Turns an arbitrary stored value into a validated, latest-shape `StoryEvent`, or an
 * `UnknownEvent` when the type is unrecognised, the version is newer than this build
 * knows how to read, or the (upcast) shape still fails validation. */
export function upcast(raw: unknown): StoryEvent | UnknownEvent {
  if (typeof raw !== 'object' || raw === null) {
    return { type: 'unknown', originalType: 'unknown', reason: 'not an object', raw };
  }
  const obj = raw as Record<string, unknown>;
  const type = typeof obj.type === 'string' ? obj.type : undefined;
  if (type === undefined || !isEventType(type)) {
    return { type: 'unknown', originalType: type ?? 'unknown', reason: 'unknown event type', raw };
  }
  const latest = LATEST_VERSION[type];
  const chain = UPCASTERS[type] ?? [];
  const upcasted = applyUpcastChain(obj, chain, latest);
  const parsed = storyEventSchema.safeParse(upcasted);
  if (!parsed.success) {
    const reason = parsed.error.issues[0]?.message ?? 'invalid shape';
    return { type: 'unknown', originalType: type, reason, raw };
  }
  return parsed.data;
}

export function isUnknownEvent(event: StoryEvent | UnknownEvent): event is UnknownEvent {
  return event.type === 'unknown';
}

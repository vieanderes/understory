import { z } from 'zod';
import { describe, expect, it } from 'vitest';
import { makeEvent } from '@/core/progress/events';
import { fixedClock } from '@/core/ports/clock';
import type { IdGen } from '@/core/ports/id-gen';
import { applyUpcastChain, isUnknownEvent, upcast, type Upcaster } from '@/core/progress/upcast';

function fakeIds(id: string): IdGen {
  return { next: () => id };
}

const deps = {
  clock: fixedClock('2026-09-17T10:00:00Z'),
  ids: fakeIds('018f0e60-0000-7000-8000-000000000001'),
  deviceId: 'device-1',
  nextSeq: () => 1,
  contentRev: 'rev-abc',
  localDate: '2026-09-17',
};

describe('upcast', () => {
  it('returns a valid known event unchanged', () => {
    const event = makeEvent(deps, 'lesson_completed', { lessonId: 'js.closures' });
    const result = upcast(event);
    expect(isUnknownEvent(result)).toBe(false);
    expect(result).toEqual(event);
  });

  it('keeps an unrecognised event type as UnknownEvent', () => {
    const result = upcast({ type: 'some_future_event', v: 1, payload: {} });
    expect(isUnknownEvent(result)).toBe(true);
    if (isUnknownEvent(result)) {
      expect(result.originalType).toBe('some_future_event');
      expect(result.reason).toMatch(/unknown/i);
    }
  });

  it('keeps a malformed known event as UnknownEvent with a reason', () => {
    const event = makeEvent(deps, 'lesson_completed', { lessonId: 'js.closures' });
    const malformed = { ...event, payload: { lessonId: '' } }; // idSchema requires min length content
    const result = upcast(malformed);
    expect(isUnknownEvent(result)).toBe(true);
    if (isUnknownEvent(result)) {
      expect(result.originalType).toBe('lesson_completed');
      expect(result.reason.length).toBeGreaterThan(0);
    }
  });

  it('rejects non-object input', () => {
    const result = upcast('not an event');
    expect(isUnknownEvent(result)).toBe(true);
  });

  it('rejects a known type whose version is newer than this build understands', () => {
    const event = makeEvent(deps, 'lesson_completed', { lessonId: 'js.closures' });
    const fromTheFuture = { ...event, v: 99 };
    // v is a discriminated literal (1), so a foreign v fails validation and is kept unknown.
    const result = upcast(fromTheFuture);
    expect(isUnknownEvent(result)).toBe(true);
  });
  it('reads a v1 custom path as the one path called My path', () => {
    const v2 = makeEvent(deps, 'custom_path_set', {
      pathId: 'custom',
      name: 'My path',
      lessonIds: ['js.closures'],
      origin: 'builder',
    });
    const v1 = { ...v2, v: 1, payload: { lessonIds: ['js.closures'] } };
    const result = upcast(v1);
    expect(isUnknownEvent(result)).toBe(false);
    expect(result).toEqual(v2);
  });

  it('reads a v1 placement answer, a rung of the one ladder, as a level with no area', () => {
    const facts = { itemId: 'r3-chat-loop', moduleId: 'basics', correct: false } as const;
    const v2 = makeEvent(deps, 'placement_answered', { ...facts, level: 3, confidence: 'fairly' });
    const v1 = { ...v2, v: 1, payload: { ...facts, rung: 3, confidence: 'fairly' } };
    expect(upcast(v1)).toEqual(v2);
  });

  it('reads a v1 placement as a check of every area with no area levels', () => {
    const v2 = makeEvent(deps, 'placement_completed', {
      scope: 'all',
      startedAs: 'experienced',
      levelByArea: {},
      thetaByModule: { js: 1400 },
      assumedConcepts: ['js.equality'],
      unassumedConcepts: [],
    });
    const v1 = {
      ...v2,
      v: 1,
      payload: {
        startedAs: 'experienced',
        thetaByModule: { js: 1400 },
        assumedConcepts: ['js.equality'],
      },
    };
    expect(upcast(v1)).toEqual(v2);
  });
});

describe('applyUpcastChain (proves the generic chaining mechanism with a synthetic type)', () => {
  // A fake v0 shape used only here: an early draft of a fictional event that renamed
  // `hint_count` to `hintsUsed` when it became v1. No real event has ever shipped this
  // way; this is what "prove the chain" asks for (see the deliverable brief).
  const fakeV1Schema = z.strictObject({
    type: z.literal('fake_practice_event'),
    v: z.literal(1),
    hintsUsed: z.number(),
  });

  const v0ToV1: Upcaster = (raw) => {
    const { hint_count, ...rest } = raw as { hint_count?: number };
    return { ...rest, hintsUsed: hint_count ?? 0 };
  };

  it('walks a v0 record up to v1 through one registered step', () => {
    const v0 = { type: 'fake_practice_event', v: 0, hint_count: 2 };
    const upcasted = applyUpcastChain(v0, [v0ToV1], 1);
    expect(upcasted).toEqual({ type: 'fake_practice_event', v: 1, hintsUsed: 2 });
    expect(fakeV1Schema.safeParse(upcasted).success).toBe(true);
  });

  it('treats a missing v as v0, the oldest known shape', () => {
    const noVersion = { type: 'fake_practice_event', hint_count: 5 };
    const upcasted = applyUpcastChain(noVersion, [v0ToV1], 1);
    expect(upcasted).toEqual({ type: 'fake_practice_event', v: 1, hintsUsed: 5 });
  });

  it('leaves v at the last version it could reach when the chain runs short', () => {
    const v0 = { type: 'fake_practice_event', v: 0, hint_count: 1 };
    // latestVersion says 2, but only one upcaster (0 -> 1) is registered.
    const upcasted = applyUpcastChain(v0, [v0ToV1], 2);
    expect(upcasted.v).toBe(1);
  });

  it('is a no-op when the record is already at the latest version', () => {
    const v1 = { type: 'fake_practice_event', v: 1, hintsUsed: 3 };
    const upcasted = applyUpcastChain(v1, [v0ToV1], 1);
    expect(upcasted).toEqual(v1);
  });
});

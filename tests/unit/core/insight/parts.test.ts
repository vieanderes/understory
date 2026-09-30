import { describe, expect, it } from 'vitest';
import {
  journeyProgress,
  partOfLesson,
  partProgress,
  type ConceptStateOf,
  type PartIndex,
} from '@/core/insight';
import type { MasteryState } from '@/core/mastery';
import {
  makeEvent,
  reduce,
  type EventType,
  type PayloadOf,
  type StoryEvent,
} from '@/core/progress';

const first: PartIndex = {
  id: 'firstcode',
  title: 'First code',
  summary: 'You can write small programs.',
  modules: ['basics', 'html'],
  lessons: ['basics.one', 'cs.memory', 'basics.two', 'html.one'],
  concepts: ['basics.values', 'basics.loops', 'cs.memory', 'html.tags'],
};
const second: PartIndex = {
  id: 'languages',
  title: 'JavaScript and TypeScript',
  summary: 'You can write modern JavaScript.',
  modules: ['js'],
  lessons: ['js.one', 'js.two'],
  concepts: ['js.closures', 'js.coercion'],
};
const empty: PartIndex = {
  id: 'senior',
  title: 'Senior engineer',
  summary: 'You can design systems.',
  modules: ['sysdesign'],
  lessons: [],
  concepts: [],
};

let seq = 0;
function event<T extends EventType>(type: T, payload: PayloadOf<T>): StoryEvent {
  seq += 1;
  const at = `2026-09-20T10:00:${String(seq % 60).padStart(2, '0')}Z`;
  return makeEvent(
    {
      clock: { now: () => new Date(at) },
      ids: { next: () => `01900000-0000-7000-8000-${String(seq).padStart(12, '0')}` },
      deviceId: 'device',
      nextSeq: () => seq,
      contentRev: 'rev',
      localDate: at.slice(0, 10),
    },
    type,
    payload,
  );
}

const done = (...ids: string[]) => ids.map((lessonId) => event('lesson_completed', { lessonId }));

const states =
  (entries: Record<string, MasteryState>): ConceptStateOf =>
  (id) =>
    entries[id] ?? 'unseen';

describe('partProgress', () => {
  it('counts nothing for a learner who has not started', () => {
    const progress = partProgress(first, reduce([]), states({}));
    expect(progress).toMatchObject({
      id: 'firstcode',
      lessonsDone: 0,
      lessonsTotal: 4,
      lessonShare: 0,
      conceptsSolid: 0,
      conceptsTotal: 4,
      conceptShare: 0,
      testedOut: false,
      complete: false,
      capstoneBuilt: false,
    });
  });

  it('counts completed lessons, woven ones included, as a share', () => {
    const progress = partProgress(first, reduce(done('basics.one', 'cs.memory')), states({}));
    expect(progress.lessonsDone).toBe(2);
    expect(progress.lessonShare).toBe(0.5);
    expect(progress.complete).toBe(false);
  });

  it('counts concepts that are Solid or Fluent, never Practised or a Gap', () => {
    const progress = partProgress(
      first,
      reduce([]),
      states({
        'basics.values': 'solid',
        'basics.loops': 'fluent',
        'cs.memory': 'practised',
        'html.tags': 'gap',
      }),
    );
    expect(progress.conceptsSolid).toBe(2);
    expect(progress.conceptShare).toBe(0.5);
  });

  it('is complete when every lesson is done', () => {
    const state = reduce(done('basics.one', 'cs.memory', 'basics.two', 'html.one'));
    expect(partProgress(first, state, states({})).complete).toBe(true);
  });

  it('counts every lesson as done after a passed test-out of the part', () => {
    const state = reduce([
      event('test_out_attempted', { moduleId: 'firstcode', score: 0.9, passed: true }),
    ]);
    const progress = partProgress(first, state, states({}));
    expect(progress).toMatchObject({ testedOut: true, lessonsDone: 4, complete: true });
  });

  it('ignores a failed test-out', () => {
    const state = reduce([
      event('test_out_attempted', { moduleId: 'firstcode', score: 0.5, passed: false }),
    ]);
    expect(partProgress(first, state, states({})).testedOut).toBe(false);
  });

  it('counts a lesson as done when its own module was tested out', () => {
    const state = reduce([
      event('test_out_attempted', { moduleId: 'basics', score: 1, passed: true }),
    ]);
    const progress = partProgress(first, state, states({}));
    expect(progress.lessonsDone).toBe(2);
    expect(progress.testedOut).toBe(false);
  });

  it('knows when the capstone was built', () => {
    const state = reduce([event('capstone_completed', { moduleId: 'firstcode' })]);
    expect(partProgress(first, state, states({})).capstoneBuilt).toBe(true);
  });

  it('is never complete with no published lesson, and has no share to show', () => {
    const progress = partProgress(empty, reduce([]), states({}));
    expect(progress).toMatchObject({ complete: false, lessonShare: 0, conceptShare: 0 });
  });
});

describe('journeyProgress', () => {
  it('makes the first part current for a new learner, with no checkpoint to offer', () => {
    const journey = journeyProgress([first, second], reduce([]), states({}));
    expect(journey.current?.id).toBe('firstcode');
    expect(journey.checkpoint).toBeNull();
    expect(journey.parts.map((p) => p.id)).toEqual(['firstcode', 'languages']);
  });

  it('moves on once a part is complete and offers its checkpoint', () => {
    const state = reduce(done('basics.one', 'cs.memory', 'basics.two', 'html.one'));
    const journey = journeyProgress([first, second], state, states({}));
    expect(journey.current?.id).toBe('languages');
    expect(journey.checkpoint?.id).toBe('firstcode');
  });

  it('stops offering a checkpoint once every concept of the part is Solid', () => {
    const state = reduce(done('basics.one', 'cs.memory', 'basics.two', 'html.one'));
    const solid = states({
      'basics.values': 'solid',
      'basics.loops': 'solid',
      'cs.memory': 'fluent',
      'html.tags': 'solid',
    });
    expect(journeyProgress([first, second], state, solid).checkpoint).toBeNull();
  });

  it('skips a part with nothing published, and has no current part at the end', () => {
    const state = reduce(
      done('basics.one', 'cs.memory', 'basics.two', 'html.one', 'js.one', 'js.two'),
    );
    const journey = journeyProgress([first, empty, second], state, states({}));
    expect(journey.current).toBeNull();
    expect(journey.checkpoint?.id).toBe('languages');
  });

  it('keeps the earliest unfinished part current, whatever was done later', () => {
    const state = reduce(done('js.one'));
    expect(journeyProgress([first, second], state, states({})).current?.id).toBe('firstcode');
  });
});

describe('partOfLesson', () => {
  it('finds the part that counts a lesson, woven or not', () => {
    expect(partOfLesson([first, second], 'cs.memory')?.id).toBe('firstcode');
    expect(partOfLesson([first, second], 'js.two')?.id).toBe('languages');
    expect(partOfLesson([first, second], 'go.one')).toBeUndefined();
  });
});

import { describe, expect, it } from 'vitest';
import {
  addTime,
  checkpointTime,
  formatMinutes,
  isLessonDone,
  journeyTime,
  partProgress,
  sumTime,
  type PartIndex,
} from '@/core/insight';
import { CHECKPOINT_MINUTES } from '@/core/practice';
import {
  makeEvent,
  reduce,
  type EventType,
  type PayloadOf,
  type StoryEvent,
} from '@/core/progress';

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

const part: PartIndex = {
  id: 'languages',
  title: 'JavaScript',
  summary: 'You can write JavaScript.',
  modules: ['js'],
  lessons: ['js.one', 'js.two'],
  concepts: ['js.a'],
};

describe('formatMinutes', () => {
  it.each([
    [0, '0 min'],
    [7, '7 min'],
    [45, '45 min'],
    [59.6, '1 h'],
    [60, '1 h'],
    [80, '1 h 20 min'],
    [599, '9 h 59 min'],
    [600, '10 h'],
    [4260, '71 h'],
    [4290, '72 h'],
    [-5, '0 min'],
  ])('writes %s minutes as "%s"', (minutes, text) => {
    expect(formatMinutes(minutes)).toBe(text);
  });
});

describe('sumTime', () => {
  const lessons = [
    { id: 'js.one', minutes: 10 },
    { id: 'js.two', minutes: 12 },
    { id: 'js.three', minutes: 8 },
  ];

  it('adds up the total and what is left', () => {
    const done = new Set(['js.two']);
    expect(sumTime(lessons, (id) => done.has(id))).toEqual({
      total: 30,
      left: 18,
      count: 3,
      countLeft: 2,
    });
  });

  it('is empty for no lessons', () => {
    expect(sumTime([], () => false)).toEqual({ total: 0, left: 0, count: 0, countLeft: 0 });
  });
});

describe('addTime', () => {
  it('adds totals field by field', () => {
    const a = { total: 10, left: 5, count: 2, countLeft: 1 };
    const b = { total: 20, left: 20, count: 1, countLeft: 1 };
    expect(addTime(a, b)).toEqual({ total: 30, left: 25, count: 3, countLeft: 2 });
    expect(addTime()).toEqual({ total: 0, left: 0, count: 0, countLeft: 0 });
  });
});

describe('isLessonDone', () => {
  it('counts a completed lesson', () => {
    expect(isLessonDone(reduce(done('js.one')), [part])('js.one')).toBe(true);
    expect(isLessonDone(reduce(done('js.one')), [part])('js.two')).toBe(false);
  });

  it('counts a lesson whose module or part was tested out', () => {
    const byModule = reduce([
      event('test_out_attempted', { moduleId: 'js', score: 1, passed: true }),
    ]);
    expect(isLessonDone(byModule, [part])('js.two')).toBe(true);
    const byPart = reduce([
      event('test_out_attempted', { moduleId: 'languages', score: 0.9, passed: true }),
    ]);
    expect(isLessonDone(byPart, [part])('js.two')).toBe(true);
    expect(isLessonDone(byPart, [part])('css.one')).toBe(false);
  });
});

describe('checkpointTime', () => {
  const none = () => 'unseen' as const;

  it('is one checkpoint session, left until the part is done and held', () => {
    const progress = partProgress(part, reduce([]), none);
    expect(checkpointTime(progress)).toEqual({
      total: CHECKPOINT_MINUTES,
      left: CHECKPOINT_MINUTES,
      count: 0,
      countLeft: 0,
    });
  });

  it('is no longer left once every concept of a complete part is Solid', () => {
    const progress = partProgress(part, reduce(done('js.one', 'js.two')), () => 'solid');
    expect(checkpointTime(progress).left).toBe(0);
  });

  it('is nothing for a part with no lessons', () => {
    const empty = partProgress({ ...part, lessons: [], concepts: [] }, reduce([]), none);
    expect(checkpointTime(empty).total).toBe(0);
  });
});

describe('journeyTime', () => {
  it('sums every lesson of the course and a checkpoint per part', () => {
    const minutesOf = { 'js.one': 10, 'js.two': 12, 'cs.one': 5 };
    const state = reduce(done('js.one'));
    const time = journeyTime({
      lessons: Object.entries(minutesOf).map(([id, minutes]) => ({ id, minutes })),
      parts: [part],
      state,
      stateOf: () => 'unseen',
    });
    expect(time.journey).toEqual({
      total: 27 + CHECKPOINT_MINUTES,
      left: 17 + CHECKPOINT_MINUTES,
      count: 3,
      countLeft: 2,
    });
    expect(time.parts.languages).toEqual({
      total: 22 + CHECKPOINT_MINUTES,
      left: 12 + CHECKPOINT_MINUTES,
      count: 2,
      countLeft: 1,
    });
  });
});

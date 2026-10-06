import { describe, expect, it } from 'vitest';
import {
  bestTestScores,
  resolveStageTest,
  stageTestKey,
  timedTestXp,
} from '@/core/online-test/path-tests';

const tally = (passed: number, total: number) => ({ passed, total });
const attempt = (testKey: string, passed: number) => ({
  testKey,
  tasks: [{ type: 'coding' as const, correctness: tally(passed, 4), performance: tally(0, 0) }],
});

describe('tests on a path', () => {
  it('keys a stage test as the simulator records it', () => {
    expect(stageTestKey({ test: 'demo' })).toBe('demo');
    expect(stageTestKey({ task: 'longest-streak' })).toBe('train-longest-streak');
    expect(stageTestKey({ lesson: 'interview.mock-levelled' })).toBe('interview.mock-levelled');
    expect(stageTestKey({ lab: 'event-loop-stepper' })).toBe('lab:event-loop-stepper');
  });

  it('keeps the best score of each test, as a whole percentage', () => {
    expect(
      bestTestScores([attempt('demo', 1), attempt('demo', 3), attempt('demo', 2), attempt('x', 0)]),
    ).toEqual({ demo: 75, x: 0 });
    expect(bestTestScores([])).toEqual({});
  });

  const index = {
    presets: [
      {
        id: 'demo',
        title: 'Your first test',
        summary: 'S',
        mode: 'demo' as const,
        order: 1,
        minutes: 30,
        tasks: ['streak'],
        languages: ['js' as const, 'ts' as const, 'python' as const],
        assistant: false,
        proctoring: false,
      },
      {
        id: 'mock-c',
        title: 'Practice test 3, in Python',
        summary: 'S',
        mode: 'mock' as const,
        order: 2,
        minutes: 90,
        tasks: ['streak', 'other'],
        languages: ['python' as const],
        assistant: true,
        proctoring: true,
      },
    ],
    tasks: [
      {
        id: 'streak',
        title: 'LongestStreak',
        topic: 'iterations' as const,
        difficulty: 'easy' as const,
        type: 'bug-fix' as const,
        recommendedMinutes: 20,
        guided: false,
      },
    ],
  };
  const lesson = (id: string) =>
    id === 'interview.mock-levelled'
      ? {
          id,
          title: 'Mock levelled assessment',
          objective: 'Sit it.',
          minutes: 90,
          href: '/learn/x/y',
        }
      : { id, title: id, objective: '', minutes: 0, href: null };

  it('resolves a preset with its shape, clock, link and XP', () => {
    expect(resolveStageTest({ test: 'demo', guided: true }, index, lesson)).toEqual({
      key: 'demo',
      kind: 'test',
      title: 'Your first test',
      detail: '1 task · try guided mode',
      minutes: 30,
      href: '/practise/online-test/demo',
      xp: 20,
    });
    expect(resolveStageTest({ test: 'mock-c' }, index, lesson)).toMatchObject({
      detail: '2 tasks · Python · AI assistant on',
      xp: 40,
    });
  });

  it('resolves a training task to its own route, topic and difficulty', () => {
    expect(resolveStageTest({ task: 'streak' }, index, lesson)).toEqual({
      key: 'train-streak',
      kind: 'training',
      title: 'LongestStreak',
      detail: 'Iterations · easy · bug fix',
      minutes: 20,
      href: '/practise/online-test/train-streak',
      xp: 20,
    });
  });

  it('names the levelled mock as one more practice test', () => {
    expect(resolveStageTest({ lesson: 'interview.mock-levelled' }, index, lesson)).toEqual({
      key: 'interview.mock-levelled',
      kind: 'lesson',
      title: 'Practice test 4: one task in four levels',
      detail: 'TypeScript · 1 task in four levels',
      minutes: 90,
      href: '/learn/x/y',
      xp: 15,
    });
  });

  it('resolves a lab to its page and question, with no XP of its own', () => {
    expect(resolveStageTest({ lab: 'event-loop-stepper' }, index, lesson)).toEqual({
      key: 'lab:event-loop-stepper',
      kind: 'lab',
      title: 'Event loop stepper',
      detail: 'In what order does this code run, and why?',
      minutes: 10,
      href: '/labs/event-loop-stepper',
      xp: 0,
    });
  });

  it('offers the XP a full score earns: 20 per task', () => {
    expect(timedTestXp(1)).toBe(20);
    expect(timedTestXp(3)).toBe(60);
  });
});

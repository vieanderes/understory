import { describe, expect, it } from 'vitest';
import {
  customQuery,
  durationLine,
  specFor,
  trainingKey,
  type OnlineTestIndex,
} from '@/core/online-test';

const index: OnlineTestIndex = {
  presets: [
    {
      id: 'demo',
      title: 'Demo test',
      summary: 'x',
      mode: 'demo',
      order: 1,
      minutes: 30,
      tasks: ['a'],
      languages: ['ts'],
      assistant: false,
      proctoring: false,
    },
  ],
  tasks: [
    {
      id: 'a',
      title: 'Alpha',
      topic: 'arrays',
      difficulty: 'easy',
      type: 'algorithmic',
      recommendedMinutes: 20,
      guided: false,
    },
    {
      id: 'b',
      title: 'Beta',
      topic: 'sorting',
      difficulty: 'hard',
      type: 'coding',
      recommendedMinutes: 30,
      guided: true,
    },
  ],
};

describe('test specs', () => {
  it('resolves a preset, a training key and nothing else', () => {
    expect(specFor('demo', index)).toMatchObject({
      key: 'demo',
      minutes: 30,
      taskIds: ['a'],
      languages: ['ts'],
    });
    expect(specFor(trainingKey('b'), index)).toMatchObject({
      mode: 'training',
      minutes: 120,
      taskIds: ['b'],
    });
    expect(specFor(trainingKey('zzz'), index)).toBeUndefined();
    expect(specFor('nope', index)).toBeUndefined();
    expect(specFor('custom', index)).toBeUndefined();
  });

  it('reads a custom test from its query, dropping what it does not know', () => {
    const query = new URLSearchParams(
      customQuery({
        taskIds: ['b', 'x', 'a', 'b'],
        minutes: 100,
        languages: ['python'],
        assistant: true,
        proctoring: false,
      }),
    );
    expect(specFor('custom', index, query)).toEqual({
      key: 'custom',
      title: 'Custom test',
      mode: 'custom',
      minutes: 100,
      taskIds: ['b', 'a'],
      languages: ['python'],
      assistant: true,
      proctoring: false,
    });
    const odd = specFor('custom', index, new URLSearchParams('tasks=a&minutes=7&languages=java'));
    expect(odd).toMatchObject({ minutes: 90, languages: ['js', 'ts', 'python'] });
    expect(specFor('custom', index, new URLSearchParams('tasks=zzz'))).toBeUndefined();
  });

  it('says how long and how many', () => {
    expect(durationLine({ minutes: 30, taskIds: ['a'] })).toBe('30 minutes for 1 task');
    expect(durationLine({ minutes: 90, taskIds: ['a', 'b'] })).toBe('90 minutes for 2 tasks');
  });
});

import type { TestSpec } from './attempt';
import type { CompiledPreset, OnlineTestIndex } from './schema';
import { isTaskLanguage, TASK_LANGUAGES, type TaskLanguage } from './signature';

/*
 * Which test a route key names. Presets are authored; training is any one task for 120
 * minutes, as in the platform's Lessons; a custom test is described by the query string,
 * so it can be bookmarked and sat again.
 */

export const TRAINING_PREFIX = 'train-';
export const TRAINING_MINUTES = 120;
export const CUSTOM_KEY = 'custom';
export const CUSTOM_MINUTES = [30, 45, 60, 90, 100, 120, 150, 180] as const;
export const MAX_CUSTOM_TASKS = 4;

export function presetSpec(preset: CompiledPreset): TestSpec {
  return {
    key: preset.id,
    title: preset.title,
    mode: preset.mode,
    minutes: preset.minutes,
    taskIds: preset.tasks,
    languages: preset.languages,
    assistant: preset.assistant,
    proctoring: preset.proctoring,
  };
}

export function trainingKey(taskId: string): string {
  return `${TRAINING_PREFIX}${taskId}`;
}

export interface CustomOptions {
  taskIds: string[];
  minutes: number;
  languages: TaskLanguage[];
  assistant: boolean;
  proctoring: boolean;
}

/** What a query string must answer; URLSearchParams does, and core names no browser type. */
export interface QueryLike {
  get(name: string): string | null;
}

export function customQuery(options: CustomOptions): string {
  const pairs: [string, string][] = [
    ['tasks', options.taskIds.join(',')],
    ['minutes', String(options.minutes)],
    ['languages', options.languages.join(',')],
    ['assistant', options.assistant ? '1' : '0'],
    ['proctoring', options.proctoring ? '1' : '0'],
  ];
  return pairs.map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('&');
}

function customSpec(index: OnlineTestIndex, query: QueryLike): TestSpec | undefined {
  const known = new Set(index.tasks.map((t) => t.id));
  const taskIds = [
    ...new Set((query.get('tasks') ?? '').split(',').filter((id) => known.has(id))),
  ].slice(0, MAX_CUSTOM_TASKS);
  if (taskIds.length === 0) return undefined;
  const asked = Number(query.get('minutes'));
  const minutes = (CUSTOM_MINUTES as readonly number[]).includes(asked) ? asked : 90;
  const languages = (query.get('languages') ?? '').split(',').filter(isTaskLanguage);
  return {
    key: CUSTOM_KEY,
    title: 'Custom test',
    mode: 'custom',
    minutes,
    taskIds,
    languages: languages.length > 0 ? [...new Set(languages)] : [...TASK_LANGUAGES],
    assistant: query.get('assistant') === '1',
    proctoring: query.get('proctoring') === '1',
  };
}

export function specFor(
  key: string,
  index: OnlineTestIndex,
  query?: QueryLike,
): TestSpec | undefined {
  const preset = index.presets.find((p) => p.id === key);
  if (preset) return presetSpec(preset);
  if (key.startsWith(TRAINING_PREFIX)) {
    const task = index.tasks.find((t) => t.id === key.slice(TRAINING_PREFIX.length));
    if (!task) return undefined;
    return {
      key,
      title: task.title,
      mode: 'training',
      minutes: TRAINING_MINUTES,
      taskIds: [task.id],
      languages: [...TASK_LANGUAGES],
      assistant: false,
      proctoring: false,
    };
  }
  if (key === CUSTOM_KEY && query) return customSpec(index, query);
  return undefined;
}

/** "30 minutes for 1 task", as the intro page puts it. */
export function durationLine(spec: Pick<TestSpec, 'minutes' | 'taskIds'>): string {
  const tasks = spec.taskIds.length;
  return `${spec.minutes} minutes for ${tasks} ${tasks === 1 ? 'task' : 'tasks'}`;
}

/**
 * Course mocks that the simulator runs now, lesson id to route: the same tasks in the same
 * IDE as every other timed test. The levelled mock is a stateful, multi-level task that does
 * not fit one function, so it stays in the lesson player.
 */
export const MOCKS_IN_SIMULATOR: Readonly<Record<string, string>> = {
  'interview.mock-a': '/practise/online-test/mock-a',
  'interview.mock-b': '/practise/online-test/mock-b',
  'interview.mock-python': '/practise/online-test/mock-c',
};

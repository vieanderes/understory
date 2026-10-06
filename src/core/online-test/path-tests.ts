import type { StageTestRef } from '../content/notes';
import { BASE_XP } from '../gamification/gamification';
import { LAB_INFO_BY_ID, LAB_MINUTES } from '../labs/catalog';
import { TOPIC_LABEL, type OnlineTestIndex } from './schema';
import { percent, scoreTallies, type TallyFacts } from './score';
import { trainingKey } from './spec';

/*
 * The timed tests a path stage recommends. They never count towards finishing a path; what
 * they give is XP for the score and a best score to beat, both read from the event log.
 */

/** The key a sitting is recorded under: the preset id, `train-<task>` or the lesson id. */
export function stageTestKey(ref: StageTestRef): string {
  if ('test' in ref) return ref.test;
  if ('task' in ref) return trainingKey(ref.task);
  if ('lab' in ref) return `lab:${ref.lab}`;
  return ref.lesson;
}

/** The best score of each test sat, as a whole percentage, keyed as the sitting was. */
export function bestTestScores(
  attempts: readonly { testKey: string; tasks: readonly TallyFacts[] }[],
): Record<string, number> {
  const best: Record<string, number> = {};
  for (const attempt of attempts) {
    const score = percent(scoreTallies(attempt.tasks));
    best[attempt.testKey] = Math.max(best[attempt.testKey] ?? 0, score);
  }
  return best;
}

/** The XP a full score earns in the simulator: a fixed amount per task. */
export function timedTestXp(tasks: number): number {
  return BASE_XP['timed-task'] * tasks;
}

/**
 * A timed test as a path stage shows it. Optional: it never counts towards finishing the
 * path, but it earns XP for its score and keeps a best score to beat.
 */
export interface PathTest {
  /** What progress records a sitting under: a preset id, `train-<task>` or a lesson id. */
  key: string;
  kind: 'test' | 'training' | 'lesson' | 'lab';
  title: string;
  /** One short line: the shape of the test, or the task's topic and difficulty. */
  detail: string;
  minutes: number;
  href: string;
  /** XP a full score earns. */
  xp: number;
}

/** The lesson facts a stage test needs; a path's lesson lookup returns them. */
export interface StageTestLesson {
  title: string;
  objective: string;
  minutes: number;
  href: string | null;
}

/**
 * The levelled mock runs in the lesson player, not the simulator, but to a learner it is one
 * more practice test, so it is named like the others.
 */
const LESSON_TESTS: Readonly<Record<string, { title: string; detail: string }>> = {
  'interview.mock-levelled': {
    title: 'Practice test 4: one task in four levels',
    detail: 'TypeScript · 1 task in four levels',
  },
};

export function resolveStageTest(
  ref: StageTestRef,
  index: OnlineTestIndex,
  lesson: (id: string) => StageTestLesson,
): PathTest {
  const key = stageTestKey(ref);
  if ('test' in ref) {
    const preset = index.presets.find((p) => p.id === ref.test);
    const tasks = preset?.tasks.length ?? 1;
    const python = preset?.languages.length === 1 && preset.languages[0] === 'python';
    const detail = [
      `${tasks} ${tasks === 1 ? 'task' : 'tasks'}`,
      ...(python ? ['Python'] : []),
      ...(preset?.assistant ? ['AI assistant on'] : []),
      ...(ref.guided ? ['try guided mode'] : []),
    ].join(' · ');
    return {
      key,
      kind: 'test',
      title: preset?.title ?? ref.test,
      detail,
      minutes: preset?.minutes ?? 0,
      href: `/practise/online-test/${ref.test}`,
      xp: timedTestXp(tasks),
    };
  }
  if ('task' in ref) {
    const task = index.tasks.find((t) => t.id === ref.task);
    return {
      key,
      kind: 'training',
      title: task?.title ?? ref.task,
      detail: task
        ? [
            TOPIC_LABEL[task.topic],
            task.difficulty,
            ...(task.type === 'bug-fix' ? ['bug fix'] : []),
          ].join(' · ')
        : '',
      minutes: task?.recommendedMinutes ?? 0,
      href: `/practise/online-test/${key}`,
      xp: timedTestXp(1),
    };
  }
  if ('lab' in ref) {
    // A lab is tried, not scored: it earns nothing itself, the lesson steps around it do.
    const lab = LAB_INFO_BY_ID.get(ref.lab);
    return {
      key,
      kind: 'lab',
      title: lab?.title ?? ref.lab,
      detail: lab?.question ?? '',
      minutes: LAB_MINUTES,
      href: `/labs/${ref.lab}`,
      xp: 0,
    };
  }
  const found = lesson(ref.lesson);
  const named = LESSON_TESTS[ref.lesson];
  return {
    key,
    kind: 'lesson',
    title: named?.title ?? found.title,
    detail: named?.detail ?? found.objective,
    minutes: found.minutes,
    href: found.href ?? '/practise',
    // An assessment lesson's one task is a code challenge, graded like any other.
    xp: BASE_XP['code-challenge'],
  };
}

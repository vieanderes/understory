'use client';

import { Bot, ChevronRight, Clock, Eye, Play } from 'lucide-react';
import Link from 'next/link';
import { useId, useState, type ReactNode } from 'react';
import { buttonClass } from '@/components/ui/Button';
import {
  customQuery,
  CUSTOM_MINUTES,
  durationLine,
  LANGUAGE_LABEL,
  MAX_CUSTOM_TASKS,
  percent,
  scoreTallies,
  secondsRemaining,
  clockLabel,
  TASK_LANGUAGES,
  TOPIC_LABEL,
  TOPICS,
  trainingKey,
  type OnlineTestIndex,
  type TaskLanguage,
} from '@/core/online-test';
import { useSecondClock } from '@/features/assessment/attempt-store';
import { useProgress } from '@/features/store/StoreProvider';
import { cn } from '@/lib/cn';
import { readReport, useAttemptsInProgress } from './attempt-store';

const DIFFICULTY_LABEL = { easy: 'Easy', medium: 'Medium', hard: 'Hard' } as const;
const TYPE_LABEL = {
  algorithmic: 'Algorithmic',
  coding: 'Coding',
  'bug-fix': 'Bug fixing',
} as const;

function testHref(key: string, query?: string): string {
  return `/practise/online-test/${key}${query ? `?${query}` : ''}`;
}

function Flags({ assistant, proctoring }: { assistant: boolean; proctoring: boolean }) {
  return (
    <>
      {assistant ? (
        <span className="inline-flex items-center gap-0.5">
          <Bot aria-hidden size={16} strokeWidth={2} /> AI assistant
        </span>
      ) : null}
      {proctoring ? (
        <span className="inline-flex items-center gap-0.5">
          <Eye aria-hidden size={16} strokeWidth={2} /> Pasting and tab switches are recorded
        </span>
      ) : null}
    </>
  );
}

function CustomBuilder({ index }: { index: OnlineTestIndex }) {
  const [taskIds, setTaskIds] = useState<string[]>([]);
  const [minutes, setMinutes] = useState(90);
  const [languages, setLanguages] = useState<TaskLanguage[]>([...TASK_LANGUAGES]);
  const [assistant, setAssistant] = useState(false);
  const [proctoring, setProctoring] = useState(true);
  const minutesId = useId();
  const full = taskIds.length >= MAX_CUSTOM_TASKS;

  const toggle = <T,>(list: T[], item: T): T[] =>
    list.includes(item) ? list.filter((x) => x !== item) : [...list, item];

  return (
    <div className="flex flex-col gap-3">
      <fieldset className="flex flex-col gap-1">
        <legend className="t-label pb-1">
          Tasks, up to {MAX_CUSTOM_TASKS} ({taskIds.length} chosen)
        </legend>
        <div className="grid grid-cols-1 gap-x-3 gap-y-0.5 md:grid-cols-2 lg:grid-cols-3">
          {index.tasks.map((task) => {
            const checked = taskIds.includes(task.id);
            return (
              <label
                key={task.id}
                className={cn(
                  'flex min-h-5 items-center gap-1 text-sm',
                  !checked && full && 'text-faint',
                )}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  disabled={!checked && full}
                  onChange={() => setTaskIds(toggle(taskIds, task.id))}
                  className="accent-accent size-2"
                />
                <span className="font-medium">{task.title}</span>
                <span className="text-muted">
                  {DIFFICULTY_LABEL[task.difficulty]}, {task.recommendedMinutes} min
                </span>
              </label>
            );
          })}
        </div>
      </fieldset>
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-0.5">
          <label htmlFor={minutesId} className="t-label">
            Time limit
          </label>
          <select
            id={minutesId}
            value={minutes}
            onChange={(event) => setMinutes(Number(event.target.value))}
            className="bg-surface border-border rounded-control h-5 border px-1"
          >
            {CUSTOM_MINUTES.map((m) => (
              <option key={m} value={m}>
                {m} minutes
              </option>
            ))}
          </select>
        </div>
        <fieldset className="flex flex-col gap-0.5">
          <legend className="t-label">Languages</legend>
          <div className="flex h-5 items-center gap-2">
            {TASK_LANGUAGES.map((l) => (
              <label key={l} className="flex items-center gap-0.5 text-sm">
                <input
                  type="checkbox"
                  checked={languages.includes(l)}
                  disabled={languages.length === 1 && languages.includes(l)}
                  onChange={() => setLanguages(toggle(languages, l))}
                  className="accent-accent size-2"
                />
                {LANGUAGE_LABEL[l]}
              </label>
            ))}
          </div>
        </fieldset>
        <label className="flex h-5 items-center gap-0.5 text-sm">
          <input
            type="checkbox"
            checked={assistant}
            onChange={() => setAssistant(!assistant)}
            className="accent-accent size-2"
          />
          AI assistant
        </label>
        <label className="flex h-5 items-center gap-0.5 text-sm">
          <input
            type="checkbox"
            checked={proctoring}
            onChange={() => setProctoring(!proctoring)}
            className="accent-accent size-2"
          />
          Proctoring signals
        </label>
      </div>
      <div>
        {taskIds.length === 0 ? (
          <p className="text-muted text-sm">Choose at least one task.</p>
        ) : (
          <Link
            href={testHref(
              'custom',
              customQuery({ taskIds, minutes, languages, assistant, proctoring }),
            )}
            className={buttonClass('secondary', 'lg')}
          >
            Start a custom test: {durationLine({ minutes, taskIds })}
          </Link>
        )}
      </div>
    </div>
  );
}

/** A course test that runs in the lesson player rather than the simulator. */
export interface LessonTest {
  id: string;
  title: string;
  note: string;
  href: string;
  minutes: number;
}

type Preset = OnlineTestIndex['presets'][number];

/** The first test not sat yet, in the course's order; once all are sat, the weakest one. */
/** The tests by what they are for, in the order a learner would meet them. */
const GROUPS: { title: string; modes: readonly Preset['mode'][] }[] = [
  { title: 'Start here', modes: ['demo'] },
  { title: 'Short screens', modes: ['screen'] },
  { title: 'With the AI assistant', modes: ['ai'] },
  { title: 'Full mocks', modes: ['mock'] },
];

/** A test as a hairline row: its name and what it is, then its size and your best score. */
function TestRow({
  href,
  title,
  summary,
  meta,
  result,
}: {
  href: string;
  title: string;
  summary: string;
  meta: string;
  result: string | undefined;
}) {
  return (
    <li className="rule-t">
      <Link
        href={href}
        className="hairline-row group flex items-start gap-2 py-1.5 transition-colors duration-150 ease-out"
      >
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="font-medium">{title}</span>
          <span className="text-muted text-sm">{summary}</span>
        </span>
        <span className="flex shrink-0 flex-col items-end gap-0.5">
          <span className="t-figure text-muted text-sm">{meta}</span>
          {result ? <span className="t-figure text-sm font-semibold">Best {result}</span> : null}
        </span>
      </Link>
    </li>
  );
}

function nextTest(presets: readonly Preset[], best: ReadonlyMap<string, number>) {
  return (
    presets.find((p) => !best.has(p.id)) ??
    [...presets].sort((a, b) => (best.get(a.id) ?? 0) - (best.get(b.id) ?? 0))[0]
  );
}

function Disclosure({ title, children }: { title: string; children: ReactNode }) {
  return (
    <details className="group rule-t">
      <summary className="flex min-h-6 cursor-pointer list-none items-center gap-2 py-1 font-medium">
        <span className="min-w-0 flex-1">{title}</span>
        <ChevronRight
          aria-hidden
          size={16}
          strokeWidth={2}
          className="text-muted shrink-0 transition-transform duration-150 ease-out group-open:rotate-90"
        />
      </summary>
      <div className="pb-3">{children}</div>
    </details>
  );
}

function TrainOneTask({ index }: { index: OnlineTestIndex }) {
  return (
    <div className="flex flex-col gap-2">
      <p className="text-muted text-sm">One task, 120 minutes, the full report.</p>
      {TOPICS.filter((topic) => index.tasks.some((t) => t.topic === topic)).map((topic) => (
        <div key={topic} className="flex flex-col">
          <h3 className="t-label pb-0.5">{TOPIC_LABEL[topic]}</h3>
          <ul className="flex flex-col">
            {index.tasks
              .filter((t) => t.topic === topic)
              .map((task) => (
                <li key={task.id} className="rule-t flex flex-wrap items-center gap-x-2 py-0.5">
                  <span className="font-medium">{task.title}</span>
                  <span className="text-muted text-sm">
                    {DIFFICULTY_LABEL[task.difficulty]} · {TYPE_LABEL[task.type]} ·{' '}
                    <span className="t-figure">{task.recommendedMinutes}</span> min
                  </span>
                  <Link
                    href={testHref(trainingKey(task.id))}
                    aria-label={`Train ${task.title}`}
                    className={cn(buttonClass('quiet', 'md'), 'ml-auto')}
                  >
                    Train
                  </Link>
                </li>
              ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

/**
 * Every timed test, with one recommended: the next one not sat, in the course's order.
 * The rest is a compact list; training and the custom builder stay folded until asked for.
 */
export function OnlineTestHub({
  index,
  lessonTests = [],
}: {
  index: OnlineTestIndex;
  lessonTests?: readonly LessonTest[];
}) {
  const { state } = useProgress();
  const now = useSecondClock();
  const keys = [
    ...index.presets.map((p) => p.id),
    ...index.tasks.map((t) => trainingKey(t.id)),
    'custom',
  ];
  const inProgress = useAttemptsInProgress(keys).filter(
    (a) =>
      (a.phase === 'running' && now > 0 && secondsRemaining(a, now) > 0) ||
      a.phase === 'tour' ||
      a.phase === 'ready',
  );
  const best = new Map<string, number>();
  for (const attempt of state.onlineTests) {
    const score = percent(scoreTallies(attempt.tasks));
    best.set(attempt.testKey, Math.max(score, best.get(attempt.testKey) ?? 0));
  }
  const next = nextTest(index.presets, best);
  const history = [...state.onlineTests].reverse().slice(0, 12);

  return (
    <div className="flex flex-col gap-6 py-4 md:py-6">
      <header className="flex max-w-3xl flex-col gap-2">
        <p className="t-label">Practice</p>
        <h1 className="t-title">Coding tests</h1>
        <p className="text-muted">
          Timed tests in an IDE like the real platforms, scored on hidden tests.
        </p>
      </header>

      {inProgress.length > 0 ? (
        <section
          aria-labelledby="resume-title"
          className="bg-surface border-border rounded-panel flex flex-col gap-1 border p-3"
        >
          <h2 id="resume-title" className="text-lg font-semibold">
            In progress
          </h2>
          {inProgress.map((a) => (
            <div key={a.id} className="flex flex-wrap items-center gap-2">
              <span className="font-medium">{a.spec.title}</span>
              <span className="text-muted t-figure inline-flex items-center gap-0.5 text-sm">
                <Clock aria-hidden size={16} strokeWidth={2} />
                {a.phase === 'running'
                  ? `${clockLabel(secondsRemaining(a, now))} left`
                  : 'Not started'}
              </span>
              <Link
                href={testHref(
                  a.spec.key,
                  a.spec.key === 'custom' ? customQuery({ ...a.spec }) : undefined,
                )}
                className={cn(buttonClass('secondary', 'md'), 'ml-auto')}
              >
                Resume
              </Link>
            </div>
          ))}
        </section>
      ) : null}

      {next ? (
        <section
          aria-labelledby="next-title"
          className="bg-surface border-border rounded-panel grid grid-cols-4 items-end gap-x-4 gap-y-3 border p-2 sm:p-3 md:grid-cols-12 md:p-4"
        >
          <div className="col-span-4 flex min-w-0 flex-col gap-1 md:col-span-8">
            <p className="t-label">{best.has(next.id) ? 'Sit again' : 'Next test'}</p>
            <h2 id="next-title" className="t-section">
              {next.title}
            </h2>
            <p className="text-muted">{next.summary}</p>
            <p className="text-muted t-figure flex flex-wrap gap-x-2 gap-y-0.5 text-sm">
              <span>{durationLine({ minutes: next.minutes, taskIds: next.tasks })}</span>
              <Flags assistant={next.assistant} proctoring={next.proctoring} />
            </p>
          </div>
          <div className="col-span-4 md:text-right">
            <Link
              href={testHref(next.id)}
              className={buttonClass('primary', 'lg', 'w-full md:w-auto')}
            >
              <Play aria-hidden size={16} strokeWidth={2} />
              Start
            </Link>
          </div>
        </section>
      ) : null}

      <section aria-labelledby="all-title" className="flex flex-col gap-4">
        <h2 id="all-title" className="t-section">
          All tests
        </h2>
        {GROUPS.map((group) => {
          const presets = index.presets.filter((p) => group.modes.includes(p.mode));
          const lessons = group.modes.includes('mock') ? lessonTests : [];
          if (presets.length + lessons.length === 0) return null;
          return (
            <section key={group.title} aria-label={group.title} className="flex flex-col">
              <h3 className="t-label pb-1">{group.title}</h3>
              <ul className="rule-b flex flex-col">
                {presets.map((preset) => (
                  <TestRow
                    key={preset.id}
                    href={testHref(preset.id)}
                    title={preset.title}
                    summary={preset.summary}
                    meta={`${preset.minutes} min · ${preset.tasks.length} ${preset.tasks.length === 1 ? 'task' : 'tasks'}`}
                    result={best.has(preset.id) ? `${best.get(preset.id)}%` : undefined}
                  />
                ))}
                {lessons.map((test) => (
                  <TestRow
                    key={test.id}
                    href={test.href}
                    title={test.title}
                    summary={test.note}
                    meta={`${test.minutes} min · 1 task`}
                    result={state.completedLessons.has(test.id) ? 'Done' : undefined}
                  />
                ))}
              </ul>
            </section>
          );
        })}
      </section>

      <div className="rule-b flex flex-col">
        <Disclosure title="Train one task">
          <TrainOneTask index={index} />
        </Disclosure>
        <Disclosure title="Build your own test">
          <CustomBuilder index={index} />
        </Disclosure>
      </div>

      <section aria-labelledby="results-title" className="flex flex-col gap-1">
        <h2 id="results-title" className="t-section">
          Your results
        </h2>
        {history.length === 0 ? (
          <p className="text-muted">Finished tests appear here.</p>
        ) : (
          <ul className="flex flex-col">
            {history.map((attempt) => {
              const stored = typeof window === 'undefined' ? null : readReport(attempt.attemptId);
              return (
                <li
                  key={attempt.attemptId}
                  className="rule-t flex flex-wrap items-center gap-x-2 gap-y-0.5 py-1"
                >
                  <span className="font-medium">{attempt.title}</span>
                  <span className="text-muted t-figure text-sm">
                    {new Date(attempt.submittedAt).toLocaleString('en-GB', {
                      dateStyle: 'medium',
                      timeStyle: 'short',
                    })}
                  </span>
                  <span className="t-figure font-semibold">
                    {percent(scoreTallies(attempt.tasks))}%
                  </span>
                  {stored ? (
                    <Link
                      href={`/practise/online-test/report?id=${attempt.attemptId}`}
                      className={cn(buttonClass('quiet', 'md'), 'ml-auto')}
                    >
                      Report
                    </Link>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}

'use client';

import { Bot, Clock, Eye, Play } from 'lucide-react';
import Link from 'next/link';
import { useId, useState } from 'react';
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

/** The tests, grouped by what they rehearse, in the order to take them. */
const TEST_GROUPS = [
  {
    mode: 'demo',
    title: 'Start here',
    note: 'One easy task to learn the screen before anything counts.',
  },
  {
    mode: 'screen',
    title: 'Practise the format',
    note: 'The shapes employers use: two tasks, three tasks, a bug fix, a tight clock.',
  },
  {
    mode: 'ai',
    title: 'With the AI assistant',
    note: 'The assistant is on, and the report shows your conversation as a reviewer reads it.',
  },
  {
    mode: 'mock',
    title: 'Full practice tests',
    note: 'Three tasks in 90 minutes, easy to hard. Sit them once the format feels familiar.',
  },
] as const;

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

/**
 * The simulator's front door: the preset tests, training on any one task, a custom test
 * and past results. One primary action: the demo test, the shortest way in.
 */
export function OnlineTestHub({ index }: { index: OnlineTestIndex }) {
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
  const first = index.presets[0];
  const history = [...state.onlineTests].reverse().slice(0, 12);

  return (
    <div className="flex flex-col gap-6 py-4 md:py-6">
      <section className="flex max-w-3xl flex-col gap-2">
        <p className="t-label">Practise</p>
        <h1 className="t-title">AI-assisted coding simulator</h1>
        <p className="text-muted text-lg">
          Sit a timed coding test in an IDE laid out like the real assessment platforms, then read
          your report the way a reviewer does: hidden tests, performance, integrity and the
          assistant transcript.
        </p>
        {first ? (
          <div className="pt-1">
            <Link href={testHref(first.id)} className={buttonClass('primary', 'lg')}>
              <Play aria-hidden size={16} strokeWidth={2} />
              Start {first.title.toLowerCase()}
            </Link>
          </div>
        ) : null}
      </section>

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

      {TEST_GROUPS.map((group) => {
        const presets = index.presets.filter((p) => p.mode === group.mode);
        if (presets.length === 0) return null;
        return (
          <section
            key={group.mode}
            aria-labelledby={`tests-${group.mode}`}
            className="flex flex-col gap-2"
          >
            <div className="flex flex-col gap-0.5">
              <h2 id={`tests-${group.mode}`} className="t-section">
                {group.title}
              </h2>
              <p className="text-muted">{group.note}</p>
            </div>
            <ul className="flex flex-col">
              {presets.map((preset) => (
                <li
                  key={preset.id}
                  className="rule-t grid grid-cols-4 items-center gap-2 py-2 md:grid-cols-12"
                >
                  <div className="col-span-4 flex flex-col md:col-span-8">
                    <span className="font-medium">{preset.title}</span>
                    <span className="text-muted text-sm">{preset.summary}</span>
                    <span className="text-muted t-figure flex flex-wrap gap-2 pt-0.5 text-sm">
                      <span>
                        {durationLine({ minutes: preset.minutes, taskIds: preset.tasks })}
                      </span>
                      <Flags assistant={preset.assistant} proctoring={preset.proctoring} />
                    </span>
                  </div>
                  <div className="col-span-4 md:text-right">
                    <Link href={testHref(preset.id)} className={buttonClass('secondary', 'md')}>
                      Start
                    </Link>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        );
      })}

      <section aria-labelledby="training-title" className="flex flex-col gap-2">
        <div className="flex flex-col gap-0.5">
          <h2 id="training-title" className="t-section">
            Training
          </h2>
          <p className="text-muted">
            One task, 120 minutes and the full report, as in the platforms&apos; training lessons.
          </p>
        </div>
        {TOPICS.filter((topic) => index.tasks.some((t) => t.topic === topic)).map((topic) => (
          <div key={topic} className="flex flex-col">
            <h3 className="t-label pb-0.5">{TOPIC_LABEL[topic]}</h3>
            <ul className="flex flex-col">
              {index.tasks
                .filter((t) => t.topic === topic)
                .map((task) => (
                  <li
                    key={task.id}
                    className="rule-t flex flex-wrap items-center gap-x-2 gap-y-0.5 py-1"
                  >
                    <span className="font-medium">{task.title}</span>
                    <span className="text-muted text-sm">
                      {DIFFICULTY_LABEL[task.difficulty]} · {TYPE_LABEL[task.type]} ·{' '}
                      {task.recommendedMinutes} min
                    </span>
                    <Link
                      href={testHref(trainingKey(task.id))}
                      className={cn(buttonClass('quiet', 'md'), 'ml-auto')}
                    >
                      Train
                    </Link>
                  </li>
                ))}
            </ul>
          </div>
        ))}
      </section>

      <section aria-labelledby="custom-title" className="flex flex-col gap-2">
        <div className="flex flex-col gap-0.5">
          <h2 id="custom-title" className="t-section">
            Custom test
          </h2>
          <p className="text-muted">
            Build the test you expect: its tasks, its time and its rules.
          </p>
        </div>
        <CustomBuilder index={index} />
      </section>

      <section aria-labelledby="results-title" className="flex flex-col gap-2">
        <h2 id="results-title" className="t-section">
          Your results
        </h2>
        {history.length === 0 ? (
          <p className="text-muted">Your finished tests appear here, with their scores.</p>
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

'use client';

import { Keyboard, RotateCcw, X } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useEffectEvent, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { codeSpans } from '@/components/ui/InlineCode';
import { evaluateTask, secondsLeft, toRunResult, type TaskReport } from '@/core/assessment';
import { MOCKS_IN_SIMULATOR } from '@/core/online-test/spec';
import type { CompiledCodeChallengeStep, CompiledLesson } from '@/core/content/compiled';
import { gradeRun } from '@/core/grading';
import type { RunResult } from '@/core/ports/code-runner';
import { clearDraft } from '@/features/editor/draft-store';
import { withholdTutor } from '@/features/tutor/tutor-store';
import type { DisposableRunner } from '@/features/editor/sandbox-runner';
import { useMediaQuery } from '@/features/editor/useMediaQuery';
import { LessonSummary } from '@/features/lesson-player/LessonSummary';
import { recordOutcome } from '@/features/lesson-player/outcome';
import { RichText } from '@/features/lesson-player/parts/RichText';
import { RecallStage } from '@/features/lesson-player/RecallStage';
import type { StepResult } from '@/features/lesson-player/StepRunner';
import { requestPersistence } from '@/features/store/client';
import { useProgress, useStore } from '@/features/store/StoreProvider';
import { cn } from '@/lib/cn';
import { AssessmentReport } from './AssessmentReport';
import { setAttemptStart, useAttemptStart, useSecondClock } from './attempt-store';
import { EXAMPLE_TIMEOUT_MS, TaskPane, taskCode, taskDraftKey } from './TaskPane';
import { Title } from '@/features/motion/Title';

interface AssessmentPlayerProps {
  lesson: CompiledLesson;
  moduleTitle: string;
  exitHref: string;
  solutionsUrl?: string;
  next: { href: string; title: string } | null;
  /** Tests inject a fake. The default is the sandboxed iframe, loaded on first use. */
  createRunner?: () => DisposableRunner | Promise<DisposableRunner>;
}

type Phase = 'idle' | 'scoring' | 'report' | 'recall' | 'summary';

/** The last minutes turn the clock to the danger colour: time is information here. */
const WARN_SECONDS = 5 * 60;

async function defaultRunner(): Promise<DisposableRunner> {
  const { createSandboxRunner } = await import('@/features/editor/sandbox-runner');
  return createSandboxRunner();
}

function clockText(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  const mm = String(m).padStart(h > 0 ? 2 : 1, '0');
  return `${h > 0 ? `${h}:` : ''}${mm}:${String(s).padStart(2, '0')}`;
}

function isSolutions(value: unknown): value is { solutions: Record<string, string> } {
  if (typeof value !== 'object' || value === null || !('solutions' in value)) return false;
  return typeof value.solutions === 'object' && value.solutions !== null;
}

let runSerial = 0;

/**
 * A timed assessment, shaped like the online tests it rehearses (docs/INTERVIEWS.md):
 * one clock for every task, Run checks the examples only, and the score comes from
 * hidden correctness and performance tests, one verdict each. At zero the code is
 * submitted as it stands.
 */
export function AssessmentPlayer({
  lesson,
  moduleTitle,
  exitHref,
  solutionsUrl,
  next,
  createRunner = defaultRunner,
}: AssessmentPlayerProps) {
  const store = useStore();
  const { state } = useProgress();
  const mode = state.modeByModule[lesson.moduleId] ?? 'guided';

  // A timed test measures what the learner knows without help, so the study assistant
  // stays away. A registration with an external store, undone on unmount.
  useEffect(() => withholdTutor(), []);

  const tasks = useMemo(
    () =>
      lesson.steps.filter(
        (step): step is CompiledCodeChallengeStep => step.type === 'code-challenge',
      ),
    [lesson.steps],
  );
  const briefs = useMemo(
    () => lesson.steps.filter((step) => step.type === 'prose'),
    [lesson.steps],
  );

  const startedAt = useAttemptStart(lesson.id);
  const now = useSecondClock();
  const [phase, setPhase] = useState<Phase>('idle');
  const [active, setActive] = useState(0);
  const [progress, setProgress] = useState({ task: 0, done: 0, total: 0 });
  const [reports, setReports] = useState<TaskReport[]>([]);
  const [results, setResults] = useState<StepResult[]>([]);
  const [solutions, setSolutions] = useState<Record<string, string> | null>(null);
  const coarse = useMediaQuery('(pointer: coarse)');

  const codes = useRef<Record<string, string>>({});
  const runner = useRef<Promise<DisposableRunner> | null>(null);
  const submitting = useRef(false);
  const headingRef = useRef<HTMLHeadingElement>(null);

  const left = startedAt === null || now === 0 ? null : secondsLeft(startedAt, lesson.minutes, now);
  const running = phase === 'idle' && startedAt !== null;

  useEffect(
    () => () => {
      void runner.current?.then((r) => r.dispose()).catch(() => undefined);
      runner.current = null;
    },
    [],
  );

  function sandbox(): Promise<DisposableRunner> {
    runner.current ??= Promise.resolve(createRunner());
    return runner.current;
  }

  async function runExamples(step: CompiledCodeChallengeStep, code: string): Promise<RunResult> {
    try {
      const active = await sandbox();
      runSerial += 1;
      return await active.run({
        runId: `${step.id}-ex-${runSerial.toString(36)}`,
        language: step.language,
        code,
        tests: step.testsCode,
        timeoutMs: EXAMPLE_TIMEOUT_MS,
        harnessVersion: 1,
      });
    } catch {
      runner.current = null;
      return {
        status: 'error',
        tests: [],
        logs: [],
        error: { name: 'SandboxError', message: 'The code tools could not be loaded. Try again.' },
      };
    }
  }

  function start() {
    for (const task of tasks) clearDraft(taskDraftKey(lesson.id, task.id));
    codes.current = {};
    setReports([]);
    setResults([]);
    setActive(0);
    setPhase('idle');
    setAttemptStart(lesson.id, Date.now());
  }

  async function submit() {
    if (submitting.current || startedAt === null) return;
    submitting.current = true;
    setPhase('scoring');
    const sandboxRunner = await sandbox();
    const scored: TaskReport[] = [];
    for (const [index, task] of tasks.entries()) {
      setProgress({ task: index + 1, done: 0, total: 0 });
      const code = codes.current[task.id] ?? taskCode(lesson.id, task);
      scored.push(
        await evaluateTask(
          sandboxRunner,
          {
            stepId: task.id,
            language: task.language,
            hiddenCode: task.hiddenCode,
            performanceCode: task.performanceCode,
            ...(task.timeLimitMs === undefined ? {} : { timeLimitMs: task.timeLimitMs }),
          },
          code,
          { onProgress: (done, total) => setProgress({ task: index + 1, done, total }) },
        ),
      );
    }

    const durationMs = Math.max(0, now - startedAt);
    const graded: StepResult[] = [];
    for (const task of tasks) {
      const report = scored.find((r) => r.stepId === task.id);
      if (!report) continue;
      const grade = gradeRun(
        {
          type: 'code-challenge',
          id: task.id,
          concept: task.concept,
          difficulty: task.difficulty,
          prompt: task.prompt.md,
          language: task.language,
          starter: 'starter.ts',
          solution: 'solution.ts',
          tests: 'tests.ts',
          hints: task.hints.map((h) => h.md),
        },
        toRunResult(report),
      );
      await recordOutcome(
        store,
        {
          lessonId: lesson.id,
          step: task,
          grade,
          tryNumber: 1,
          hintsUsed: 0,
          revealed: false,
          confidence: null,
          mode,
          context: 'lesson',
          durationMs: durationMs / tasks.length,
        },
        new Date(),
      );
      graded.push({ stepId: task.id, concept: task.concept, type: task.type, grade });
    }
    if (!state.completedLessons.has(lesson.id)) {
      await store.record('lesson_completed', { lessonId: lesson.id });
    }
    void requestPersistence();

    setAttemptStart(lesson.id, null);
    setReports(scored);
    setResults(graded);
    setPhase('report');
    submitting.current = false;
    void loadSolutions();
  }

  async function loadSolutions() {
    if (!solutionsUrl) return;
    try {
      const response = await fetch(solutionsUrl);
      const body: unknown = response.ok ? await response.json() : null;
      if (isSolutions(body)) setSolutions(body.solutions);
    } catch {
      // The report stands without them.
    }
  }

  // At zero the code is submitted as it stands, as on the real platforms. A timer, not a
  // check on each render: it fires even when the tab was asleep and the clock stood still.
  const timeUp = useEffectEvent(() => void submit());
  useEffect(() => {
    if (!running || startedAt === null) return;
    const id = setTimeout(timeUp, Math.max(0, startedAt + lesson.minutes * 60_000 - Date.now()));
    return () => clearTimeout(id);
  }, [running, startedAt, lesson.minutes]);

  useEffect(() => {
    if (!running && phase === 'idle') headingRef.current?.focus();
  }, [running, phase]);

  const header = (
    <header className="rule-b bg-bg sticky top-0 z-20">
      <div className="frame flex min-h-8 flex-wrap items-center gap-x-2 gap-y-1 py-1">
        <Link
          href={exitHref}
          aria-label="Leave assessment"
          title="Leave assessment"
          className="text-muted hover:text-fg hover:bg-raised rounded-control -ml-1 inline-flex size-5 shrink-0 items-center justify-center transition-colors duration-150 ease-out"
        >
          <X aria-hidden size={20} strokeWidth={2} />
        </Link>
        {running ? (
          <>
            {/* On a phone the tabs take their own row, under the clock and Submit. */}
            <div
              role="tablist"
              aria-label="Tasks"
              className="flex min-w-0 gap-0.5 max-md:order-last max-md:basis-full md:flex-1"
            >
              {tasks.map((task, index) => (
                <button
                  key={task.id}
                  type="button"
                  role="tab"
                  id={`tab-${task.id}`}
                  aria-controls={`panel-${task.id}`}
                  aria-selected={index === active}
                  onClick={() => setActive(index)}
                  className={cn(
                    'rounded-control transition-press h-5 px-2 text-sm font-medium whitespace-nowrap',
                    index === active ? 'bg-sunken text-fg' : 'text-muted hover:bg-raised',
                  )}
                >
                  Task <span className="t-figure">{index + 1}</span>
                </button>
              ))}
            </div>
            <p
              role="timer"
              aria-label="Time left"
              className={cn(
                't-figure ml-auto text-lg font-medium',
                left !== null && left <= WARN_SECONDS ? 'text-danger' : 'text-fg',
              )}
            >
              {left === null ? '' : clockText(left)}
            </p>
            <Button variant="primary" size="md" onClick={() => void submit()}>
              Submit
            </Button>
          </>
        ) : (
          <p className="t-label">{moduleTitle}</p>
        )}
      </div>
    </header>
  );

  return (
    <div className="bg-bg text-fg flex min-h-dvh flex-col">
      {header}

      <main id="content" className="frame flex-1 pt-4 pb-20">
        {phase === 'idle' && !running ? (
          <section className="step-in flex max-w-3xl flex-col gap-3 py-4">
            <p className="t-label">
              Assessment · <span className="t-figure">{lesson.minutes}</span> min ·{' '}
              <span className="t-figure">{tasks.length}</span>{' '}
              {tasks.length === 1 ? 'task' : 'tasks'}
            </p>
            <Title ref={headingRef} tabIndex={-1} className="outline-none">
              <span className="rich-inline">{codeSpans(lesson.title)}</span>
            </Title>
            <div className="rule-t pt-2">
              <p className="pt-1 text-lg">{lesson.opening.text}</p>
            </div>
            {briefs.map((brief) =>
              brief.type === 'prose' ? <RichText key={brief.id} value={brief.body} /> : null,
            )}
            <ul className="prose-measure flex list-disc flex-col gap-0.5 pl-3">
              <li>One clock runs for every task. Leaving the page does not stop it.</li>
              <li>Run checks the examples only. Hidden tests decide the score.</li>
              <li>Large-input tests fail on time alone, so the complexity counts.</li>
              <li>At zero, your code is submitted as it stands.</li>
              <li>No hints and no solutions until the end.</li>
            </ul>
            <p className="text-muted text-sm">
              {MOCKS_IN_SIMULATOR[lesson.id]
                ? 'This mock runs in the '
                : 'To rehearse the real screen, IDE and report too, use the '}
              <Link
                href={MOCKS_IN_SIMULATOR[lesson.id] ?? '/practise/online-test'}
                className="text-fg underline underline-offset-4"
              >
                AI-assisted coding simulator
              </Link>
              {MOCKS_IN_SIMULATOR[lesson.id]
                ? ', in the same IDE as the real test. Sit it there.'
                : '.'}
            </p>
            {coarse ? (
              <p className="text-muted flex items-center gap-1 text-sm">
                <Keyboard aria-hidden size={16} strokeWidth={2} />
                Best with a keyboard.
              </p>
            ) : null}
          </section>
        ) : null}

        {running ? (
          <>
            {tasks.map((task, index) => (
              <div
                key={task.id}
                role="tabpanel"
                id={`panel-${task.id}`}
                aria-labelledby={`tab-${task.id}`}
                hidden={index !== active}
              >
                <TaskPane
                  lessonId={lesson.id}
                  step={task}
                  number={index + 1}
                  onCodeChange={(id, code) => {
                    codes.current[id] = code;
                  }}
                  run={runExamples}
                  disabled={false}
                />
              </div>
            ))}
          </>
        ) : null}

        {phase === 'scoring' ? (
          <section role="status" className="flex flex-col gap-1 py-4">
            <p className="text-lg font-medium">Scoring against the hidden tests</p>
            <p className="text-muted t-figure">
              Task {progress.task} of {tasks.length}
              {progress.total > 0 ? ` · test ${progress.done} of ${progress.total}` : ''}
            </p>
          </section>
        ) : null}

        {phase === 'report' ? (
          <AssessmentReport tasks={tasks} reports={reports} solutions={solutions} />
        ) : null}

        {phase === 'recall' ? (
          <RecallStage lesson={lesson} onDone={() => setPhase('summary')} />
        ) : null}

        {phase === 'summary' ? (
          <LessonSummary lesson={lesson} results={results} next={next} exitHref={exitHref} />
        ) : null}
      </main>

      {phase === 'idle' && !running ? (
        <footer className="rule-t bg-bg pb-safe fixed inset-x-0 bottom-0 z-20">
          <div className="frame flex min-h-9 items-center justify-end py-1">
            <Button variant="primary" onClick={start}>
              Start the clock
            </Button>
          </div>
        </footer>
      ) : null}

      {phase === 'report' ? (
        <footer className="rule-t bg-bg pb-safe fixed inset-x-0 bottom-0 z-20">
          <div className="frame flex min-h-9 items-center justify-end gap-1 py-1">
            <Button variant="quiet" onClick={start}>
              <RotateCcw aria-hidden size={16} strokeWidth={2} />
              Retake
            </Button>
            <Button
              variant="primary"
              onClick={() => setPhase(lesson.recall.length > 0 ? 'recall' : 'summary')}
            >
              Continue
            </Button>
          </div>
        </footer>
      ) : null}
    </div>
  );
}

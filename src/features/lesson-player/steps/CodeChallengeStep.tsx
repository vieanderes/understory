'use client';

import { ChevronRight, Play, RotateCcw } from 'lucide-react';
import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { Button } from '@/components/ui/Button';
import { Segmented } from '@/components/ui/Segmented';
import type { CompiledCodeChallengeStep, CompiledSolutions } from '@/core/content/compiled';
import {
  challengeLanguages,
  chooseLanguage,
  inLanguage,
  languageLabel,
  twinSolutionKey,
  type ChallengeLanguage,
} from '@/core/content/twin';
import type { RunProgress, RunResult } from '@/core/ports/code-runner';
import { loadingLabel } from '@/core/running/python-packages';
import { clearDraft, draftKey, readDraft, writeDraft } from '@/features/editor/draft-store';
import { LazyCodeEditor } from '@/features/editor/LazyCodeEditor';
import type { DisposableRunner } from '@/features/editor/sandbox-runner';
import type { TypecheckHandle } from '@/features/editor/typecheck-types';
import {
  readChallengeLanguage,
  setChallengeLanguage,
  useChallengeLanguage,
} from '../challenge-language';
import type { StepProps } from '../contract';
import { Feedback } from '../parts/Feedback';
import { HintLadder, type SolutionState } from '../parts/HintLadder';
import { RichText } from '../parts/RichText';
import { statusLine, TestResults } from '../parts/TestResults';

/** Long enough for any honest solution at this level, short enough that a loop is felt. */
const RUN_TIMEOUT_MS = 3000;
/** A tsx run also evaluates about 1 MB of React and DOM inside the budget (docs/SANDBOX.md). */
const TSX_RUN_TIMEOUT_MS = 5000;
/** Room to write: the box is never shorter than this, however small the starter is. */
const MIN_LINES = 12;

export interface CodeChallengeStepProps extends StepProps<CompiledCodeChallengeStep> {
  /**
   * Scopes the draft. The player knows the lesson; without it the page path stands in,
   * which is just as unique for a lesson route.
   */
  lessonId?: string;
  /** Tests inject a fake. The default is the sandboxed iframe, imported on the first run. */
  createRunner?: (hooks: RunnerHooks) => DisposableRunner | Promise<DisposableRunner>;
}

interface RunnerHooks {
  /** What the run is loading before its code runs: Python, numpy and so on. */
  onProgress: (progress: RunProgress) => void;
}

async function defaultRunner(hooks: RunnerHooks): Promise<DisposableRunner> {
  const { createSandboxRunner } = await import('@/features/editor/sandbox-runner');
  return createSandboxRunner(hooks);
}

function isSolutions(value: unknown): value is Pick<CompiledSolutions, 'solutions'> {
  if (typeof value !== 'object' || value === null || !('solutions' in value)) return false;
  return typeof value.solutions === 'object' && value.solutions !== null;
}

let runSerial = 0;
/** Unique across every challenge on the page, so a late reply never meets the wrong run. */
function nextRunSerial(): number {
  runSerial += 1;
  return runSerial;
}

/** The verdict in one line, with what the help taken means for the score. */
function feedbackLine(correct: boolean, hints: number, revealed: boolean): string {
  if (!correct) return 'This run does not pass every test. The step returns in practice.';
  if (revealed) return 'Every test passes. The solution was shown, so the step scores 0.';
  if (hints === 0) return 'Every test passes, with no hints.';
  return `Every test passes, with ${hints === 1 ? '1 hint' : `${hints} hints`}.`;
}

type PerLanguage<T> = Partial<Record<ChallengeLanguage, T>>;

/**
 * Write · Unplugged. The learner writes the code with no completion and no assistant,
 * runs the tests as often as they like, and decides when to have the latest run checked.
 * Help exists, in the order of least help first, and every rung is their choice.
 */
export function CodeChallengeStep({
  step,
  phase,
  grade,
  solutionsUrl,
  onSubmissionChange,
  lessonId,
  createRunner = defaultRunner,
}: CodeChallengeStepProps) {
  // A step with a twin runs in the learner's preferred language when it has it. The id,
  // prompt, hints and scoring are shared, so the choice changes what runs and nothing else.
  const preferred = useChallengeLanguage();
  const language = chooseLanguage(step, preferred);
  const active = inLanguage(step, language);
  const timeoutMs = active.language === 'tsx' ? TSX_RUN_TIMEOUT_MS : RUN_TIMEOUT_MS;
  const [scope] = useState(
    () => lessonId ?? (typeof window === 'undefined' ? '' : window.location.pathname),
  );
  // One draft per language: the main one keeps the key it always had.
  const keyOf = (lang: ChallengeLanguage) =>
    draftKey(scope, lang === step.language ? step.id : `${step.id}:${lang}`);
  const key = keyOf(language);
  // Edits of this visit, per language. Before the first edit the draft is read while
  // rendering, not in an effect: the first paint already shows the learner's own code.
  const [codes, setCodes] = useState<PerLanguage<string>>({});
  const code =
    codes[language] ??
    (typeof window === 'undefined' ? active.starterCode : (readDraft(key) ?? active.starterCode));
  const [results, setResults] = useState<PerLanguage<RunResult>>({});
  const result = results[language] ?? null;
  const [running, setRunning] = useState(false);
  // Names what the first Python run is fetching and starting, which can take seconds.
  const [loading, setLoading] = useState<readonly string[]>([]);
  const [hintsShown, setHintsShown] = useState(0);
  const [solution, setSolution] = useState<SolutionState>('hidden');
  const [solutionFiles, setSolutionFiles] = useState<PerLanguage<string>>({});
  const solutionCode = solutionFiles[language] ?? '';
  const [confirmingReset, setConfirmingReset] = useState(false);
  const [testsOpen, setTestsOpen] = useState(false);

  // What a run that finishes later must report: the help taken by then, not at its start.
  const help = useRef({ hintsUsed: 0, revealed: false });
  const latest = useRef<PerLanguage<RunResult>>({});
  const runner = useRef<Promise<DisposableRunner> | null>(null);
  const mounted = useRef(false);
  // A type-checked step (docs/SANDBOX.md, "Type checking"): the editor underlines errors
  // as they are typed, and a run must type-check to pass. The handle is the editor's.
  const typecheck = useRef<TypecheckHandle | null>(null);

  const checked = phase === 'checked';
  const runningLabel = loading.length > 0 ? loadingLabel(loading) : 'Running';
  const starterLines = active.starterCode.split('\n').length;
  const minLines = Math.max(MIN_LINES, starterLines + 2);

  // One runner per mount. Its iframe belongs to the runner, not to React, so it is
  // removed here, and a run still in flight is rejected by `dispose`.
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      void runner.current?.then((r) => r.dispose()).catch(() => undefined);
      runner.current = null;
    };
  }, []);

  function report(next: RunResult) {
    onSubmissionChange({ type: 'code-challenge', result: next, ...help.current });
  }

  function edit(next: string) {
    setCodes((all) => ({ ...all, [language]: next }));
    writeDraft(key, next);
  }

  // The run on screen is the one Check grades, so a switch reports that language's last run.
  function switchLanguage(next: ChallengeLanguage) {
    setChallengeLanguage(next);
    setConfirmingReset(false);
    if (checked) return;
    const last = latest.current[next];
    if (last) report(last);
    else onSubmissionChange(null);
  }

  async function run() {
    if (running || checked) return;
    setRunning(true);
    // Held for the whole run: a switch while it runs must not file it under the other language.
    const ranIn = language;
    try {
      // Before the runner: the check runs beside the tests instead of after them. Only a
      // type-checked language has a checker; the handle may still be the other editor's.
      const finish = active.typecheck ? typecheck.current?.begin(code) : undefined;
      runner.current ??= Promise.resolve(
        createRunner({
          onProgress: (progress) => {
            if (mounted.current) setLoading(progress.loading);
          },
        }),
      );
      const sandbox = await runner.current;
      const serial = nextRunSerial();
      const ran = await sandbox.run({
        runId: `${step.id}-${serial.toString(36)}`,
        language: active.language,
        code,
        tests: active.testsCode,
        timeoutMs,
        harnessVersion: 1,
        ...(active.packages ? { packages: active.packages } : {}),
      });
      const outcome = finish ? await finish(ran) : ran;
      if (!mounted.current) return;
      record(ranIn, outcome);
    } catch (caught) {
      if (!mounted.current) return;
      // A run only rejects when it was replaced or the runner went away. If the runner
      // itself could not be loaded, say so where results go and let the next run retry.
      runner.current = null;
      const outcome: RunResult = {
        status: 'error',
        tests: [],
        logs: [],
        error: {
          name: 'SandboxError',
          message:
            caught instanceof DOMException && caught.name === 'AbortError'
              ? 'The run was stopped. Run the tests again.'
              : 'The code tools could not be loaded. Try again.',
        },
      };
      record(ranIn, outcome);
    } finally {
      if (mounted.current) {
        setRunning(false);
        setLoading([]);
      }
    }
  }

  function record(lang: ChallengeLanguage, outcome: RunResult) {
    latest.current = { ...latest.current, [lang]: outcome };
    setResults((all) => ({ ...all, [lang]: outcome }));
    // A run that finished after a switch is kept for its language, not graded.
    if (lang === chooseLanguage(step, readChallengeLanguage())) report(outcome);
  }

  function showHint() {
    const next = Math.min(step.hints.length, hintsShown + 1);
    setHintsShown(next);
    help.current = { ...help.current, hintsUsed: next };
    // A run already reported must carry the new count, or Check would score it too well.
    const last = latest.current[language];
    if (last) report(last);
  }

  async function showSolution() {
    if (!solutionsUrl) return;
    setSolution('loading');
    try {
      const response = await fetch(solutionsUrl);
      const body: unknown = response.ok ? await response.json() : null;
      const all = isSolutions(body) ? body.solutions : {};
      const source = all[step.id];
      if (typeof source !== 'string') throw new Error('No solution for this step.');
      if (!mounted.current) return;
      const twin = step.twin ? all[twinSolutionKey(step.id)] : undefined;
      setSolutionFiles({
        [step.language]: source,
        ...(step.twin && typeof twin === 'string' ? { [step.twin.language]: twin } : {}),
      });
      setSolution('shown');
      // Revealed only once it is on screen: a failed download has shown nothing. Both
      // languages are revealed at once, so a switch cannot hide that the answer was seen.
      help.current = { ...help.current, revealed: true };
      const last = latest.current[language];
      if (last) report(last);
    } catch {
      if (mounted.current) setSolution('failed');
    }
  }

  function reset() {
    clearDraft(key);
    setCodes((all) => ({ ...all, [language]: active.starterCode }));
    setConfirmingReset(false);
  }

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    // Inside the editor CodeMirror handles the shortcut and marks the event as handled.
    if (event.defaultPrevented || event.key !== 'Enter' || !(event.metaKey || event.ctrlKey))
      return;
    event.preventDefault();
    void run();
  }

  // The editor's header row: what this editor is, and Reset. On a phone the editor adds
  // its Full screen key at the end.
  const header = (
    <div className="flex min-h-5 flex-wrap items-center justify-between gap-x-2">
      <p className="t-label">Unplugged · no AI, no code hints</p>
      <div className="ml-auto flex items-center gap-1">
        {confirmingReset ? (
          <>
            <p className="text-sm">Restore the starter code?</p>
            <Button variant="secondary" size="md" onClick={reset}>
              Restore
            </Button>
            <Button variant="quiet" size="md" autoFocus onClick={() => setConfirmingReset(false)}>
              Keep
            </Button>
          </>
        ) : (
          <Button
            variant="quiet"
            size="md"
            className="-mr-2 pointer-coarse:mr-0"
            disabled={checked || code === active.starterCode}
            onClick={() => setConfirmingReset(true)}
          >
            <RotateCcw aria-hidden size={16} strokeWidth={2} />
            Reset
          </Button>
        )}
      </div>
    </div>
  );
  // Kept one tap away in the full-screen editor, where the prompt is out of sight.
  const task = <RichText value={step.prompt} />;

  return (
    // The shortcut is a convenience on top of the Run button, which is always there.
    <div
      className="challenge-grid grid grid-cols-4 gap-x-4 gap-y-3 md:grid-cols-12"
      onKeyDown={onKeyDown}
    >
      <div className="col-span-4 min-w-0 md:col-span-5">
        <RichText value={step.prompt} />
      </div>

      {/* Second in the source so that a phone reads prompt, editor, results. */}
      <div className="col-span-4 min-w-0 md:col-span-7 md:col-start-6 md:row-span-2 md:row-start-1">
        <div className="flex flex-col gap-1 md:sticky md:top-10">
          {step.twin ? (
            <Segmented
              label="Language"
              hideLabel
              className="md:w-fit"
              options={challengeLanguages(step).map((value) => ({
                value,
                label: languageLabel(value),
              }))}
              value={language}
              onChange={switchLanguage}
            />
          ) : null}
          {/* Keyed by language: undo history and the type checker belong to one file. */}
          <LazyCodeEditor
            key={language}
            value={code}
            onChange={edit}
            language={active.language}
            readOnly={checked}
            ariaLabel="Your code"
            minLines={minLines}
            placeholderHtml={step.starterHtml}
            onRun={() => void run()}
            runLabel="Run tests"
            runStatus={running ? runningLabel : result ? statusLine(result, timeoutMs) : undefined}
            typecheck={active.typecheck && { tests: active.testsCode, handleRef: typecheck }}
            header={header}
            task={task}
            editableRegion={
              active.editable === undefined
                ? undefined
                : { starter: active.starterCode, lines: active.editable }
            }
          />

          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <Button
              variant="secondary"
              onClick={() => void run()}
              loading={running}
              disabled={checked}
            >
              {running ? null : <Play aria-hidden size={16} strokeWidth={2} />}
              Run tests
            </Button>
            {active.editable === undefined ? null : (
              <p className="text-muted text-sm">
                Write the lines with the bar. The rest is locked.
              </p>
            )}
            {/* A phone has no Tab key. The symbol bar is the whole story there. */}
            <p className="text-muted font-mono text-sm pointer-coarse:hidden">
              Tab indents. Escape, then Tab, leaves the editor.
            </p>
          </div>

          {solution === 'shown' && solutionCode !== '' ? (
            <section aria-label="Solution" className="rule-t flex flex-col gap-1 pt-2">
              <p className="t-label">Solution</p>
              <LazyCodeEditor
                key={language}
                value={solutionCode}
                language={active.language}
                readOnly
                ariaLabel="Reference solution"
                minLines={1}
              />
            </section>
          ) : null}
        </div>
      </div>

      <div className="col-span-4 flex min-w-0 flex-col gap-3 md:col-span-5">
        <TestResults
          result={result}
          running={running}
          runningLabel={runningLabel}
          timeoutMs={timeoutMs}
        />

        {checked && grade ? (
          <Feedback verdict={grade.correct ? 'right' : 'wrong'}>
            <p>{feedbackLine(grade.correct, hintsShown, solution === 'shown')}</p>
          </Feedback>
        ) : null}

        <HintLadder
          hints={step.hints}
          shown={hintsShown}
          onShowHint={showHint}
          onShowSolution={solutionsUrl ? () => void showSolution() : undefined}
          solution={solution}
          disabled={checked}
        />

        {/*
         * The tests are out of sight, not secret: they ship with the lesson, and reading
         * a test to learn what the code must do is a real skill. Hidden by default only
         * so the first attempt starts from the prompt and not from the assertions.
         */}
        <details
          className="group rule-t"
          onToggle={(event) => setTestsOpen(event.currentTarget.open)}
        >
          <summary className="hover:bg-raised rounded-control transition-press flex min-h-5 cursor-pointer list-none items-center gap-1 text-sm font-medium select-none">
            <ChevronRight
              aria-hidden
              size={16}
              strokeWidth={2}
              className="transition-press group-open:rotate-90"
            />
            Show the tests
          </summary>
          {testsOpen ? (
            <div className="pt-0.5 pb-1">
              <LazyCodeEditor
                key={language}
                value={active.testsCode}
                language={active.language}
                readOnly
                ariaLabel="Tests for this step"
                minLines={1}
              />
            </div>
          ) : null}
        </details>
      </div>
    </div>
  );
}

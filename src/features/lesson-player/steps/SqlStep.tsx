'use client';

import { Check, Play, RotateCcw } from 'lucide-react';
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type KeyboardEvent,
} from 'react';
import { Button } from '@/components/ui/Button';
import type { CompiledSqlStep } from '@/core/content/compiled';
import {
  gradeSql,
  sqlVerdict,
  type SqlRunReport,
  type SqlTableInfo,
  type SqlVerdict,
} from '@/core/sql';
import { clearDraft, draftKey, readDraft, writeDraft } from '@/features/editor/draft-store';
import { LazyCodeEditor } from '@/features/editor/LazyCodeEditor';
import { holdSqlEngine, sqlEngine } from '@/features/sql/shared-engine';
import { SchemaPanel } from '@/features/sql/SchemaPanel';
import { StatementResults } from '@/features/sql/StatementResults';
import type { StepProps } from '../contract';
import { Feedback } from '../parts/Feedback';
import { HintLadder } from '../parts/HintLadder';
import { RichText } from '../parts/RichText';

const MIN_LINES = 5;

function feedbackLine(correct: boolean, hints: number): string {
  if (!correct) return 'Compare your result with the solution’s below.';
  if (hints === 0) return 'Same result as the solution, with no hints.';
  return `Same result as the solution, with ${hints === 1 ? '1 hint' : `${hints} hints`}.`;
}

function LiveVerdict({ verdict }: { verdict: SqlVerdict | null }) {
  if (verdict?.status === 'match') {
    return (
      <p className="text-success flex items-center gap-1 text-sm font-medium">
        <Check aria-hidden size={16} strokeWidth={2} />
        Same result as the solution
      </p>
    );
  }
  if (verdict?.status === 'mismatch') {
    return <p className="text-sm">Not the result the task asks for yet.</p>;
  }
  return null;
}

/**
 * Query · Live. The learner writes SQL against a small Postgres database seeded by the
 * step, runs it, and sees every statement's rows or Postgres's own error. Each run starts
 * from the setup again, so nothing a learner does can spoil the next try. With checks,
 * each run is compared with the solution's result on the same fresh database, and Check
 * hands that verdict to the player; without, the step is a database to explore.
 */
export function SqlStep({
  step,
  phase,
  grade,
  reveal,
  lessonId,
  onSubmissionChange,
}: StepProps<CompiledSqlStep>) {
  const [key] = useState(() =>
    draftKey(lessonId ?? (typeof window === 'undefined' ? '' : window.location.pathname), step.id),
  );
  // Read while the state is created, so the first paint already shows the learner's SQL.
  const [code, setCode] = useState(() =>
    typeof window === 'undefined' ? step.starter : (readDraft(key) ?? step.starter),
  );
  const [report, setReport] = useState<SqlRunReport | null>(null);
  const [verdict, setVerdict] = useState<SqlVerdict | null>(null);
  const [expected, setExpected] = useState<SqlRunReport | null>(null);
  const [tables, setTables] = useState<SqlTableInfo[] | null>(null);
  // The phone's suggestion row offers the step's tables and columns by name.
  const vocabulary = useMemo(
    () => (tables ?? []).flatMap((table) => [table.name, ...table.columns.map((c) => c.name)]),
    [tables],
  );
  const [tablesFailure, setTablesFailure] = useState<string | undefined>(undefined);
  const [running, setRunning] = useState(false);
  const [engine] = useState(() => sqlEngine());
  const [hintsShown, setHintsShown] = useState(0);
  const [confirmingReset, setConfirmingReset] = useState(false);
  const hints = useRef(0);
  const expectedRun = useRef<Promise<SqlRunReport> | null>(null);
  const mounted = useRef(true);

  const checks = step.checks;
  const checked = phase === 'checked';
  const query = checks?.query === undefined ? {} : { query: checks.query };
  const warm = useSyncExternalStore(
    engine.subscribe,
    () => engine.ready,
    () => false,
  );

  // The worker is shared by the page and outlives this step (shared-engine.ts). Reading the
  // tables here starts Postgres while the learner reads the prompt.
  useEffect(() => {
    mounted.current = true;
    const release = holdSqlEngine();
    void engine.run({ setup: step.setup, sql: '', describe: true }).then((described) => {
      if (!mounted.current) return;
      if (described.status === 'ran') setTables(described.schema ?? []);
      else if (described.status === 'setup-error') setTablesFailure(described.error.message);
      else if (described.status === 'unavailable') setTablesFailure(described.reason);
      else setTablesFailure('The database took too long.');
    });
    return () => {
      mounted.current = false;
      release();
    };
  }, [engine, step.setup]);

  /** The solution's result on a fresh database, once per step: it never changes. */
  function expectedResult(): Promise<SqlRunReport> {
    if (step.solution === undefined) {
      return Promise.resolve({ status: 'unavailable', reason: 'No solution to compare with.' });
    }
    expectedRun.current ??= engine
      .run({ setup: step.setup, sql: step.solution, ...query })
      .then((result) => {
        // A solution that could not run this time (the worker was busy starting) is tried again.
        if (result.status !== 'ran') expectedRun.current = null;
        return result;
      });
    return expectedRun.current;
  }

  function submit(next: SqlVerdict, hintsUsed: number) {
    onSubmissionChange({ type: 'sql', verdict: next, grade: gradeSql(next), hintsUsed });
  }

  async function run() {
    if (running || checked) return;
    setRunning(true);
    const learner = await engine.run({ setup: step.setup, sql: code, ...query });
    if (!mounted.current) return;
    let next: SqlVerdict | null = null;
    let solved: SqlRunReport | null = null;
    if (checks) {
      solved = await expectedResult();
      if (!mounted.current) return;
      next = sqlVerdict(learner, solved, checks);
    }
    setReport(learner);
    setExpected(solved);
    setVerdict(next);
    setRunning(false);
    // Without a verdict there is nothing to check yet; the database will answer next time.
    if (next && next.status !== 'unavailable') submit(next, hints.current);
    else onSubmissionChange(null);
  }

  function edit(value: string) {
    setCode(value);
    writeDraft(key, value);
    // The verdict was about the SQL as it was run. Check waits for the next run.
    if (checks) onSubmissionChange(null);
  }

  function reset() {
    clearDraft(key);
    setCode(step.starter);
    setConfirmingReset(false);
    if (checks) onSubmissionChange(null);
  }

  function showHint() {
    const next = Math.min(step.hints?.length ?? 0, hintsShown + 1);
    setHintsShown(next);
    hints.current = next;
    // The answer already reported must carry the new count, or Check would score it too well.
    if (verdict && verdict.status !== 'unavailable') submit(verdict, next);
  }

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    // Inside the editor CodeMirror handles the shortcut and marks the event as handled.
    if (event.defaultPrevented || event.key !== 'Enter' || !(event.metaKey || event.ctrlKey))
      return;
    event.preventDefault();
    void run();
  }

  const showSolution = reveal && grade !== undefined && !grade.correct && step.solution;
  const solved = expected?.status === 'ran' ? expected : null;

  // The editor's header row. On a phone the editor adds its Full screen key at the end.
  const header = (
    <div className="flex min-h-5 flex-wrap items-center justify-between gap-x-2">
      <p className="t-label">SQL · Postgres</p>
      <div className="ml-auto flex items-center gap-1">
        {confirmingReset ? (
          <>
            <p className="text-sm">Restore the starter?</p>
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
            disabled={checked || code === step.starter}
            onClick={() => setConfirmingReset(true)}
          >
            <RotateCcw aria-hidden size={16} strokeWidth={2} />
            Reset
          </Button>
        )}
      </div>
    </div>
  );

  return (
    // The shortcut is a convenience on top of the Run button, which is always there.
    <div
      className="challenge-grid grid grid-cols-4 gap-x-4 gap-y-3 md:grid-cols-12"
      onKeyDown={onKeyDown}
    >
      <div className="col-span-4 flex min-w-0 flex-col gap-3 md:col-span-5">
        <RichText value={step.prompt} />
        {step.showSchema ? <SchemaPanel tables={tables} failure={tablesFailure} /> : null}
      </div>

      {/* Second in the source, so a phone reads prompt, tables, editor, result. */}
      <div className="col-span-4 min-w-0 md:col-span-7 md:col-start-6 md:row-span-2 md:row-start-1">
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1">
            <LazyCodeEditor
              header={header}
              task={<RichText value={step.prompt} />}
              value={code}
              onChange={edit}
              language="sql"
              readOnly={checked}
              ariaLabel="Your SQL"
              minLines={Math.max(MIN_LINES, code.split('\n').length + 1)}
              onRun={() => void run()}
              assist="live"
              vocabulary={vocabulary}
            />

            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <Button
                variant="secondary"
                onClick={() => void run()}
                loading={running}
                disabled={checked}
              >
                {running ? null : <Play aria-hidden size={16} strokeWidth={2} />}
                Run
              </Button>
              <p className="text-muted font-mono text-sm pointer-coarse:hidden">
                Every run starts from the same tables.
              </p>
            </div>
          </div>

          <StatementResults
            id="sql-results"
            title="Result"
            report={report}
            running={running}
            warm={warm}
            verdict={checks ? <LiveVerdict verdict={verdict} /> : null}
          />
        </div>
      </div>

      <div className="col-span-4 flex min-w-0 flex-col gap-3 md:col-span-5">
        {checked && grade ? (
          <Feedback verdict={grade.correct ? 'right' : 'wrong'}>
            {grade.correct ? null : (
              <ul className="flex flex-col gap-0.5">
                {grade.feedback.map((item) => (
                  <li key={item.message} className="break-words">
                    {item.message}
                  </li>
                ))}
              </ul>
            )}
            <p>{feedbackLine(grade.correct, hintsShown)}</p>
          </Feedback>
        ) : null}

        {showSolution ? (
          <section aria-labelledby="sql-solution" className="rule-t flex flex-col gap-1 pt-2">
            <h3 id="sql-solution" className="t-label">
              Solution
            </h3>
            <LazyCodeEditor
              value={step.solution ?? ''}
              language="sql"
              readOnly
              ariaLabel="The solution SQL"
              minLines={1}
            />
            {solved ? (
              <StatementResults
                id="sql-solution-results"
                title="Its result"
                report={solved}
                running={false}
                warm
              />
            ) : null}
          </section>
        ) : null}

        {checks && step.hints ? (
          <HintLadder
            hints={step.hints}
            shown={hintsShown}
            onShowHint={showHint}
            solution="hidden"
            disabled={checked}
          />
        ) : null}
      </div>
    </div>
  );
}

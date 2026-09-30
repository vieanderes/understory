'use client';

import { ChevronDown, ChevronRight, CircleHelp } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { buttonClass } from '@/components/ui/Button';
import {
  INTEGRITY_ISSUE_LABEL,
  integritySummary,
  LANGUAGE_LABEL,
  percent,
  reportLine,
  scoreTask,
  scoreTest,
  tally,
  testPassed,
  testVerdict,
  VERDICT_LABEL,
  type TestResult,
} from '@/core/online-test';
import { cn } from '@/lib/cn';
import type { ReportTask, StoredReport } from './attempt-store';
import { Mark } from './Mark';
import { useServices } from './services';

const TOOLTIP = {
  correctness:
    'Correctness describes how much the solution follows the specification. Points are deducted if the program produces invalid results or crashes.',
  performance:
    'Performance describes whether the program behaves correctly for large inputs. Points are deducted if it exceeds the time limit on large data sets, which points to a sub-optimal approach.',
  score:
    'The task score is calculated from how the program does on our test data. A score below 100 means problems were found.',
};

const pct = (share: number | undefined): string =>
  share === undefined ? 'n/a' : `${percent(share)}%`;

function dateTime(at: number): string {
  return new Date(at).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' });
}

function mmss(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

function Metric({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="flex flex-col">
      <span className="t-label flex items-center gap-0.5">
        {label}
        <span title={hint} aria-label={hint} role="img" className="text-faint inline-flex">
          <CircleHelp aria-hidden size={16} strokeWidth={2} />
        </span>
      </span>
      <span className="t-figure text-base font-semibold">{value}</span>
    </div>
  );
}

function ScoreRing({ share }: { share: number }) {
  const r = 52;
  const c = 2 * Math.PI * r;
  return (
    <svg
      viewBox="0 0 128 128"
      role="img"
      aria-label={`Total score ${percent(share)}%`}
      className="size-20"
    >
      <circle cx="64" cy="64" r={r} fill="none" strokeWidth="8" className="stroke-border" />
      <circle
        cx="64"
        cy="64"
        r={r}
        fill="none"
        strokeWidth="8"
        strokeLinecap="round"
        strokeDasharray={`${c * share} ${c}`}
        transform="rotate(-90 64 64)"
        className="stroke-fg"
      />
      <text
        x="64"
        y="72"
        textAnchor="middle"
        className="fill-fg t-figure font-semibold"
        fontSize="28"
      >
        {percent(share)}%
      </text>
    </svg>
  );
}

function TaskSummaryRow({ task, submittedAt }: { task: ReportTask; submittedAt: number }) {
  const [open, setOpen] = useState(true);
  const score = scoreTask(task.result);
  const examples = tally(task.result, 'example');
  const correctness = tally(task.result, 'correctness');
  const performance = tally(task.result, 'performance');
  return (
    <div className="border-border rounded-control border">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="bg-raised rounded-control grid w-full grid-cols-4 items-center gap-2 p-2 text-left md:grid-cols-12"
      >
        <span className="col-span-4 flex items-center gap-1 md:col-span-5">
          {open ? (
            <ChevronDown aria-hidden size={16} strokeWidth={2} />
          ) : (
            <ChevronRight aria-hidden size={16} strokeWidth={2} />
          )}
          <span className="flex flex-col">
            <span className="font-medium">{task.title}</span>
            <span className="text-muted text-sm">{LANGUAGE_LABEL[task.language]}</span>
          </span>
        </span>
        <span className="col-span-4 grid grid-cols-3 gap-2 md:col-span-7">
          <Metric label="Correctness" value={pct(score.correctness)} hint={TOOLTIP.correctness} />
          <Metric label="Performance" value={pct(score.performance)} hint={TOOLTIP.performance} />
          <Metric label="Task score" value={pct(score.total)} hint={TOOLTIP.score} />
        </span>
      </button>
      {open ? (
        <dl className="grid grid-cols-2 gap-2 p-2 md:grid-cols-4">
          <div>
            <dt className="t-label">Example test cases</dt>
            <dd className="t-figure">
              Passed {examples.passed} out of {examples.total}
            </dd>
          </div>
          <div>
            <dt className="t-label">Correctness test cases</dt>
            <dd className="t-figure">
              Passed {correctness.passed} out of {correctness.total}
            </dd>
          </div>
          <div>
            <dt className="t-label">Performance test cases</dt>
            <dd className="t-figure">
              {performance.total > 0
                ? `Passed ${performance.passed} out of ${performance.total}`
                : 'Not assessed'}
            </dd>
          </div>
          <div>
            <dt className="t-label">Submission date</dt>
            <dd className="t-figure">{dateTime(submittedAt)}</dd>
          </div>
        </dl>
      ) : null}
    </div>
  );
}

const GROUP_TITLE = {
  example: 'Example tests',
  correctness: 'Correctness tests',
  performance: 'Performance tests',
} as const;

function TestRow({ test }: { test: TestResult }) {
  const [open, setOpen] = useState(!testPassed(test));
  const verdict = testVerdict(test);
  const ok = verdict === 'ok';
  return (
    <li className="rule-t">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="hover:bg-raised grid w-full grid-cols-4 items-baseline gap-1 px-1 py-1 text-left md:grid-cols-12"
      >
        <span className="col-span-2 font-mono text-sm md:col-span-3">{test.name}</span>
        <span className="text-muted col-span-2 text-sm md:col-span-6">{test.description}</span>
        <span
          className={cn(
            'col-span-4 text-sm font-semibold md:col-span-3 md:text-right',
            ok ? 'text-success' : 'text-danger',
          )}
        >
          {VERDICT_LABEL[verdict]}
        </span>
      </button>
      {open ? (
        <ol className="flex flex-col gap-0.5 px-1 pb-1 font-mono text-sm">
          {test.cases.map((c, i) => (
            <li
              key={i}
              className={cn('flex gap-1', c.verdict === 'ok' ? 'text-muted' : 'text-danger')}
            >
              <span className="t-figure w-3 shrink-0">{i + 1}.</span>
              <span className="t-figure w-8 shrink-0">
                {c.ms === undefined ? '' : `${(c.ms / 1000).toFixed(3)} s`}
              </span>
              <span className="min-w-0 break-words">{reportLine(c)}</span>
            </li>
          ))}
        </ol>
      ) : null}
    </li>
  );
}

function TestGroups({ task }: { task: ReportTask }) {
  const tests = task.result.tests;
  const passed = task.result.compileErrors ? 0 : tests.filter(testPassed).length;
  return (
    <div className="flex flex-col gap-2">
      <p className="t-figure text-sm">
        Test cases: <span className="text-success">{passed} passed</span> /{' '}
        <span className={tests.length - passed > 0 ? 'text-danger' : ''}>
          {tests.length - passed} failed
        </span>
      </p>
      {(['example', 'correctness', 'performance'] as const).map((group) => {
        const inGroup = tests.filter((t) => t.group === group);
        if (inGroup.length === 0) return null;
        const groupPassed = inGroup.filter(testPassed).length;
        return (
          <section key={group} aria-label={GROUP_TITLE[group]} className="flex flex-col">
            <div className="flex items-center gap-1 pb-0.5">
              <h4 className="font-medium">{GROUP_TITLE[group]}</h4>
              <span
                className={cn(
                  'rounded-full px-1 text-sm',
                  groupPassed === inGroup.length
                    ? 'bg-sunken text-success'
                    : 'bg-sunken text-danger',
                )}
              >
                {groupPassed === inGroup.length
                  ? 'All tests passed'
                  : `${groupPassed} of ${inGroup.length} passed`}
              </span>
            </div>
            <ul>
              {inGroup.map((test) => (
                <TestRow key={test.name} test={test} />
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}

function Playback({ report, task }: { report: StoredReport; task: ReportTask }) {
  const snapshots = report.attempt.snapshots.filter((s) => s.taskId === task.taskId);
  const [index, setIndex] = useState(snapshots.length);
  const start = report.attempt.startedAt ?? report.attempt.createdAt;
  if (snapshots.length === 0) return null;
  const shown =
    index >= snapshots.length
      ? { code: task.code, at: report.attempt.submittedAt ?? start, language: task.language }
      : snapshots[index]!;
  return (
    <section aria-label="Code playback" className="flex flex-col gap-1">
      <h4 className="font-medium">Code playback</h4>
      <label className="flex items-center gap-1 text-sm">
        <span className="t-label">Timeline</span>
        <input
          type="range"
          min={0}
          max={snapshots.length}
          value={index}
          onChange={(event) => setIndex(Number(event.target.value))}
          className="accent-accent min-w-0 flex-1"
          aria-valuetext={`${mmss(shown.at - start)} into the test`}
        />
        <span className="t-figure w-6 text-right">{mmss(shown.at - start)}</span>
      </label>
      <pre
        tabIndex={0}
        aria-label="Code"
        className="bg-sunken rounded-control max-h-48 overflow-auto p-2 font-mono text-sm"
      >
        {shown.code}
      </pre>
    </section>
  );
}

function Integrity({ report, recommended }: { report: StoredReport; recommended: number }) {
  const summary = integritySummary(report.attempt, recommended);
  const away = summary.durationMs > 0 ? Math.round((summary.awayMs / summary.durationMs) * 100) : 0;
  return (
    <section
      aria-labelledby="integrity-title"
      className="bg-surface border-border rounded-panel flex flex-col gap-2 border p-3"
    >
      <h2 id="integrity-title" className="text-lg font-semibold">
        Assessment integrity
      </h2>
      <p
        className={cn(
          'font-medium',
          summary.risk === 'Low'
            ? 'text-success'
            : summary.risk === 'Medium'
              ? 'text-warning'
              : 'text-danger',
        )}
      >
        Integrity risk: {summary.risk}
        {summary.issues.length > 0
          ? `, ${summary.issues.length} ${summary.issues.length === 1 ? 'issue' : 'issues'}`
          : ''}
      </p>
      <dl className="grid grid-cols-2 gap-2 md:grid-cols-4">
        <div>
          <dt className="t-label">Pasted code</dt>
          <dd className="t-figure">
            {summary.pastes} {summary.pastes === 1 ? 'paste' : 'pastes'}, largest{' '}
            {summary.largestPaste} characters
          </dd>
        </div>
        <div>
          <dt className="t-label">Attempts to copy the task</dt>
          <dd className="t-figure">{summary.copyAttempts}</dd>
        </div>
        <div>
          <dt className="t-label">Tab switches</dt>
          <dd className="t-figure">{summary.tabSwitches}</dd>
        </div>
        <div>
          <dt className="t-label">Away from the tab</dt>
          <dd className="t-figure">
            {away}% ({mmss(summary.awayMs)})
          </dd>
        </div>
      </dl>
      {summary.issues.length > 0 ? (
        <ul className="flex list-disc flex-col gap-0.5 pl-3 text-sm">
          {summary.issues.map((issue) => (
            <li key={issue}>{INTEGRITY_ISSUE_LABEL[issue]}</li>
          ))}
        </ul>
      ) : null}
      <p className="text-muted text-sm">
        Reviewers see these signals beside your code. A paste is not cheating, but it shows.
      </p>
    </section>
  );
}

/** Prompts that hand the task to the assistant, which reviewers mark down. */
const ASKS_FOR_SOLUTION =
  /\b(solve|write|give me|implement|code)\b.*\b(solution|function|whole|full|complete|it|this|task)\b|\bwhat is the answer\b/i;

function Transcript({ report }: { report: StoredReport }) {
  const messages = report.attempt.assistant;
  const start = report.attempt.startedAt ?? report.attempt.createdAt;
  const prompts = messages.filter((m) => m.role === 'user');
  const flagged = prompts.filter((m) => ASKS_FOR_SOLUTION.test(m.text));
  return (
    <section
      aria-labelledby="transcript-title"
      className="bg-surface border-border rounded-panel flex flex-col gap-2 border p-3"
    >
      <h2 id="transcript-title" className="text-lg font-semibold">
        Assistant transcript
      </h2>
      <p className="text-muted">
        {prompts.length} {prompts.length === 1 ? 'prompt' : 'prompts'}. Reviewers read every one.
        {flagged.length > 0
          ? ` ${flagged.length} ${flagged.length === 1 ? 'reads' : 'read'} as asking for the whole solution: ask narrow questions instead.`
          : prompts.length > 0
            ? ' None asks for the whole solution.'
            : ''}
      </p>
      {messages.length === 0 ? null : (
        <ol className="flex flex-col gap-1">
          {messages.map((m, i) => (
            <li key={i} className={cn('rounded-control p-1', m.role === 'user' ? 'bg-raised' : '')}>
              <p className="t-label t-figure">
                {m.role === 'user' ? 'You' : 'Assistant'} · {mmss(m.at - start)}
                {m.role === 'user' && ASKS_FOR_SOLUTION.test(m.text) ? (
                  <span className="text-danger"> · asks for the solution</span>
                ) : null}
              </p>
              <p className="text-sm whitespace-pre-wrap">{m.text}</p>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

function ReferenceSolution({ task }: { task: ReportTask }) {
  const services = useServices();
  const [code, setCode] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  if (code !== null) {
    return (
      <section aria-label="Reference solution" className="flex flex-col gap-1">
        <h4 className="font-medium">Reference solution, {LANGUAGE_LABEL[task.language]}</h4>
        <pre
          tabIndex={0}
          aria-label="Code"
          className="bg-sunken rounded-control max-h-64 overflow-auto p-2 font-mono text-sm"
        >
          {code}
        </pre>
      </section>
    );
  }
  return (
    <div>
      <button
        type="button"
        className={buttonClass('secondary', 'md')}
        onClick={() =>
          void services
            .loadSolutions()
            .then((all) => setCode(all[task.taskId]?.[task.language] ?? ''))
            .catch(() => setFailed(true))
        }
      >
        Show a reference solution
      </button>
      {failed ? (
        <p className="text-danger pt-1 text-sm">It could not be loaded. Try again.</p>
      ) : null}
    </div>
  );
}

function EmployerTask({
  report,
  task,
  number,
}: {
  report: StoredReport;
  task: ReportTask;
  number: number;
}) {
  const score = scoreTask(task.result);
  return (
    <section
      aria-labelledby={`report-task-${number}`}
      className="bg-surface border-border rounded-panel flex flex-col gap-3 border p-3"
    >
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h3 id={`report-task-${number}`} className="text-lg font-semibold">
          Task {number}: {task.title}
        </h3>
        <span className="t-figure font-semibold">{pct(score.total)}</span>
      </div>
      <dl className="grid grid-cols-2 gap-2 md:grid-cols-5">
        <div>
          <dt className="t-label">Task type</dt>
          <dd>
            {task.result.type === 'bug-fix'
              ? 'Bug fixing'
              : task.result.type === 'coding'
                ? 'Coding'
                : 'Algorithmic'}
          </dd>
        </div>
        <div>
          <dt className="t-label">Language</dt>
          <dd>{LANGUAGE_LABEL[task.language]}</dd>
        </div>
        <div>
          <dt className="t-label">Correctness</dt>
          <dd className="t-figure">{pct(score.correctness)}</dd>
        </div>
        <div>
          <dt className="t-label">Performance</dt>
          <dd className="t-figure">{pct(score.performance)}</dd>
        </div>
        <div>
          <dt className="t-label">Detected time complexity</dt>
          <dd className="font-mono text-sm">{task.complexity ?? 'Not assessed'}</dd>
        </div>
      </dl>
      {score.zeroedBy === 'compile' ? (
        <div className="text-danger font-mono text-sm">
          <p>Compilation failed. The task scores 0.</p>
          {task.result.compileErrors?.map((e) => (
            <p key={e}>{e}</p>
          ))}
        </div>
      ) : null}
      {task.result.changedLines ? (
        <p className={cn('text-sm', score.zeroedBy ? 'text-danger' : 'text-muted')}>
          Changed {task.result.changedLines.changed} of at most {task.result.changedLines.limit}{' '}
          lines.
          {score.zeroedBy === 'no-change' ? ' Nothing was changed, so the task scores 0.' : ''}
          {score.zeroedBy === 'too-many-changes'
            ? ' More lines than allowed, so the task scores 0.'
            : ''}
        </p>
      ) : null}
      <section aria-label="Submitted code" className="flex flex-col gap-1">
        <h4 className="font-medium">Solution</h4>
        <pre
          tabIndex={0}
          aria-label="Code"
          className="bg-sunken rounded-control max-h-64 overflow-auto p-2 font-mono text-sm"
        >
          {task.code}
        </pre>
      </section>
      <Playback report={report} task={task} />
      <TestGroups task={task} />
      <ReferenceSolution task={task} />
    </section>
  );
}

interface ReportViewProps {
  report: StoredReport;
  /** Recommended minutes per task, for the "time spent" signal. */
  recommended: Record<string, number>;
  againHref: string;
}

export function ReportView({ report, recommended, againHref }: ReportViewProps) {
  const [detailed, setDetailed] = useState(false);
  const total = scoreTest(report.tasks.map((t) => t.result));
  const submittedAt = report.attempt.submittedAt ?? report.attempt.createdAt;
  const recommendedTotal = report.tasks.reduce((sum, t) => sum + (recommended[t.taskId] ?? 0), 0);

  return (
    <div className="bg-bg text-fg min-h-dvh">
      <header className="rule-b bg-surface">
        <div className="frame flex h-7 items-center gap-2">
          <Mark />
          <p className="font-medium">{report.attempt.spec.title}</p>
        </div>
      </header>
      <main id="content" className="frame flex flex-col gap-3 py-4">
        <div className="flex flex-col gap-0.5">
          <h1 className="t-section">Your test summary</h1>
          <p className="text-muted">
            Submitted {dateTime(submittedAt)}
            {report.attempt.submitReason === 'time-up' ? ', when the time ran out' : ''}.
          </p>
          {report.attempt.guideUsed ? (
            <p className="text-muted text-sm">
              Guided: the coach walked you through, so read this score as a rehearsal. Sit it again
              without the guide to measure yourself.
            </p>
          ) : null}
        </div>

        <div className="grid grid-cols-4 gap-3 md:grid-cols-12">
          <section
            aria-labelledby="tasks-summary"
            className="bg-surface border-border rounded-panel col-span-4 flex flex-col gap-2 border p-3 md:col-span-8"
          >
            <h2 id="tasks-summary" className="text-lg font-semibold">
              Tasks summary
            </h2>
            {report.tasks.map((task) => (
              <TaskSummaryRow key={task.taskId} task={task} submittedAt={submittedAt} />
            ))}
          </section>
          <section
            aria-labelledby="total-score"
            className="bg-surface border-border rounded-panel col-span-4 flex flex-col items-center gap-2 border p-3"
          >
            <h2 id="total-score" className="self-start text-lg font-semibold">
              Total score
            </h2>
            <span data-testid="total-score">
              <ScoreRing share={total} />
            </span>
          </section>
        </div>

        {report.survey &&
        (report.survey.rating || report.survey.difficulty || report.survey.comment) ? (
          <section
            aria-label="Your notes"
            className="bg-surface border-border rounded-panel flex flex-col gap-1 border p-3"
          >
            <h2 className="text-lg font-semibold">Your notes</h2>
            {report.survey.rating ? (
              <p className="t-figure">Overall: {report.survey.rating} of 5</p>
            ) : null}
            {report.survey.difficulty ? (
              <p>
                Tasks for the time:{' '}
                {report.survey.difficulty === 'right' ? 'about right' : report.survey.difficulty}
              </p>
            ) : null}
            {report.survey.comment ? (
              <p className="text-muted whitespace-pre-wrap">{report.survey.comment}</p>
            ) : null}
          </section>
        ) : null}

        <div className="flex flex-wrap gap-1">
          <button
            type="button"
            className={buttonClass('primary', 'lg')}
            aria-expanded={detailed}
            onClick={() => setDetailed((d) => !d)}
          >
            {detailed ? 'Hide the detailed report' : 'See the detailed report'}
          </button>
          <Link href={againHref} className={buttonClass('secondary', 'lg')}>
            Sit this test again
          </Link>
          <Link href="/practise/online-test" className={buttonClass('quiet', 'lg')}>
            All tests
          </Link>
        </div>

        {detailed ? (
          <div className="flex flex-col gap-3">
            <p className="text-muted">
              What a reviewer sees: every test with its verdict, your code as it grew, the integrity
              signals and the assistant transcript.
            </p>
            {report.tasks.map((task, i) => (
              <EmployerTask key={task.taskId} report={report} task={task} number={i + 1} />
            ))}
            {report.attempt.spec.proctoring || report.attempt.integrity.length > 0 ? (
              <Integrity report={report} recommended={recommendedTotal} />
            ) : null}
            {report.attempt.spec.assistant || report.attempt.assistant.length > 0 ? (
              <Transcript report={report} />
            ) : null}
          </div>
        ) : null}
      </main>
    </div>
  );
}

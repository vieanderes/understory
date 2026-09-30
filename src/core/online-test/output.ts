import { judge, verdictLine, type CaseOutcome, type Expected } from './verdict';
import { formatJson } from './values';

/*
 * The Test Output panel after Run, as text. The wording follows the platform's output
 * line for line (docs/ONLINE-TEST.md, "Output"), because reading it fast under a clock is
 * part of what is being practised.
 */

export type LineTone = 'plain' | 'muted' | 'error' | 'emphasis';

export interface OutputLine {
  text: string;
  tone: LineTone;
  /** The label part of "Example test:   [1, 2]", printed before the text. */
  label?: string;
}

export interface OutputBlock {
  status: 'ok' | 'error' | 'neutral';
  lines: OutputLine[];
}

/** Green, amber and red in the panel's heading. */
export type RunStatus = 'passed' | 'warning' | 'failed';

export interface RunTranscript {
  status: RunStatus;
  header: OutputLine[];
  blocks: OutputBlock[];
  footer: OutputLine[];
}

export type RunCase =
  | { source: 'example'; argsText: string; expected: Expected; outcome: CaseOutcome }
  | { source: 'custom'; argsText: string; outcome: CaseOutcome }
  | { source: 'custom'; argsText: string; invalid: string };

export interface RenderOptions {
  /** The hard limit a case ran under, for the TIMEOUT ERROR line. */
  limitMs: number;
  /** Hidden tests the task has, for the closing note. */
  hiddenTests: number;
  /** Compiler errors (TypeScript), which stop the run before any case. */
  compileErrors?: readonly string[];
}

const plain = (text: string): OutputLine => ({ text, tone: 'plain' });
const muted = (text: string): OutputLine => ({ text, tone: 'muted' });
const error = (text: string): OutputLine => ({ text, tone: 'error' });

export const OUTPUT_WARNING = [
  'Producing output might cause your solution to fail performance tests.',
  'You should remove code that produces output before you submit your solution.',
];

export const DETECTED_ERRORS = 'Detected some errors.';

export function allPassNote(hiddenTests: number): OutputLine[] {
  return [
    plain('Your code is syntactically correct and works properly on the example test.'),
    {
      text: `Note that the example tests are not part of your score. On submission at least ${hiddenTests} test cases not shown here will assess your solution.`,
      tone: 'emphasis',
    },
  ];
}

function logLines(logs: readonly string[]): OutputLine[] {
  return logs.length === 0 ? [] : [plain('Output:'), ...logs.map(muted)];
}

function stderr(outcome: CaseOutcome & { message: string }): OutputLine[] {
  const where =
    outcome.kind === 'load-error' && outcome.line !== undefined
      ? [muted(`line ${outcome.line}`)]
      : [];
  return [
    ...logLines(outcome.logs),
    plain('Output (stderr):'),
    ...where,
    ...outcome.message.split('\n').map(muted),
  ];
}

function exampleBlock(item: Extract<RunCase, { source: 'example' }>, limitMs: number): OutputBlock {
  const head: OutputLine = { label: 'Example test:', text: item.argsText, tone: 'muted' };
  const verdict = judge(item.outcome, item.expected, limitMs);
  const body =
    item.outcome.kind === 'runtime-error' || item.outcome.kind === 'load-error'
      ? stderr(item.outcome)
      : logLines(item.outcome.logs);
  const last = verdict.verdict === 'ok' ? plain('OK') : error(verdictLine(verdict));
  return { status: verdict.verdict === 'ok' ? 'ok' : 'error', lines: [head, ...body, last] };
}

function customBlock(item: Extract<RunCase, { source: 'custom' }>, limitMs: number): OutputBlock {
  const head: OutputLine = { label: 'Your test case:', text: item.argsText, tone: 'muted' };
  if ('invalid' in item) {
    return { status: 'error', lines: [head, error(`RUNTIME ERROR (${item.invalid})`)] };
  }
  const outcome = item.outcome;
  switch (outcome.kind) {
    case 'returned':
      if (outcome.ms > limitMs) {
        const verdict = judge(outcome, { hash: '', preview: '' }, limitMs);
        return {
          status: 'error',
          lines: [head, ...logLines(outcome.logs), error(verdictLine(verdict))],
        };
      }
      return {
        status: 'neutral',
        lines: [
          head,
          ...logLines(outcome.logs),
          {
            label: 'Returned value:',
            text: formatJson(outcome.json, outcome.complete),
            tone: 'plain',
          },
        ],
      };
    case 'timeout':
      return {
        status: 'error',
        lines: [
          head,
          ...logLines(outcome.logs),
          error(verdictLine(judge(outcome, { hash: '', preview: '' }, limitMs))),
        ],
      };
    case 'runtime-error':
    case 'load-error':
      return {
        status: 'error',
        lines: [
          head,
          ...stderr(outcome),
          error('RUNTIME ERROR (tested program terminated with exit code 1)'),
        ],
      };
  }
}

export function renderRun(cases: readonly RunCase[], options: RenderOptions): RunTranscript {
  if (options.compileErrors !== undefined && options.compileErrors.length > 0) {
    return {
      status: 'failed',
      header: [plain('Compiler output:'), ...options.compileErrors.map(error)],
      blocks: [],
      footer: [error(DETECTED_ERRORS)],
    };
  }

  const blocks = cases.map((item) =>
    item.source === 'example'
      ? exampleBlock(item, options.limitMs)
      : customBlock(item, options.limitMs),
  );
  const examplesFailed = cases.some(
    (item, i) => item.source === 'example' && blocks[i]?.status !== 'ok',
  );
  const customFailed = cases.some(
    (item, i) => item.source === 'custom' && blocks[i]?.status === 'error',
  );
  const printed = cases.some((item) => 'outcome' in item && item.outcome.logs.length > 0);

  const footer: OutputLine[] = [];
  if (printed) footer.push(...OUTPUT_WARNING.map(error));
  if (examplesFailed || customFailed) footer.push(error(DETECTED_ERRORS));
  else footer.push(...allPassNote(options.hiddenTests));

  return {
    status: examplesFailed ? 'failed' : customFailed || printed ? 'warning' : 'passed',
    header: [plain('Compilation successful.')],
    blocks,
    footer,
  };
}

import type { RunResult } from '../ports/code-runner';
import { RESULT_MARKER } from './program';
import { clipDisplay, formatJson } from './values';

/*
 * One sandbox run of one case (program.ts), read back, then judged against the expected
 * hash. The four verdicts and their wording are the platform's: OK, WRONG ANSWER (got X
 * expected Y), TIMEOUT ERROR and RUNTIME ERROR (docs/ONLINE-TEST.md, "Verdicts").
 */

export type CaseOutcome =
  | {
      kind: 'returned';
      hash: string;
      json: string;
      complete: boolean;
      ms: number;
      size: number;
      logs: string[];
    }
  | { kind: 'timeout'; logs: string[] }
  | { kind: 'runtime-error'; message: string; logs: string[] }
  /** The code did not parse or threw while loading: no case of the run can pass. */
  | { kind: 'load-error'; message: string; line?: number; logs: string[] };

interface Envelope {
  h: string;
  j: string;
  n: number;
  ms: number;
  s: number;
}

function isEnvelope(value: unknown): value is Envelope {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.h === 'string' &&
    typeof v.j === 'string' &&
    typeof v.n === 'number' &&
    typeof v.ms === 'number' &&
    typeof v.s === 'number'
  );
}

function envelopeOf(message: string | undefined): Envelope | null {
  if (message === undefined) return null;
  const at = message.indexOf(RESULT_MARKER);
  if (at < 0) return null;
  try {
    const parsed: unknown = JSON.parse(message.slice(at + RESULT_MARKER.length));
    return isEnvelope(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function readCaseRun(result: RunResult): CaseOutcome {
  const logs = result.logs;
  if (result.status === 'timeout') return { kind: 'timeout', logs };
  const test = result.tests[0];
  if (test === undefined) {
    const error = result.error;
    const message = error ? `${error.name}: ${error.message}` : 'The program did not start.';
    return error?.line === undefined
      ? { kind: 'load-error', message, logs }
      : { kind: 'load-error', message, line: error.line, logs };
  }
  const envelope = envelopeOf(test.message);
  if (envelope) {
    return {
      kind: 'returned',
      hash: envelope.h,
      json: envelope.j,
      complete: envelope.n <= envelope.j.length,
      ms: Math.max(0, envelope.ms),
      size: envelope.s,
      logs,
    };
  }
  // The report is always a failure; a pass means the code replaced the harness's `test`.
  return {
    kind: 'runtime-error',
    message: test.passed ? 'The program did not report a result.' : (test.message ?? 'Error'),
    logs,
  };
}

export type Verdict = 'ok' | 'wrong-answer' | 'timeout' | 'runtime-error';

export const VERDICT_LABEL: Record<Verdict, string> = {
  ok: 'OK',
  'wrong-answer': 'WRONG ANSWER',
  timeout: 'TIMEOUT ERROR',
  'runtime-error': 'RUNTIME ERROR',
};

export interface Expected {
  hash: string;
  /** The expected value in display form, for "got X expected Y". */
  preview: string;
}

export interface CaseVerdict {
  verdict: Verdict;
  /** The text in brackets after the label, or after a comma in the report. */
  detail?: string;
  ms?: number;
  size?: number;
}

const seconds = (ms: number, digits: number): string => (ms / 1000).toFixed(digits);

export function judge(outcome: CaseOutcome, expected: Expected, limitMs: number): CaseVerdict {
  switch (outcome.kind) {
    case 'timeout':
      return {
        verdict: 'timeout',
        detail: `Killed. Hard limit reached: ${seconds(limitMs, 3)} sec.`,
      };
    case 'load-error':
    case 'runtime-error':
      return { verdict: 'runtime-error', detail: clipDisplay(outcome.message, 300) };
    case 'returned': {
      const timing = { ms: outcome.ms, size: outcome.size };
      if (outcome.ms > limitMs) {
        return {
          verdict: 'timeout',
          detail: `running time: ${seconds(outcome.ms, 2)} sec., time limit: ${seconds(limitMs, 2)} sec.`,
          ...timing,
        };
      }
      if (outcome.hash === expected.hash) return { verdict: 'ok', ...timing };
      const got = clipDisplay(formatJson(outcome.json, outcome.complete));
      return {
        verdict: 'wrong-answer',
        detail: `got ${got} expected ${clipDisplay(expected.preview)}`,
        ...timing,
      };
    }
  }
}

/** `WRONG ANSWER (got 1 expected 5)`, as the Test Output prints a verdict. */
export function verdictLine(verdict: CaseVerdict): string {
  const label = VERDICT_LABEL[verdict.verdict];
  if (verdict.verdict === 'runtime-error') {
    return `${label} (tested program terminated with exit code 1)`;
  }
  return verdict.detail === undefined ? label : `${label} (${verdict.detail})`;
}

/** `WRONG ANSWER, got 1 expected 5`, as the report prints one. */
export function reportLine(verdict: CaseVerdict): string {
  const label = VERDICT_LABEL[verdict.verdict];
  return verdict.detail === undefined ? label : `${label}, ${verdict.detail}`;
}

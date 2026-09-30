import type { RunResult, RunnerLanguage } from '../ports/code-runner';
import type { TypeCheckOutcome } from '../ports/type-checker';
import { describeDiagnostics } from './diagnostics';

/** The names of the check a type-checked run adds in front of the tests. */
export const TYPE_ERRORS = 'Type errors';
export const NO_TYPE_ERRORS = 'No type errors';

/**
 * Whether a code challenge is type-checked: shown live in the editor and required to
 * pass. On by default for TypeScript, because the checker is half of what TypeScript is.
 * tsx waits for React's types in the checker (docs/SANDBOX.md, "Type checking").
 */
export function typecheckOf(step: {
  language: RunnerLanguage;
  typecheck?: boolean;
  /** The starter's file name. A `ts` step may hold .js files, which are not TypeScript. */
  starter?: string;
}): boolean {
  return (
    step.language === 'ts' && step.typecheck !== false && step.starter?.endsWith('.js') !== true
  );
}

/**
 * A run of a type-checked step, with the checker's verdict as one more check in front
 * of the tests. Type errors fail a run whose tests all pass: code that runs today but
 * does not type-check is the bug TypeScript exists to catch. When the checker could not
 * answer, the run stands as it was, so a failed download never blocks a learner.
 */
export function withTypeCheck(result: RunResult, outcome: TypeCheckOutcome): RunResult {
  if (outcome.status === 'unavailable') return result;
  const { diagnostics } = outcome;
  if (diagnostics.length === 0) {
    return { ...result, tests: [{ name: NO_TYPE_ERRORS, passed: true }, ...result.tests] };
  }
  return {
    ...result,
    status: result.status === 'passed' ? 'failed' : result.status,
    tests: [
      { name: TYPE_ERRORS, passed: false, message: describeDiagnostics(diagnostics) },
      ...result.tests,
    ],
  };
}

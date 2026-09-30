import type { Grade } from '../grading/grade';
import type { SqlVerdict } from './verdict';

/**
 * Grades a sql step from its verdict: the learner's result against the solution's on
 * the same fresh database. All or nothing, like a query in real work; the feedback says
 * what differs, most basic first.
 *
 * It lives here, not beside the other graders, because the sql step applies it itself:
 * the player stays free of it, and so does the lesson route (bundle-budget.spec.ts).
 */
export function gradeSql(verdict: SqlVerdict): Grade {
  switch (verdict.status) {
    case 'match':
      return { correct: true, score: 1, feedback: [], detail: verdict };
    case 'mismatch':
      return {
        correct: false,
        score: 0,
        feedback: verdict.differences.map((message) => ({ kind: 'result', message })),
        detail: verdict,
      };
    case 'error':
      return {
        correct: false,
        score: 0,
        feedback: [{ kind: 'error', message: verdict.message }],
        detail: verdict,
      };
    case 'unavailable':
      return {
        correct: false,
        score: 0,
        feedback: [{ kind: 'unavailable', message: verdict.reason }],
        detail: verdict,
      };
  }
}

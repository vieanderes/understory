import type {
  AiReviewStep,
  BugHuntStep,
  CodeChallengeStep,
  ExplainBackStep,
  FillBlankStep,
  LabStep,
  MultipleChoiceStep,
  PlaygroundCheck,
  ParsonsStep,
  PredictStep,
  TraceTableStep,
} from '@/core/content/schema';
import type { RunResult } from '@/core/ports/code-runner';
import { EXPLAIN_BACK_SELF_GRADE_TO_SCORE } from '@/core/gamification';

/*
 * Pure grading for every non-code step type (docs/ARCHITECTURE.md "Core API"). Every
 * function here is total: given a well-formed step and answer, it always returns a
 * `Grade`, never throws, and never touches the outside world.
 */

export interface FeedbackItem {
  readonly kind: string;
  readonly message: string;
}

export interface Grade {
  readonly correct: boolean;
  readonly score: number; // 0..1
  readonly feedback: readonly FeedbackItem[];
  readonly detail?: unknown;
}

// ---------------------------------------------------------------------------
// Answer shapes
// ---------------------------------------------------------------------------

export interface PredictAnswer {
  readonly type: 'predict-output';
  readonly choiceIndex: number;
}
export interface MultipleChoiceAnswer {
  readonly type: 'multiple-choice';
  readonly choiceIndex: number;
}
export interface TraceTableAnswer {
  readonly type: 'trace-table';
  /** `cells[rowIndex][columnIndex]`, matching `step.rows`/`step.columns`. */
  readonly cells: readonly (readonly string[])[];
}
export interface FillBlankAnswer {
  readonly type: 'fill-blank';
  readonly values: Readonly<Record<string, string>>;
}
export interface ParsonsAnswer {
  readonly type: 'parsons';
  /** Block ids (and any distractor ids used) in the order the learner placed them. */
  readonly order: readonly string[];
  readonly indents?: Readonly<Record<string, number>>;
}
export interface LineHuntAnswer {
  readonly type: 'bug-hunt' | 'ai-review';
  readonly lines: readonly number[];
  readonly reasonIndex: number;
}
export interface ExplainBackAnswer {
  readonly type: 'explain-back';
  readonly rubricHits: 0 | 1 | 2 | 3;
}
export interface LabCheckpointAnswer {
  readonly type: 'lab';
  readonly choiceIndex: number;
}

export type Answer =
  | PredictAnswer
  | MultipleChoiceAnswer
  | TraceTableAnswer
  | FillBlankAnswer
  | ParsonsAnswer
  | LineHuntAnswer
  | ExplainBackAnswer
  | LabCheckpointAnswer;

export type GradableStep =
  | PredictStep
  | MultipleChoiceStep
  | TraceTableStep
  | FillBlankStep
  | ParsonsStep
  | BugHuntStep
  | AiReviewStep
  | ExplainBackStep
  | LabStep;

/** Partial credit for a bug-hunt or ai-review answer with the right line but the
 * wrong reason (the deliverable brief's explicit rule). */
const RIGHT_LINE_WRONG_REASON_SCORE = 0.5;

// ---------------------------------------------------------------------------
// Cell normalisation (trace-table)
// ---------------------------------------------------------------------------

const SMART_QUOTES: ReadonlyArray<readonly [RegExp, string]> = [
  [/[‘’]/g, "'"],
  [/[“”]/g, '"'],
];

/** Trims and normalises smart quotes to straight quotes, so "5" and “5” compare equal. */
export function normaliseCell(value: string): string {
  return SMART_QUOTES.reduce(
    (s, [pattern, replacement]) => s.replace(pattern, replacement),
    value.trim(),
  );
}

// ---------------------------------------------------------------------------
// gradeStep
// ---------------------------------------------------------------------------

function choiceGrade(
  choices: readonly { readonly correct?: boolean; readonly feedback: string }[],
  choiceIndex: number,
): Grade {
  const picked = choices[choiceIndex];
  const correct = picked?.correct === true;
  const feedback: FeedbackItem[] = picked ? [{ kind: 'choice', message: picked.feedback }] : [];
  return { correct, score: correct ? 1 : 0, feedback };
}

function gradePredict(step: PredictStep, answer: PredictAnswer): Grade {
  return choiceGrade(step.choices, answer.choiceIndex);
}

function gradeMultipleChoice(step: MultipleChoiceStep, answer: MultipleChoiceAnswer): Grade {
  return choiceGrade(step.choices, answer.choiceIndex);
}

function gradeLab(step: LabStep, answer: LabCheckpointAnswer): Grade {
  if (!step.checkpoint) return { correct: false, score: 0, feedback: [] };
  return choiceGrade(step.checkpoint.choices, answer.choiceIndex);
}

function gradeTraceTable(step: TraceTableStep, answer: TraceTableAnswer): Grade {
  const perCell: boolean[][] = [];
  let correctCount = 0;
  let totalCount = 0;
  step.rows.forEach((row, rowIndex) => {
    const rowResult: boolean[] = [];
    row.values.forEach((expected, colIndex) => {
      if (row.given) return; // given rows are shown filled in, not scored
      totalCount += 1;
      const actual = answer.cells[rowIndex]?.[colIndex] ?? '';
      const isCorrect = normaliseCell(actual) === normaliseCell(expected);
      if (isCorrect) correctCount += 1;
      rowResult[colIndex] = isCorrect;
    });
    perCell.push(rowResult);
  });
  const score = totalCount === 0 ? 1 : correctCount / totalCount;
  return { correct: score === 1, score, feedback: [], detail: { perCell } };
}

function gradeFillBlank(step: FillBlankStep, answer: FillBlankAnswer): Grade {
  let correctCount = 0;
  const perBlank: Record<string, boolean> = {};
  for (const blank of step.blanks) {
    const given = (answer.values[blank.key] ?? '').trim();
    const accepted = [blank.answer, ...(blank.accept ?? [])].map((a) => a.trim());
    const isCorrect = accepted.includes(given);
    perBlank[blank.key] = isCorrect;
    if (isCorrect) correctCount += 1;
  }
  const score = step.blanks.length === 0 ? 1 : correctCount / step.blanks.length;
  return { correct: score === 1, score, feedback: [], detail: { perBlank } };
}

function gradeParsons(step: ParsonsStep, answer: ParsonsAnswer): Grade {
  const expectedOrder = step.blocks.map((b) => b.id);
  const distractorsById = new Map((step.distractors ?? []).map((d) => [d.id, d] as const));
  const usedDistractors = answer.order.filter((id) => distractorsById.has(id));
  // Every id in usedDistractors came from distractorsById's own keys, so the lookup
  // below always finds an entry.
  const feedback: FeedbackItem[] = usedDistractors.map((id) => ({
    kind: 'distractor',
    message: distractorsById.get(id)!.feedback,
  }));

  const placedRealBlocks = answer.order.filter((id) => !distractorsById.has(id));
  let correctPositions = 0;
  const perBlockPosition: Record<string, boolean> = {};
  expectedOrder.forEach((id, index) => {
    const isCorrect = placedRealBlocks[index] === id;
    perBlockPosition[id] = isCorrect;
    if (isCorrect) correctPositions += 1;
  });

  let indentOk = true;
  if (step.checkIndent && answer.indents) {
    indentOk = step.blocks.every(
      (block) => (block.indent ?? 0) === (answer.indents?.[block.id] ?? 0),
    );
  }

  const positionScore = expectedOrder.length === 0 ? 1 : correctPositions / expectedOrder.length;
  const score =
    usedDistractors.length > 0 || !indentOk
      ? Math.min(positionScore, RIGHT_LINE_WRONG_REASON_SCORE)
      : positionScore;
  const correct = score === 1 && usedDistractors.length === 0 && indentOk;
  return { correct, score, feedback, detail: { perBlockPosition } };
}

function gradeLineHunt(step: BugHuntStep | AiReviewStep, answer: LineHuntAnswer): Grade {
  const expectedLines = new Set(step.lines);
  const selectedLines = new Set(answer.lines);
  const linesMatch =
    expectedLines.size === selectedLines.size &&
    [...expectedLines].every((line) => selectedLines.has(line));
  const reason = step.reasons[answer.reasonIndex];
  const reasonCorrect = reason?.correct === true;
  const feedback: FeedbackItem[] = reason ? [{ kind: 'reason', message: reason.feedback }] : [];

  if (!linesMatch) return { correct: false, score: 0, feedback };
  if (!reasonCorrect) return { correct: false, score: RIGHT_LINE_WRONG_REASON_SCORE, feedback };
  return { correct: true, score: 1, feedback };
}

function gradeExplainBack(_step: ExplainBackStep, answer: ExplainBackAnswer): Grade {
  const score = EXPLAIN_BACK_SELF_GRADE_TO_SCORE[answer.rubricHits];
  return { correct: answer.rubricHits === 3, score, feedback: [] };
}

/** Grades every step type except `code-challenge` (see `gradeRun`) and content types
 * that render but never score (`prose`; `lab`/`incident` fallbacks are graded via
 * their own portable step, not this dispatcher, unless it is the checkpoint itself). */
export function gradeStep(step: GradableStep, answer: Answer): Grade {
  if (step.type !== answer.type) {
    throw new Error(
      `gradeStep: step type "${step.type}" does not match answer type "${answer.type}"`,
    );
  }
  switch (step.type) {
    case 'predict-output':
      return gradePredict(step, answer as PredictAnswer);
    case 'multiple-choice':
      return gradeMultipleChoice(step, answer as MultipleChoiceAnswer);
    case 'trace-table':
      return gradeTraceTable(step, answer as TraceTableAnswer);
    case 'fill-blank':
      return gradeFillBlank(step, answer as FillBlankAnswer);
    case 'parsons':
      return gradeParsons(step, answer as ParsonsAnswer);
    case 'bug-hunt':
    case 'ai-review':
      return gradeLineHunt(step, answer as LineHuntAnswer);
    case 'explain-back':
      return gradeExplainBack(step, answer as ExplainBackAnswer);
    case 'lab':
      return gradeLab(step, answer as LabCheckpointAnswer);
  }
}

// ---------------------------------------------------------------------------
// gradeRun (code-challenge)
// ---------------------------------------------------------------------------

/** Grades a code-challenge from its test run. `step` is accepted for interface
 * symmetry with `gradeStep` and to leave room for per-step partial-credit rules. */
export function gradeRun(_step: CodeChallengeStep, result: RunResult): Grade {
  const total = result.tests.length;
  const passed = result.tests.filter((t) => t.passed).length;
  const score = total === 0 ? 0 : passed / total;
  const feedback: FeedbackItem[] = result.tests
    .filter((t) => !t.passed && t.message)
    .map((t) => ({ kind: 'test', message: t.message as string }));
  return {
    correct: result.status === 'passed',
    score,
    feedback,
    detail: { status: result.status, passed, total },
  };
}

// ---------------------------------------------------------------------------
// gradePlayground
// ---------------------------------------------------------------------------

/** Grades a playground from its checklist, judged live by `evaluateChecks`. A check with
 * no result, because the preview never reported, counts as failed. */
export function gradePlayground(
  checks: readonly PlaygroundCheck[],
  results: readonly { readonly passed: boolean; readonly reason?: string }[],
): Grade {
  const total = checks.length;
  const passed = checks.filter((_, i) => results[i]?.passed === true).length;
  const feedback: FeedbackItem[] = checks.flatMap((check, i) => {
    const result = results[i];
    if (result?.passed) return [];
    const message = result?.reason ? `${check.label}: ${result.reason}` : check.label;
    return [{ kind: 'check', message }];
  });
  return {
    correct: total > 0 && passed === total,
    score: total === 0 ? 0 : passed / total,
    feedback,
    detail: { passed, total },
  };
}

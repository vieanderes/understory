import type { CompiledStep } from '@/core/content/compiled';
import type { Grade } from '@/core/grading';
import { attemptScore } from '@/core/mastery';
import type { Confidence, Mode } from '@/core/progress';
import { ratingFromScore, retrievability, schedule, type CardState } from '@/core/scheduling';
import type { ProgressStore } from '@/features/store/progress-store';

/** Everything known about one finished attempt at one step. */
export interface Outcome {
  lessonId: string;
  step: Exclude<CompiledStep, { type: 'prose' }>;
  grade: Grade;
  tryNumber: number;
  hintsUsed: number;
  revealed: boolean;
  confidence: Confidence | null;
  mode: Mode;
  context: 'lesson' | 'practice' | 'test-out' | 'probe';
  durationMs: number;
  /** Explain-back only. */
  rubricHits?: 0 | 1 | 2 | 3;
  explanation?: string;
}

/**
 * The score that goes into the log. A fully correct answer is scored by how it was
 * reached (first try, second try, hints). Partial credit from the grader, such as the
 * right line with the wrong reason, is kept but discounted the same way on a later try.
 */
export function outcomeScore(
  o: Pick<Outcome, 'grade' | 'tryNumber' | 'hintsUsed' | 'revealed'>,
): number {
  if (o.revealed) return 0;
  if (o.grade.correct) {
    return attemptScore({
      tryNumber: o.tryNumber,
      hintsUsed: o.hintsUsed,
      revealed: false,
      correct: true,
    });
  }
  const laterTry = attemptScore({ tryNumber: 2, hintsUsed: 0, revealed: false, correct: true });
  return o.tryNumber > 1 ? o.grade.score * laterTry : o.grade.score;
}

const DAY_MS = 86_400_000;

export function retrievabilityNow(card: CardState | undefined, now: Date): number | undefined {
  if (!card?.lastReview) return undefined;
  const elapsed = Math.max(0, (now.getTime() - new Date(card.lastReview).getTime()) / DAY_MS);
  return retrievability(card.stability, elapsed);
}

/**
 * Writes the facts of one attempt: what was answered, and the FSRS state of the step as a
 * skill item, so practice can bring it back when it is about to be forgotten.
 */
export async function recordOutcome(store: ProgressStore, o: Outcome, now: Date): Promise<void> {
  const score = outcomeScore(o);
  const step = o.step;
  // Only a playground can lack a concept, and then it has no checks and is never scored.
  const concept = step.concept;
  if (concept === undefined) return;

  if (step.type === 'explain-back') {
    await store.record('explain_back_graded', {
      lessonId: o.lessonId,
      stepId: step.id,
      concept,
      rubricHits: o.rubricHits ?? 0,
      ...(o.explanation ? { text: o.explanation } : {}),
    });
  } else {
    await store.record('step_answered', {
      lessonId: o.lessonId,
      stepId: step.id,
      stepType: step.type,
      concept,
      difficulty: step.type === 'lab' ? (step.checkpoint?.difficulty ?? 1) : (step.difficulty ?? 1),
      tryNumber: o.tryNumber,
      hintsUsed: o.hintsUsed,
      revealed: o.revealed,
      score,
      correct: o.grade.correct,
      ...(o.confidence ? { confidence: o.confidence } : {}),
      mode: o.mode,
      context: o.context,
      durationMs: Math.round(o.durationMs),
    });
  }

  const cardKey = `skill:${o.lessonId}#${step.id}`;
  const before = store.getSnapshot().state.cards[cardKey];
  const rating = ratingFromScore(score, o.confidence ?? undefined);
  const r = retrievabilityNow(before, now);
  await store.record('review_graded', {
    cardKey,
    concept,
    rating,
    ...(r === undefined ? {} : { retrievabilityBefore: r }),
    state: schedule(before ?? null, rating, now),
  });
}

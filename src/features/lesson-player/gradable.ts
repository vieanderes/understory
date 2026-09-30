import type {
  CompiledChoice,
  CompiledLabStep,
  CompiledPortableStep,
  CompiledStep,
} from '@/core/content/compiled';
import type { Choice, PortableStep, Step } from '@/core/content/schema';
import type { GradableStep } from '@/core/grading';

/*
 * The graders in core speak the authored shape (markdown strings). The player holds the
 * compiled shape (markdown plus HTML). This maps one to the other, so there is exactly
 * one grading implementation, shared with the content gate and later with Swift.
 */

const choice = (c: CompiledChoice): Choice => ({
  text: c.text.md,
  feedback: c.feedback.md,
  ...(c.correct ? { correct: true } : {}),
});

function portable(step: CompiledPortableStep): PortableStep {
  switch (step.type) {
    case 'prose':
      return { type: 'prose', id: step.id, body: step.body.md };
    case 'predict-output':
      return {
        type: step.type,
        id: step.id,
        concept: step.concept,
        difficulty: step.difficulty,
        code: step.code,
        language: step.language,
        question: step.question.md,
        choices: step.choices.map(choice),
      };
    case 'multiple-choice':
      return {
        type: step.type,
        id: step.id,
        concept: step.concept,
        difficulty: step.difficulty,
        question: step.question.md,
        choices: step.choices.map(choice),
      };
    case 'trace-table':
      return {
        type: step.type,
        id: step.id,
        concept: step.concept,
        difficulty: step.difficulty,
        code: step.code,
        language: step.language,
        prompt: step.prompt.md,
        columns: step.columns,
        rows: step.rows,
      };
    case 'fill-blank':
      return {
        type: step.type,
        id: step.id,
        concept: step.concept,
        difficulty: step.difficulty,
        prompt: step.prompt.md,
        template: step.template,
        language: step.language,
        blanks: step.blanks,
        bank: step.bank,
      };
    case 'parsons':
      return {
        type: step.type,
        id: step.id,
        concept: step.concept,
        difficulty: step.difficulty,
        prompt: step.prompt.md,
        language: step.language,
        blocks: step.blocks.map(({ id, code, indent, subgoal }) => ({
          id,
          code,
          ...(indent === undefined ? {} : { indent }),
          ...(subgoal === undefined ? {} : { subgoal }),
        })),
        ...(step.distractors
          ? {
              distractors: step.distractors.map((d) => ({
                id: d.id,
                code: d.code,
                feedback: d.feedback.md,
              })),
            }
          : {}),
        ...(step.checkIndent === undefined ? {} : { checkIndent: step.checkIndent }),
      };
    case 'bug-hunt':
    case 'ai-review': {
      const base = {
        id: step.id,
        concept: step.concept,
        difficulty: step.difficulty,
        code: step.code,
        language: step.language,
        prompt: step.prompt.md,
        lines: step.lines,
        reasons: step.reasons.map(choice),
      };
      return step.type === 'bug-hunt'
        ? { type: 'bug-hunt', ...base }
        : { type: 'ai-review', ...base, request: step.request, flawClass: step.flawClass };
    }
    case 'code-challenge':
      return {
        type: step.type,
        id: step.id,
        concept: step.concept,
        difficulty: step.difficulty,
        prompt: step.prompt.md,
        language: step.language,
        starter: 'starter.ts',
        solution: 'solution.ts',
        tests: 'tests.ts',
        hints: step.hints.map((h) => h.md),
      };
    case 'explain-back':
      return {
        type: step.type,
        id: step.id,
        concept: step.concept,
        difficulty: step.difficulty,
        prompt: step.prompt.md,
        rubric: step.rubric,
        modelAnswer: step.modelAnswer.md,
      };
  }
}

function lab(step: CompiledLabStep): Extract<Step, { type: 'lab' }> {
  return {
    type: 'lab',
    id: step.id,
    concept: step.concept,
    lab: step.lab,
    intro: step.intro.md,
    ...(step.checkpoint
      ? {
          checkpoint: {
            question: step.checkpoint.question.md,
            choices: step.checkpoint.choices.map(choice),
            difficulty: step.checkpoint.difficulty,
          },
        }
      : {}),
    fallback: portable(step.fallback),
  };
}

/** The authored shape of a compiled step, for the graders. Prose has nothing to grade. */
export function toGradable(step: CompiledStep): GradableStep | null {
  // A challenge is graded from its run, a playground from its checks and a sql step from
  // its result, not from an Answer.
  if (
    step.type === 'prose' ||
    step.type === 'code-challenge' ||
    step.type === 'playground' ||
    step.type === 'sql'
  )
    return null;
  if (step.type === 'lab') return lab(step);
  if (step.type === 'incident') return toGradable(step.fallback);
  return portable(step) as GradableStep;
}

/** The step a client without labs or incidents shows instead. */
export function renderable(step: CompiledStep, hasLab: (id: string) => boolean): CompiledStep {
  if (step.type === 'lab') return hasLab(step.lab) ? step : step.fallback;
  if (step.type === 'incident') return step.fallback;
  return step;
}

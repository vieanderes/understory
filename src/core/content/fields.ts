import type { Choice, Language, Lesson, Step } from './schema';

/*
 * One walker for every piece of author-written text and code in a lesson. The validator's
 * markdown and style rules run over its output, so a new step type gets those rules by
 * being listed here once, and no rule is written per step type.
 */

/**
 * - `markdown`: block markdown, rendered to paragraphs, lists and fences
 * - `inline`: one line of inline markdown. It sits inside a button or a label, where a
 *   paragraph would be invalid HTML
 * - `plain`: shown as typed. Style rules still apply
 */
export type TextKind = 'markdown' | 'inline' | 'plain';

export interface TextField {
  /** Step id, card id, `opening` or `deepDive`. */
  where: string;
  /** The key inside that step, for example `choices[1].feedback`. */
  field: string;
  text: string;
  kind: TextKind;
}

export interface CodeField {
  where: string;
  field: string;
  code: string;
  language: Language;
}

type FieldSpec = readonly [field: string, text: string | undefined, kind: TextKind];

function choiceSpecs(list: string, choices: readonly Choice[]): FieldSpec[] {
  return choices.flatMap((choice, i): FieldSpec[] => [
    [`${list}[${i}].text`, choice.text, 'inline'],
    [`${list}[${i}].feedback`, choice.feedback, 'markdown'],
  ]);
}

function textSpecs(step: Step): FieldSpec[] {
  switch (step.type) {
    case 'prose':
      return [
        ['body', step.body, 'markdown'],
        ['figure.caption', step.figure?.caption, 'plain'],
      ];
    case 'predict-output':
    case 'multiple-choice':
      return [['question', step.question, 'markdown'], ...choiceSpecs('choices', step.choices)];
    case 'trace-table':
      return [['prompt', step.prompt, 'markdown']];
    case 'fill-blank':
      return [['prompt', step.prompt, 'markdown']];
    case 'parsons':
      return [
        ['prompt', step.prompt, 'markdown'],
        ...step.blocks.map((block, i): FieldSpec => [`blocks[${i}].subgoal`, block.subgoal, 'plain']),
        ...(step.distractors ?? []).map(
          (distractor, i): FieldSpec => [`distractors[${i}].feedback`, distractor.feedback, 'markdown'],
        ),
      ];
    case 'bug-hunt':
      return [['prompt', step.prompt, 'markdown'], ...choiceSpecs('reasons', step.reasons)];
    case 'ai-review':
      return [
        ['prompt', step.prompt, 'markdown'],
        ['request', step.request, 'plain'],
        ...choiceSpecs('reasons', step.reasons),
      ];
    case 'code-challenge':
      return [
        ['prompt', step.prompt, 'markdown'],
        ...step.hints.map((hint, i): FieldSpec => [`hints[${i}]`, hint, 'markdown']),
      ];
    case 'explain-back':
      return [
        ['prompt', step.prompt, 'markdown'],
        ...step.rubric.map((point, i): FieldSpec => [`rubric[${i}]`, point, 'plain']),
        ['modelAnswer', step.modelAnswer, 'markdown'],
      ];
    case 'lab':
      return [
        ['intro', step.intro, 'markdown'],
        ['checkpoint.question', step.checkpoint?.question, 'markdown'],
        ...choiceSpecs('checkpoint.choices', step.checkpoint?.choices ?? []),
      ];
    case 'incident':
      return [];
    case 'playground':
      return [
        ['prompt', step.prompt, 'markdown'],
        ...(step.checks ?? []).map((check, i): FieldSpec => [`checks[${i}].label`, check.label, 'plain']),
        ...(step.hints ?? []).map((hint, i): FieldSpec => [`hints[${i}]`, hint, 'markdown']),
      ];
    case 'sql':
      return [
        ['prompt', step.prompt, 'markdown'],
        ...(step.hints ?? []).map((hint, i): FieldSpec => [`hints[${i}]`, hint, 'markdown']),
      ];
  }
}

type CodeSpec = readonly [field: string, code: string | undefined, language: Language];

function codeSpecs(step: Step): CodeSpec[] {
  switch (step.type) {
    case 'predict-output':
    case 'trace-table':
      return [['code', step.code, step.language]];
    case 'multiple-choice':
      return [['code', step.code, step.language ?? 'text']];
    case 'fill-blank':
      return [['template', step.template, step.language]];
    case 'bug-hunt':
    case 'ai-review':
      return [
        ['code', step.code, step.language],
        ['fix', step.fix, step.language],
      ];
    case 'parsons':
      return [
        ...step.blocks.map((b, i): CodeSpec => [`blocks[${i}].code`, b.code, step.language]),
        ...(step.distractors ?? []).map(
          (d, i): CodeSpec => [`distractors[${i}].code`, d.code, step.language],
        ),
      ];
    case 'playground':
      return [
        ['html', step.html, 'html'],
        ['css', step.css, 'css'],
        ['js', step.js, 'js'],
        ['jsx', step.jsx, 'tsx'],
        ['solution.html', step.solution?.html, 'html'],
        ['solution.css', step.solution?.css, 'css'],
        ['solution.js', step.solution?.js, 'js'],
        ['solution.jsx', step.solution?.jsx, 'tsx'],
      ];
    // Not the setup: seed rows are fixture data, never read as a sample, and may run long.
    case 'sql':
      return [
        ['starter', step.starter, 'sql'],
        ['solution', step.solution, 'sql'],
        ['checks.query', step.checks?.query, 'sql'],
      ];
    default:
      return [];
  }
}

/** A lab or incident carries a second step inside it. Rules treat it like any other step. */
export function withFallbacks(steps: readonly Step[]): Step[] {
  return steps.flatMap((step): Step[] =>
    step.type === 'lab' || step.type === 'incident' ? [step, step.fallback] : [step],
  );
}

export function stepTextFields(step: Step): TextField[] {
  return textSpecs(step).flatMap(([field, text, kind]) =>
    text === undefined ? [] : [{ where: step.id, field, text, kind }],
  );
}

export function stepCodeFields(step: Step): CodeField[] {
  return codeSpecs(step).flatMap(([field, code, language]) =>
    code === undefined ? [] : [{ where: step.id, field, code, language }],
  );
}

export function lessonTextFields(lesson: Lesson): TextField[] {
  const closing: TextField[] = lesson.recall.flatMap((card): TextField[] => [
    { where: card.id, field: 'front', text: card.front, kind: 'markdown' },
    { where: card.id, field: 'back', text: card.back, kind: 'markdown' },
  ]);
  const deepDive: TextField[] =
    lesson.deepDive === undefined
      ? []
      : [{ where: 'deepDive', field: 'deepDive', text: lesson.deepDive, kind: 'markdown' }];
  const recap: TextField[] = (lesson.recap ?? []).map((line, i) => ({
    where: 'recap',
    field: `recap[${i}]`,
    text: line,
    kind: 'markdown',
  }));
  return [
    { where: 'opening', field: 'text', text: lesson.opening.text, kind: 'plain' },
    ...withFallbacks(lesson.steps).flatMap(stepTextFields),
    ...recap,
    ...closing,
    ...deepDive,
  ];
}

export function lessonCodeFields(lesson: Lesson): CodeField[] {
  return withFallbacks(lesson.steps).flatMap(stepCodeFields);
}

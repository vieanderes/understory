import { render } from '@testing-library/react';
import { useState, type ComponentType } from 'react';
import { vi } from 'vitest';
import type {
  CompiledAiReviewStep,
  CompiledBugHuntStep,
  CompiledChoice,
  CompiledExplainBackStep,
  CompiledFillBlankStep,
  CompiledLabStep,
  CompiledParsonsStep,
  CompiledStep,
  CompiledTraceTableStep,
  Rich,
} from '@/core/content/compiled';
import { gradeStep, type Answer, type Grade } from '@/core/grading';
import type { StepProps, Submission } from '@/features/lesson-player/contract';
import { toGradable } from '@/features/lesson-player/gradable';

/*
 * Small compiled steps in the shape the content compiler emits (scripts/lib/render.ts):
 * a <pre tabindex="0"> holding one `.line` span per line, and an empty
 * `<span data-blank>` per blank.
 */

const escape = (text: string) =>
  text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');

export const rich = (md: string): Rich => ({ md, html: `<p>${escape(md)}</p>` });

export function codeHtml(code: string): string {
  const lines = code
    .split('\n')
    .map((line, i) => `<span class="line" data-line="${i + 1}">${escape(line)}</span>`)
    .join('\n');
  return `<pre class="shiki understory" tabindex="0"><code>${lines}</code></pre>`;
}

export const choice = (text: string, feedback: string, correct = false): CompiledChoice => ({
  text: { md: text, html: escape(text) },
  feedback: rich(feedback),
  ...(correct ? { correct: true } : {}),
});

const TRACE_CODE = 'let total = 2 * 30;\ntotal = total + "1";\ntotal = total - 1;';

export const traceStep: CompiledTraceTableStep = {
  type: 'trace-table',
  id: 'trace',
  concept: 'js.coercion',
  difficulty: 2,
  language: 'js',
  code: TRACE_CODE,
  codeHtml: codeHtml(TRACE_CODE),
  prompt: rich('Write the value of total after each line.'),
  columns: ['total', 'typeof total'],
  rows: [
    { line: 1, values: ['60', '"number"'], given: true },
    { line: 2, values: ['"601"', '"string"'] },
    { line: 3, values: ['600', '"number"'] },
  ],
};

export const fillStep: CompiledFillBlankStep = {
  type: 'fill-blank',
  id: 'fill',
  concept: 'js.coercion',
  difficulty: 2,
  language: 'js',
  prompt: rich('Complete the code.'),
  template: 'const n = {{1}}(field.value);\nconsole.log({{2}} n);',
  templateHtml:
    '<pre class="shiki understory" tabindex="0"><code>' +
    '<span class="line" data-line="1">const n = <span data-blank="1"></span>(field.value);</span>\n' +
    '<span class="line" data-line="2">console.log(<span data-blank="2"></span> n);</span>' +
    '</code></pre>',
  blanks: [
    { key: '1', answer: 'Number' },
    { key: '2', answer: 'typeof' },
  ],
  bank: ['Number', 'String', 'typeof', 'instanceof'],
};

const block = (id: string, code: string, indent?: number, subgoal?: string) => ({
  id,
  code,
  codeHtml: codeHtml(code),
  ...(indent === undefined ? {} : { indent }),
  ...(subgoal === undefined ? {} : { subgoal }),
});

export const parsonsStep: CompiledParsonsStep = {
  type: 'parsons',
  id: 'arrange',
  concept: 'js.coercion',
  difficulty: 3,
  language: 'js',
  prompt: rich('Arrange parseQuantity. One block does not belong.'),
  checkIndent: true,
  blocks: [
    block('signature', 'function parseQuantity(text) {'),
    block('convert', 'const quantity = Number(text);', 1, 'Convert `once`'),
    block('result', 'return quantity;', 1),
    block('close', '}'),
  ],
  distractors: [
    {
      ...block('join-zero', 'const quantity = text + 0;'),
      feedback: rich('Plus with a string joins text.'),
    },
    {
      ...block('parse-float', 'const quantity = parseFloat(text);'),
      feedback: rich('parseFloat accepts trailing text.'),
    },
  ],
};

const HUNT_CODE =
  'function lineTotal(text, price) {\n  const quantity = Number(text);\n  if (quantity == false) {\n    return 0;\n  }\n  return quantity * price;\n}';

const huntBase = {
  id: 'hunt',
  concept: 'js.equality',
  difficulty: 3,
  language: 'js' as const,
  code: HUNT_CODE,
  codeHtml: codeHtml(HUNT_CODE),
  prompt: rich('Tap the line at fault.'),
  lines: [3],
  reasons: [
    choice('NaN == false is false', 'NaN equals nothing, itself included.', true),
    choice('Number throws', 'Number never throws on text.'),
    choice('The product joins text', 'You applied the rule for plus.'),
  ],
  fix: 'if (!Number.isInteger(quantity)) {',
  fixHtml: codeHtml('if (!Number.isInteger(quantity)) {'),
};

export const bugHuntStep: CompiledBugHuntStep = { type: 'bug-hunt', ...huntBase };

export const aiReviewStep: CompiledAiReviewStep = {
  type: 'ai-review',
  ...huntBase,
  id: 'review',
  request: 'Sum the prices with `parseInt`.',
  flawClass: 'edge-case',
};

export const twoLineHuntStep: CompiledBugHuntStep = {
  ...bugHuntStep,
  id: 'hunt-two',
  lines: [3, 6],
};

export const explainStep: CompiledExplainBackStep = {
  type: 'explain-back',
  id: 'explain',
  concept: 'js.coercion',
  difficulty: 3,
  prompt: rich('Why does the cart show "21"?'),
  rubric: ['A form value is a string.', '`+` joins text.', '`*` converts to numbers.'],
  modelAnswer: rich('The quantity is the string "2", so plus joins.'),
};

export const labStep: CompiledLabStep = {
  type: 'lab',
  id: 'lab',
  concept: 'js.event-loop',
  lab: 'event-loop',
  intro: rich('Step through the loop.'),
  checkpoint: {
    question: rich('Which queue drains first?'),
    difficulty: 2,
    choices: [
      choice('Microtasks', 'Microtasks drain before the next task.', true),
      choice('Tasks', 'A task runs only once the microtask queue is empty.'),
    ],
  },
  fallback: traceStep,
};

interface HarnessProps<S extends CompiledStep> {
  component: ComponentType<StepProps<S>>;
  step: S;
  /** What the player passes once checked: false while a second try is on offer. */
  reveal?: boolean;
  tryNumber?: number;
  seed?: number;
  onSubmission: (submission: Submission | null) => void;
  onGrade: (grade: Grade) => void;
}

/**
 * The part of the player a step talks to: it holds the submission, and Check grades it
 * with the real grader through `toGradable`, as StepRunner does.
 */
function Harness<S extends CompiledStep>({
  component: Component,
  step,
  reveal = true,
  tryNumber,
  seed = 7,
  onSubmission,
  onGrade,
}: HarnessProps<S>) {
  const [submission, setSubmission] = useState<Submission | null>(null);
  const [grade, setGrade] = useState<Grade | null>(null);
  return (
    <>
      <Component
        step={step}
        phase={grade ? 'checked' : 'answering'}
        {...(grade ? { grade } : {})}
        reveal={grade !== null && reveal}
        seed={seed}
        {...(tryNumber === undefined ? {} : { tryNumber })}
        onSubmissionChange={(next) => {
          setSubmission(next);
          onSubmission(next);
        }}
        requestCheck={() => {}}
      />
      <button
        type="button"
        disabled={!submission}
        onClick={() => {
          const gradable = toGradable(step);
          if (!gradable || !submission) return;
          const result = gradeStep(gradable, submission as Answer);
          setGrade(result);
          onGrade(result);
        }}
      >
        Check
      </button>
    </>
  );
}

export function renderStep<S extends CompiledStep>(
  component: ComponentType<StepProps<S>>,
  step: S,
  options: { reveal?: boolean; tryNumber?: number; seed?: number } = {},
) {
  const onSubmission = vi.fn<(submission: Submission | null) => void>();
  const onGrade = vi.fn<(grade: Grade) => void>();
  const view = render(
    <Harness
      component={component}
      step={step}
      onSubmission={onSubmission}
      onGrade={onGrade}
      {...options}
    />,
  );
  return {
    ...view,
    /** The last submission the step reported; undefined when it never reported. */
    submission: () => onSubmission.mock.lastCall?.[0],
    grade: () => onGrade.mock.lastCall?.[0],
  };
}

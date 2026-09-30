import { z } from 'zod';
import { FIGURE_IDS } from './figures';
import { idSchema, localIdSchema, moduleIdSchema } from './ids';
import { PYTHON_PACKAGES } from '../running/python-packages';

/*
 * The lesson contract. One source of truth for:
 *  - the validator that tells an author what is wrong (scripts/validate-content.ts)
 *  - the compiler that emits the JSON bundle for web and iOS (scripts/build-content.ts)
 *  - the JSON Schema in contracts/schemas that the Swift Codable types are checked against
 *
 * Rules that make the bundle portable:
 *  - every object is strict, so a typo in a key is an error, not a silent no-op
 *  - the discriminant is always `type`
 *  - optional fields are omitted, never null
 *  - every step has a stable `id`; progress events point at ids, never at positions
 *  - markdown is a CommonMark subset with no raw HTML, so AttributedString can render it
 *
 * `.describe()` text is the hint the validator prints to an author.
 */

// ---------------------------------------------------------------------------
// Primitives
// ---------------------------------------------------------------------------

const text = (hint: string) => z.string().trim().min(1, hint).describe(hint);

/** Markdown subset: paragraphs, emphasis, inline code, links, lists, fenced code. */
const markdown = (hint: string) => text(hint);

export { idSchema, localIdSchema, moduleIdSchema } from './ids';

export const languageSchema = z.enum([
  'js',
  'ts',
  'jsx',
  'tsx',
  'html',
  'css',
  'sql',
  'json',
  'bash',
  'yaml',
  'http',
  'python',
  'text',
]);

/** Author-seeded difficulty. Item rating is 800 + 200 * d (docs/LEARNING-SCIENCE.md B5). */
const difficulty = z.int().min(1).max(5).describe('Difficulty from 1 (recognise) to 5 (hard).');

const line = z.int().min(1).describe('A 1-based line number in the code above.');

// ---------------------------------------------------------------------------
// Shared pieces
// ---------------------------------------------------------------------------

/**
 * A choice names the misconception behind it. "Wrong." teaches nothing;
 * "`await` in a loop runs in sequence; you predicted parallel." does.
 */
export const choiceSchema = z.strictObject({
  text: markdown('What the learner can pick.'),
  correct: z.boolean().optional().describe('Set true on the right choice only.'),
  feedback: markdown('Shown after the pick. Name the misconception, not only the answer.'),
});

const codeBlock = {
  code: text('The code the step is about. 15 lines or fewer, complete, in a plain realistic setting.'),
  language: languageSchema,
};

/** Fields every scored step carries. */
const scored = {
  id: localIdSchema,
  concept: idSchema.describe('The concept this step gives evidence for.'),
  difficulty,
};

// ---------------------------------------------------------------------------
// Steps
// ---------------------------------------------------------------------------

export const proseStepSchema = z.strictObject({
  type: z.literal('prose'),
  id: localIdSchema,
  body: markdown('One idea. Concrete first. If it needs "and", split the step.'),
  figure: z
    .strictObject({
      id: z.enum(FIGURE_IDS),
      caption: text('One sentence on what to notice in the figure.'),
    })
    .optional()
    .describe('A still figure drawn from a lab engine, for an idea that is spatial.'),
});

export const predictStepSchema = z.strictObject({
  type: z.literal('predict-output'),
  ...scored,
  ...codeBlock,
  question: markdown('What the learner predicts, for example "What does this log?"'),
  choices: z.array(choiceSchema).min(2).max(5),
});

export const multipleChoiceStepSchema = z.strictObject({
  type: z.literal('multiple-choice'),
  ...scored,
  question: markdown('The question. It cannot be answerable without thinking.'),
  code: z.string().optional(),
  language: languageSchema.optional(),
  choices: z.array(choiceSchema).min(2).max(6),
});

export const traceTableStepSchema = z.strictObject({
  type: z.literal('trace-table'),
  ...scored,
  ...codeBlock,
  prompt: markdown('What to trace, for example "Fill in the value of total after each line."'),
  columns: z.array(text('A variable or expression to track.')).min(1).max(4),
  rows: z
    .array(
      z.strictObject({
        line,
        values: z.array(z.string()).describe('One value per column, as the learner would write it.'),
        given: z.boolean().optional().describe('True when the row is shown filled in.'),
      }),
    )
    .min(2)
    .max(10),
});

export const fillBlankStepSchema = z.strictObject({
  type: z.literal('fill-blank'),
  ...scored,
  prompt: markdown('What the finished code must do.'),
  template: text('Code with blanks written as {{1}}, {{2}}.'),
  language: languageSchema,
  blanks: z
    .array(
      z.strictObject({
        key: z.string().regex(/^\d+$/, 'A blank key is the number inside {{ }}.'),
        answer: text('The token that belongs here.'),
        accept: z.array(z.string()).optional().describe('Other tokens that are also right.'),
      }),
    )
    .min(1)
    .max(6),
  bank: z.array(text('A token in the bank.')).min(2).describe('Answers plus distractors.'),
});

export const parsonsStepSchema = z.strictObject({
  type: z.literal('parsons'),
  ...scored,
  prompt: markdown('What the arranged program must do.'),
  language: languageSchema,
  /** Listed in the correct order. The player shuffles them with a seeded RNG. */
  blocks: z
    .array(
      z.strictObject({
        id: localIdSchema,
        code: text('One or more lines that move together.'),
        indent: z.int().min(0).max(6).optional(),
        subgoal: z
          .string()
          .optional()
          .describe('Given subgoal label, for example "Check capacity". Given beats generated.'),
      }),
    )
    .min(3)
    .max(12),
  distractors: z
    .array(
      z.strictObject({
        id: localIdSchema,
        code: text('A plausible line that does not belong.'),
        feedback: markdown('Why it does not belong.'),
      }),
    )
    .max(4)
    .optional(),
  checkIndent: z.boolean().optional(),
});

/** Tap the faulty line, then pick why. Shared by bug-hunt and ai-review. */
const lineHunt = {
  ...scored,
  ...codeBlock,
  prompt: markdown('The symptom or the task the code was meant to do.'),
  lines: z.array(line).min(1).max(3).describe('The line or lines at fault.'),
  reasons: z.array(choiceSchema).min(2).max(5).describe('Why that line is wrong.'),
  fix: z.string().optional().describe('The corrected code, shown after the step.'),
};

export const bugHuntStepSchema = z.strictObject({
  type: z.literal('bug-hunt'),
  ...lineHunt,
});

export const flawClassSchema = z.enum([
  'logic',
  'race',
  'security',
  'hallucinated-api',
  'edge-case',
  'performance',
]);

/** Plausible AI-written code with exactly one seeded flaw (Shen and Tamkin 2026). */
export const aiReviewStepSchema = z.strictObject({
  type: z.literal('ai-review'),
  ...lineHunt,
  request: text('What the AI was asked to write, in one sentence.'),
  flawClass: flawClassSchema,
});

export const codeChallengeStepSchema = z.strictObject({
  type: z.literal('code-challenge'),
  ...scored,
  prompt: markdown('What to build. State inputs, outputs and one example.'),
  language: z
    .enum(['js', 'ts', 'tsx', 'python'])
    .describe(
      'python runs through Pyodide (Python 3.12). tsx is a React component challenge. Name their .py or .tsx files below.',
    ),
  /**
   * Sibling files of lesson.yaml. TypeScript and JavaScript files are linted and
   * type-checked like any source. A Python or tsx step names its files explicitly.
   */
  starter: z.string().default('starter.ts'),
  solution: z.string().default('solution.ts'),
  tests: z.string().default('tests.ts'),
  /** Assessment scoring (docs/INTERVIEWS.md): tests the learner never sees, one verdict each. */
  hidden: z
    .string()
    .optional()
    .describe('Correctness tests the learner never sees, run one at a time on submit.'),
  performance: z
    .string()
    .optional()
    .describe('Large-input tests, each run alone within timeLimitMs. Needs hidden.'),
  timeLimitMs: z
    .int()
    .min(200)
    .max(10_000)
    .optional()
    .describe('The time budget of each performance test. Default 2000.'),
  bruteForce: z
    .string()
    .optional()
    .describe(
      'A correct but slow solution. The gate checks it passes hidden and fails performance.',
    ),
  // Documented in docs/CONTENT-GUIDE.md, "Type checking", and not with .describe(): this
  // schema ships with every lesson page, and the lesson route has no bytes to spare.
  /** ts only, on unless false: type errors show as the learner types and fail the run. */
  typecheck: z.boolean().optional(),
  /** The starter's type error is the task. The gate requires one and lets it pass the tests. */
  expectStarterTypeError: z.boolean().optional(),
  /** python only: numpy, pandas or pydantic, exactly those the files import. */
  packages: z.array(z.enum(PYTHON_PACKAGES)).min(1).max(PYTHON_PACKAGES.length).optional(),
  /**
   * Starter lines the learner edits, as "5-9" or "5". The lines around them are locked in
   * the editor, so a phone shows only what the task is about. docs/CONTENT-GUIDE.md.
   */
  editable: z.string().optional(),
  hints: z
    .array(markdown('A hint.'))
    .length(3, 'A hint ladder has three rungs: where to look, what to notice, the first step.'),
  /**
   * The same challenge in a second language, so a learner practises it in either. The
   * prompt, hints and scoring are shared; the files and their runtime differ. The player
   * offers a switch and remembers the learner's choice. docs/CONTENT-GUIDE.md.
   */
  twin: z
    .strictObject({
      language: z.enum(['js', 'ts', 'python']),
      starter: z.string(),
      solution: z.string(),
      tests: z.string(),
      packages: z.array(z.enum(PYTHON_PACKAGES)).min(1).max(PYTHON_PACKAGES.length).optional(),
      editable: z.string().optional(),
    })
    .optional(),
});

export const explainBackStepSchema = z.strictObject({
  type: z.literal('explain-back'),
  ...scored,
  prompt: markdown('Ask for a cause, not a definition: "Why does ... happen?"'),
  rubric: z
    .array(text('One point a good explanation makes.'))
    .length(3, 'The rubric has three points. The self-grade is how many were made.'),
  modelAnswer: markdown('A good explanation in under 80 words.'),
});

/** The sources a playground can hold: a web page's three, and a React component file. */
export const playgroundFieldSchema = z.enum(['html', 'css', 'js', 'jsx']);

/**
 * Something a check does to a fresh render before it looks, as a learner would: click
 * the first match, or type into the first matching field one character at a time.
 */
export const playgroundActionSchema = z.union([
  z.strictObject({ click: text('A CSS selector. The first match is clicked.') }),
  z.strictObject({
    type: z.string().min(1).max(200).describe('The text to type, one character at a time.'),
    into: text('A CSS selector of an input or textarea. The first match gets the text.'),
  }),
]);

/**
 * One item of a playground's checklist, judged against the live page (src/core/playground).
 * A bare selector passes when anything matches. Every other key narrows it, and all of
 * them look at the first match.
 */
export const playgroundCheckSchema = z.strictObject({
  label: text('What the learner sees in the checklist, for example "The page has one h1".'),
  selector: text('A CSS selector, for example "h1" or "img[alt]".'),
  count: z
    .int()
    .min(0)
    .max(100)
    .optional()
    .describe('The exact number of matches. Without it, at least one must match.'),
  text: text('Words the first match contains, compared trimmed and ignoring case.').optional(),
  attribute: z
    .strictObject({
      name: text('The attribute name, for example "alt".'),
      value: z.string().optional().describe('The exact value. Without it, the attribute must exist.'),
    })
    .optional(),
  style: z
    .strictObject({
      property: text('A CSS property, for example "color".'),
      value: text('The computed value, as a browser reports it: a colour in its rgb form, a length in px.'),
    })
    .optional()
    .describe('A computed style of the first match. Layout sizes such as width are not checked.'),
  actions: z
    .array(playgroundActionSchema)
    .min(1)
    .max(10)
    .optional()
    .describe('Clicks and typing, run in order on a fresh render before the check looks. React playgrounds only.'),
});

/**
 * Edit a real page and watch it render. With checks it is scored like any produce step;
 * without, it is a sandbox to explore, with a Continue button. Which keys are needed
 * together (a concept, a difficulty and a solution for checks) is a validator rule, so the
 * author gets a sentence rather than a union error.
 */
export const playgroundStepSchema = z.strictObject({
  type: z.literal('playground'),
  id: localIdSchema,
  concept: idSchema.optional().describe('The concept this step gives evidence for. Needed with checks.'),
  difficulty: difficulty.optional(),
  prompt: markdown('What to change, and what to watch in the page.'),
  html: z
    .string()
    .optional()
    .describe('The starting HTML: a body fragment or a whole document. Needed without jsx.'),
  css: z.string().optional().describe('The starting CSS. With it, the learner gets a CSS tab.'),
  js: z
    .string()
    .optional()
    .describe('The starting JavaScript, run after the HTML. Scripts run only when it is present.'),
  jsx: z
    .string()
    .optional()
    .describe('A React component file, JSX or TSX. Its default export is rendered into #root.'),
  editable: z
    .array(playgroundFieldSchema)
    .min(1)
    .optional()
    .describe('What the learner may edit. Default: every field the step has.'),
  showTree: z.boolean().optional().describe('Show the live DOM tree next to the page.'),
  checks: z
    .array(playgroundCheckSchema)
    .min(1)
    .max(8)
    .optional()
    .describe('The checklist. With checks the step is scored.'),
  solution: z
    .strictObject({
      html: z.string().optional(),
      css: z.string().optional(),
      js: z.string().optional(),
      jsx: z.string().optional(),
    })
    .optional()
    .describe('The finished fields. Needed with checks; the gate runs the checks on it.'),
  hints: z.array(markdown('A hint.')).min(1).max(3).optional(),
});

/**
 * How a sql step judges an answer: against the solution's result on the same fresh
 * database (src/core/sql/verdict.ts). With it, the step is scored.
 */
export const sqlChecksSchema = z.strictObject({
  ordered: z.boolean().optional().describe('Compare row order too. Default false.'),
  query: z
    .string()
    .trim()
    .min(1)
    .optional()
    .describe('Compare what this query returns after the SQL, for a step that changes rows.'),
});

/**
 * Write SQL against a small seeded Postgres database and see each statement's result
 * live (src/core/sql, docs/CONTENT-GUIDE.md "SQL steps"). With checks it is scored like
 * any produce step; without, it is a database to explore. As with a playground, the keys
 * needed together (a concept, a difficulty and a solution for checks) are validator rules.
 * The descriptions are short on purpose: this module ships on the lesson route.
 */
export const sqlStepSchema = z.strictObject({
  type: z.literal('sql'),
  id: localIdSchema,
  concept: idSchema.optional().describe('The concept this step gives evidence for. Needed with checks.'),
  difficulty: difficulty.optional(),
  prompt: markdown('What to find or change.'),
  setup: z.string().optional().describe('Tables and seed rows, run fresh before every attempt.'),
  starter: z.string().optional().describe('The SQL the editor starts with.'),
  solution: z.string().optional().describe('SQL that gives the right result. Needed with checks.'),
  checks: sqlChecksSchema.optional().describe('With checks the step is scored.'),
  showSchema: z.boolean().optional().describe('Show the tables beside the editor.'),
  hints: z.array(markdown('A hint.')).min(1).max(3).optional(),
});

export const recallCardSchema = z.strictObject({
  id: localIdSchema,
  concept: idSchema,
  front: markdown('A question that needs a produced answer, not a yes or no.'),
  back: markdown('The answer, in one or two sentences.'),
});

/** Steps that any client can render. A lab or incident falls back to one of these. */
const portableStepSchema = z.discriminatedUnion('type', [
  proseStepSchema,
  predictStepSchema,
  multipleChoiceStepSchema,
  traceTableStepSchema,
  fillBlankStepSchema,
  parsonsStepSchema,
  bugHuntStepSchema,
  aiReviewStepSchema,
  codeChallengeStepSchema,
  explainBackStepSchema,
]);

export const labStepSchema = z.strictObject({
  type: z.literal('lab'),
  id: localIdSchema,
  concept: idSchema,
  lab: z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/).describe('The lab widget id, for example "event-loop-stepper".'),
  intro: markdown('What to try and what to watch for.'),
  preset: z.record(z.string(), z.unknown()).optional().describe('Starting state for the lab.'),
  checkpoint: z
    .strictObject({
      question: markdown('A question the lab lets the learner answer.'),
      choices: z.array(choiceSchema).min(2).max(5),
      difficulty,
    })
    .optional(),
  fallback: portableStepSchema.describe('Shown by clients that do not have this lab.'),
});

export const incidentStepSchema = z.strictObject({
  type: z.literal('incident'),
  id: localIdSchema,
  concept: idSchema,
  difficulty,
  incident: z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/).describe('The incident scenario id.'),
  fallback: portableStepSchema,
});

export const stepSchema = z.discriminatedUnion('type', [
  ...portableStepSchema.options,
  labStepSchema,
  incidentStepSchema,
  playgroundStepSchema,
  sqlStepSchema,
]);

// ---------------------------------------------------------------------------
// References
// ---------------------------------------------------------------------------

export const referenceSchema = z.strictObject({
  kind: z.enum(['paper', 'spec', 'rfc', 'book', 'essay', 'docs', 'talk', 'source']),
  title: text('The title as published.'),
  authors: z.string().optional(),
  year: z.int().min(1940).max(2100).optional(),
  venue: z.string().optional().describe('Journal, conference, publisher or site.'),
  url: z.url().optional(),
  note: z.string().optional().describe('One line on why to read it.'),
  primary: z.boolean().optional().describe('True for the one or two readings that matter most.'),
  /** Citations are checked by a person before they ship (docs/CONTENT-GUIDE.md). */
  verified: z.boolean().default(false),
});

// ---------------------------------------------------------------------------
// Lesson, module, course
// ---------------------------------------------------------------------------

/** Neutral voice, no cast: what the learner will be able to do and why they would want to. */
export const openingSchema = z.strictObject({
  text: text('What the learner will be able to do and why it matters, in two short sentences.'),
});

export const lessonSchema = z.strictObject({
  id: idSchema,
  title: text('The lesson title. A noun phrase.'),
  objective: text('What the learner can do afterwards, starting with a verb.'),
  level: z.enum(['essential', 'advanced']),
  minutes: z
    .int()
    .min(3)
    .max(180)
    .describe('How long it takes. More than 60 only for an assessment, where it is the time limit.'),
  assessment: z
    .literal(true)
    .optional()
    .describe(
      'A timed assessment: prose briefs and 1 to 3 code challenges with hidden tests, scored on submit.',
    ),
  concepts: z.array(idSchema).min(1).describe('Concepts this lesson teaches, defined in module.yaml.'),
  prerequisites: z.array(idSchema).default([]).describe('Lesson ids. Advice, never a lock.'),
  opening: openingSchema,
  steps: z.array(stepSchema).min(4),
  recap: z
    .array(markdown('One thing the learner can now do, in one short sentence.'))
    .length(3)
    .optional()
    .describe('Three lines shown on the summary screen (docs/WRITING-GUIDE.md, rule 25).'),
  recall: z.array(recallCardSchema).min(3).max(5),
  references: z.array(referenceSchema).min(1),
  deepDive: markdown('Optional depth below the fold. Never needed for the scored steps.').optional(),
});

export const conceptSchema = z.strictObject({
  id: idSchema,
  title: text('The concept name, as the spec names it.'),
  summary: text('One sentence.'),
  confusableWith: z
    .array(idSchema)
    .optional()
    .describe('Concepts learners mix up with this one. Practice interleaves them.'),
});

export const moduleSchema = z.strictObject({
  id: moduleIdSchema,
  number: z.int().min(0).max(99),
  title: text('The module title.'),
  summary: text('One or two sentences.'),
  why: text('One sentence on why this chapter matters.'),
  youCanBuild: text('What the learner can build after the chapter.'),
  lab: z.string().optional().describe('The signature lab of this module.'),
  concepts: z.array(conceptSchema).min(1),
});

/** A small project that uses the skills of one part. */
export const capstoneSchema = z.strictObject({
  title: text('The project, as a noun phrase.'),
  brief: text('What to build, in a short paragraph of plain text. It draws on the modules of the part.'),
});

/**
 * A stretch of the journey: a few modules with a checkpoint and a capstone at the end. The
 * id is one lowercase word, like a module id, because the capstone and test-out events name
 * a part in the same field as a module. The validator keeps the two sets of ids apart.
 */
export const partSchema = z.strictObject({
  id: moduleIdSchema.describe('One lowercase word that is not a module id, for example "firstcode".'),
  title: text('The part title.'),
  summary: text('One sentence: what the learner can do after this part.'),
  modules: z
    .array(moduleIdSchema)
    .min(1)
    .describe('Module ids, in course order. Woven modules belong to no part.'),
  capstone: capstoneSchema,
});

/** `content/course/course.yaml`. There is one course, so it needs no id. */
export const courseSchema = z.strictObject({
  title: text('The course title.'),
  summary: text('One or two sentences.'),
  parts: z
    .array(partSchema)
    .optional()
    .describe('The course in parts, in course order. Every module that is not woven is in one.'),
});

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type Choice = z.infer<typeof choiceSchema>;
export type Step = z.infer<typeof stepSchema>;
export type PortableStep = z.infer<typeof portableStepSchema>;
export type StepType = Step['type'];
export type ProseStep = z.infer<typeof proseStepSchema>;
export type PredictStep = z.infer<typeof predictStepSchema>;
export type MultipleChoiceStep = z.infer<typeof multipleChoiceStepSchema>;
export type TraceTableStep = z.infer<typeof traceTableStepSchema>;
export type FillBlankStep = z.infer<typeof fillBlankStepSchema>;
export type ParsonsStep = z.infer<typeof parsonsStepSchema>;
export type BugHuntStep = z.infer<typeof bugHuntStepSchema>;
export type AiReviewStep = z.infer<typeof aiReviewStepSchema>;
export type CodeChallengeStep = z.infer<typeof codeChallengeStepSchema>;
export type ExplainBackStep = z.infer<typeof explainBackStepSchema>;
export type LabStep = z.infer<typeof labStepSchema>;
export type IncidentStep = z.infer<typeof incidentStepSchema>;
export type PlaygroundStep = z.infer<typeof playgroundStepSchema>;
export type PlaygroundCheck = z.infer<typeof playgroundCheckSchema>;
export type PlaygroundField = z.infer<typeof playgroundFieldSchema>;
export type PlaygroundAction = z.infer<typeof playgroundActionSchema>;
export type SqlStep = z.infer<typeof sqlStepSchema>;
export type SqlStepChecks = z.infer<typeof sqlChecksSchema>;
export type RecallCard = z.infer<typeof recallCardSchema>;
export type Reference = z.infer<typeof referenceSchema>;
export type Lesson = z.infer<typeof lessonSchema>;
export type Concept = z.infer<typeof conceptSchema>;
export type Module = z.infer<typeof moduleSchema>;
export type Course = z.infer<typeof courseSchema>;
export type Part = z.infer<typeof partSchema>;
export type Capstone = z.infer<typeof capstoneSchema>;
export type Language = z.infer<typeof languageSchema>;

export { FORMAT_FAMILY, type FormatFamily } from './family';

/**
 * The fields a playground has, in tab order: the component first, then the page. HTML is
 * always there unless a component draws the page.
 */
export function playgroundFields(step: {
  html?: string;
  css?: string;
  js?: string;
  jsx?: string;
}): PlaygroundField[] {
  return (['jsx', 'html', 'css', 'js'] as const).filter(
    (field) =>
      step[field] !== undefined || (field === 'html' && step.jsx === undefined),
  );
}

/** The fields a playground lets the learner edit: the ones listed, or every one it has. */
export function editableFields(step: {
  html?: string;
  css?: string;
  js?: string;
  jsx?: string;
  editable?: readonly PlaygroundField[];
}): PlaygroundField[] {
  if (step.editable) return [...step.editable];
  return playgroundFields(step);
}

/**
 * Steps that need a keyboard. Phone sessions leave them out. A playground is not one: its
 * edits are a word or a tag, and seeing a page render is the point on a phone too. Nor is
 * a sql step: a query is a line or two, and its result table is made for a phone.
 */
export const NEEDS_TYPING: ReadonlySet<StepType> = new Set(['code-challenge']);

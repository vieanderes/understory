import { z } from 'zod';
import { argSpecSchema } from './generate';
import { TASK_LANGUAGES } from './signature';
import { VALUE_TYPES } from './values';

/*
 * The authoring contract for the online-test simulator (docs/ONLINE-TEST.md, "Authoring"):
 * one folder per task under content/online-tests/tasks/, one file per preset test under
 * content/online-tests/tests/, and the compiled shapes the app reads from the bundle.
 * Strict objects throughout, so a typo in a key is an error, as in lesson files.
 */

const text = (hint: string) => z.string().trim().min(1, hint).describe(hint);
const slug = z
  .string()
  .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'lower-case words joined by hyphens')
  .describe('A stable id: lower-case words joined by hyphens.');

/** The platform's lesson families. Tasks are original; the families are the syllabus. */
export const TOPICS = [
  'iterations',
  'arrays',
  'time-complexity',
  'counting-elements',
  'prefix-sums',
  'sorting',
  'stacks-and-queues',
  'leader',
  'maximum-slice',
  'prime-and-composite',
  'sieve',
  'euclidean',
  'fibonacci',
  'binary-search',
  'caterpillar',
  'greedy',
  'dynamic-programming',
  'strings',
] as const;

export const TOPIC_LABEL: Record<(typeof TOPICS)[number], string> = {
  iterations: 'Iterations',
  arrays: 'Arrays',
  'time-complexity': 'Time complexity',
  'counting-elements': 'Counting elements',
  'prefix-sums': 'Prefix sums',
  sorting: 'Sorting',
  'stacks-and-queues': 'Stacks and queues',
  leader: 'Leader',
  'maximum-slice': 'Maximum slice',
  'prime-and-composite': 'Prime and composite numbers',
  sieve: 'Sieve of Eratosthenes',
  euclidean: 'Euclidean algorithm',
  fibonacci: 'Fibonacci numbers',
  'binary-search': 'Binary search',
  caterpillar: 'Caterpillar method',
  greedy: 'Greedy algorithms',
  'dynamic-programming': 'Dynamic programming',
  strings: 'Strings',
};

const valueSchema = z.union([
  z.number().int(),
  z.boolean(),
  z.string(),
  z.array(z.number().int()),
  z.array(z.string()),
  z.array(z.array(z.number().int())),
]);

const literalCaseSchema = z.strictObject({
  args: z.array(valueSchema).describe('The arguments, in the order of the signature.'),
  expected: valueSchema
    .optional()
    .describe('What the function returns. Optional: the reference solution computes it.'),
});

const generatedCaseSchema = z.strictObject({
  generate: z.strictObject({
    seed: z.number().int().min(0).max(0xffffffff),
    args: z.array(argSpecSchema).min(1),
  }),
});

export const caseSchema = z.union([literalCaseSchema, generatedCaseSchema]);
export type AuthoredCase = z.infer<typeof caseSchema>;

export const testGroupSchema = z.enum(['correctness', 'performance']);

export const authoredTestSchema = z.strictObject({
  name: z
    .string()
    .regex(/^[a-z0-9_]+$/, 'snake_case, like the platform: extreme_single, large_random')
    .describe('The platform names tests in snake_case: extreme_single, small_random.'),
  description: text('One short line: what the test checks, and N for a large one.'),
  group: testGroupSchema,
  cases: z.array(caseSchema).min(1).max(20),
});

export const taskFileSchema = z.strictObject({
  id: slug,
  title: z
    .string()
    .regex(/^[A-Z][A-Za-z0-9]+$/, 'One CamelCase word, like the platform: MissingInteger')
    .describe('One CamelCase word, as the platform names its tasks. Original, never theirs.'),
  topic: z.enum(TOPICS),
  difficulty: z.enum(['easy', 'medium', 'hard']),
  type: z.enum(['algorithmic', 'coding', 'bug-fix']),
  recommendedMinutes: z.number().int().min(5).max(120),
  maxChangedLines: z.number().int().min(1).max(10).optional(),
  signature: z.strictObject({
    params: z
      .array(
        z.strictObject({
          name: z.string().regex(/^[A-Z][A-Za-z0-9]*$/, 'A capital, like the platform: A, N, K'),
          type: z.enum(VALUE_TYPES),
        }),
      )
      .min(1)
      .max(4),
    returns: z.enum(VALUE_TYPES),
  }),
  statement: text('Markdown in the platform structure, with a {{signature}} line.'),
  examples: z.array(literalCaseSchema).min(1).max(5),
  /** Per performance case in JavaScript. Python gets PYTHON_TIME_FACTOR times this. */
  timeLimitMs: z.number().int().min(100).max(10_000).optional(),
  tests: z.array(authoredTestSchema).min(1),
});
export type TaskFile = z.infer<typeof taskFileSchema>;

export const presetFileSchema = z.strictObject({
  id: slug,
  title: text('Plain: what the test is, such as "Short screen: two tasks".'),
  summary: text('One line on what the test rehearses.'),
  mode: z.enum(['demo', 'screen', 'ai', 'mock']),
  order: z.number().int().min(0),
  minutes: z.number().int().min(10).max(180),
  tasks: z.array(slug).min(1).max(4),
  languages: z.array(z.enum(TASK_LANGUAGES)).min(1).optional(),
  assistant: z.boolean(),
  proctoring: z.boolean(),
});
export type PresetFile = z.infer<typeof presetFileSchema>;

// ---- Compiled -------------------------------------------------------------------------

const expectedSchema = z.strictObject({ hash: z.string(), preview: z.string() });

export const compiledTestSchema = z.strictObject({
  name: z.string(),
  description: z.string(),
  group: z.enum(['correctness', 'performance']),
  cases: z.array(
    z.strictObject({
      input: z.union([
        z.strictObject({ args: z.array(valueSchema) }),
        z.strictObject({ generate: generatedCaseSchema.shape.generate }),
      ]),
      expected: expectedSchema,
    }),
  ),
});

export const compiledTaskSchema = z.strictObject({
  id: z.string(),
  title: z.string(),
  topic: z.enum(TOPICS),
  difficulty: z.enum(['easy', 'medium', 'hard']),
  type: z.enum(['algorithmic', 'coding', 'bug-fix']),
  recommendedMinutes: z.number(),
  maxChangedLines: z.number().optional(),
  signature: taskFileSchema.shape.signature,
  /** Rendered markdown. `<span data-signature></span>` marks where the signature goes. */
  statementHtml: z.string(),
  starters: z.strictObject({ js: z.string(), ts: z.string(), python: z.string() }),
  examples: z.array(
    z.strictObject({ args: z.array(valueSchema), expected: valueSchema, expectedHash: z.string() }),
  ),
  tests: z.array(compiledTestSchema),
  timeLimitMs: z.number(),
});
export type CompiledTask = z.infer<typeof compiledTaskSchema>;
export type CompiledTest = z.infer<typeof compiledTestSchema>;
export type CompiledCase = CompiledTest['cases'][number];

export const compiledPresetSchema = presetFileSchema.extend({
  languages: z.array(z.enum(TASK_LANGUAGES)).min(1),
});
export type CompiledPreset = z.infer<typeof compiledPresetSchema>;

export const onlineTestIndexSchema = z.strictObject({
  presets: z.array(compiledPresetSchema),
  tasks: z.array(
    z.strictObject({
      id: z.string(),
      title: z.string(),
      topic: z.enum(TOPICS),
      difficulty: z.enum(['easy', 'medium', 'hard']),
      type: z.enum(['algorithmic', 'coding', 'bug-fix']),
      recommendedMinutes: z.number(),
      /** A step-by-step guide exists for guided mode. */
      guided: z.boolean(),
    }),
  ),
});
export type OnlineTestIndex = z.infer<typeof onlineTestIndexSchema>;

export const solutionsFileSchema = z.record(
  z.string(),
  z.strictObject({ js: z.string(), ts: z.string(), python: z.string() }),
);

/** Where the placeholder sits in statementHtml. */
export const SIGNATURE_SLOT = '<span data-signature></span>';

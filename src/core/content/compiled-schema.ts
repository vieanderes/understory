import * as z from '@/core/zod';
import type {
  CompiledCapstoneSolution,
  CompiledGuide,
  CompiledLectureExtras,
  CompiledLesson,
  CompiledSolutions,
  CompiledStep,
  Manifest,
} from './compiled';
import {
  aiReviewStepSchema,
  bugHuntStepSchema,
  codeChallengeStepSchema,
  conceptSchema,
  explainBackStepSchema,
  fillBlankStepSchema,
  idSchema,
  incidentStepSchema,
  labStepSchema,
  languageSchema,
  lessonSchema,
  localIdSchema,
  moduleSchema,
  multipleChoiceStepSchema,
  parsonsStepSchema,
  partSchema,
  playgroundFieldSchema,
  playgroundStepSchema,
  predictStepSchema,
  proseStepSchema,
  sqlStepSchema,
  stepSchema,
  traceTableStepSchema,
} from './schema';
import { VERIFY_LENSES } from './lenses';

/*
 * Runtime mirror of compiled.ts, used for two things: the JSON Schema that the iOS client
 * is checked against (contracts/schemas), and a parse of bundle files where they are read
 * from disk. Each compiled step extends its authoring schema, so a field added to a step
 * reaches the bundle contract without being typed twice.
 */

const html = z.string().describe('HTML rendered at build time. Colours are CSS variables.');

export const richSchema = z.strictObject({ md: z.string(), html });

export const compiledChoiceSchema = z.strictObject({
  text: richSchema,
  correct: z.boolean().optional(),
  feedback: richSchema,
});

const choices = z.array(compiledChoiceSchema).min(2);

const compiledProse = proseStepSchema.extend({ body: richSchema });

const compiledPredict = predictStepSchema.extend({
  codeHtml: html,
  question: richSchema,
  choices,
});

const compiledMultipleChoice = multipleChoiceStepSchema.extend({
  codeHtml: html.optional(),
  question: richSchema,
  choices,
});

const compiledTraceTable = traceTableStepSchema.extend({ codeHtml: html, prompt: richSchema });

const compiledFillBlank = fillBlankStepSchema.extend({ prompt: richSchema, templateHtml: html });

const compiledParsons = parsonsStepSchema.extend({
  prompt: richSchema,
  blocks: z.array(parsonsStepSchema.shape.blocks.element.extend({ codeHtml: html })),
  distractors: z
    .array(
      z.strictObject({ id: localIdSchema, code: z.string(), codeHtml: html, feedback: richSchema }),
    )
    .optional(),
});

const lineHunt = {
  codeHtml: html,
  prompt: richSchema,
  reasons: choices,
  fixHtml: html.optional(),
  verify: z
    .strictObject({ question: richSchema, choices: z.array(compiledChoiceSchema).min(2).max(4) })
    .optional(),
};

const compiledBugHunt = bugHuntStepSchema.extend(lineHunt);
const compiledAiReview = aiReviewStepSchema.extend(lineHunt);

const compiledCodeChallenge = codeChallengeStepSchema
  .omit({
    starter: true,
    solution: true,
    tests: true,
    hidden: true,
    performance: true,
    bruteForce: true,
    expectStarterTypeError: true,
  })
  .extend({
    prompt: richSchema,
    starterCode: z.string(),
    starterHtml: html,
    testsCode: z.string(),
    hiddenCode: z.string().optional(),
    performanceCode: z.string().optional(),
    // Resolved by the build: present only when the step is type-checked.
    typecheck: z.literal(true).optional(),
    hints: z.array(richSchema).length(3),
    twin: codeChallengeStepSchema.shape.twin
      .unwrap()
      .omit({ starter: true, solution: true, tests: true })
      .extend({
        starterCode: z.string(),
        starterHtml: html,
        testsCode: z.string(),
        typecheck: z.literal(true).optional(),
      })
      .optional()
      .describe('The same challenge in a second language. Its solution is under "<id>:twin".'),
  });

const compiledExplainBack = explainBackStepSchema.extend({
  prompt: richSchema,
  modelAnswer: richSchema,
});

const compiledPortableStep = z.discriminatedUnion('type', [
  compiledProse,
  compiledPredict,
  compiledMultipleChoice,
  compiledTraceTable,
  compiledFillBlank,
  compiledParsons,
  compiledBugHunt,
  compiledAiReview,
  compiledCodeChallenge,
  compiledExplainBack,
]);

const compiledLab = labStepSchema.extend({
  intro: richSchema,
  checkpoint: z
    .strictObject({
      question: richSchema,
      choices,
      difficulty: z.int().min(1).max(5),
    })
    .optional(),
  fallback: compiledPortableStep,
});

const compiledIncident = incidentStepSchema.extend({ fallback: compiledPortableStep });

const compiledPlayground = playgroundStepSchema.extend({
  prompt: richSchema,
  editable: z.array(playgroundFieldSchema).min(1),
  hints: z.array(richSchema).optional(),
});

const compiledSql = sqlStepSchema.extend({
  prompt: richSchema,
  setup: z.string(),
  starter: z.string(),
  hints: z.array(richSchema).optional(),
});

export const compiledStepSchema = z.discriminatedUnion('type', [
  ...compiledPortableStep.options,
  compiledLab,
  compiledIncident,
  compiledPlayground,
  compiledSql,
]);

/** `placement.json`: the ladder, with each item compiled the way a lesson step is. */
export const compiledPlacementSchema = z.strictObject({
  schema: z.literal(1),
  rungs: z.array(
    z.strictObject({
      rung: z.int(),
      moduleBand: z.array(z.string()),
      concepts: z.array(z.string()),
      items: z.array(
        z.discriminatedUnion('type', [
          compiledPredict,
          compiledMultipleChoice,
          compiledBugHunt.omit({ verify: true }),
        ]),
      ),
    }),
  ),
});

export const compiledLessonSchema = lessonSchema.extend({
  schema: z.literal(1),
  moduleId: moduleSchema.shape.id,
  moduleSlug: z.string(),
  slug: z.string(),
  prerequisites: z.array(idSchema),
  steps: z.array(compiledStepSchema).min(4),
  recap: z.array(richSchema).length(3).optional(),
  recall: z.array(
    z.strictObject({ id: localIdSchema, concept: idSchema, front: richSchema, back: richSchema }),
  ),
  deepDive: richSchema.optional(),
});

export const compiledSolutionsSchema = z.strictObject({
  schema: z.literal(1),
  lessonId: idSchema,
  solutions: z.record(z.string(), z.string()),
});

const compiledCodeSchema = z.strictObject({
  label: z.string().optional(),
  code: z.string(),
  html,
  language: languageSchema,
});

const notesSectionSchema = z.strictObject({ title: richSchema, body: richSchema });

export const compiledLectureExtrasSchema = z.strictObject({
  schema: z.literal(1),
  lessonId: idSchema,
  notes: z
    .strictObject({
      summary: richSchema,
      remember: z.array(richSchema),
      sections: z.array(notesSectionSchema),
      pitfalls: z.array(richSchema).optional(),
      interview: z.array(z.strictObject({ question: richSchema, answer: richSchema })).optional(),
      terms: z
        .array(z.strictObject({ term: z.string(), say: z.string(), means: richSchema }))
        .optional(),
      verify: z
        .array(z.strictObject({ lens: z.enum(VERIFY_LENSES), check: richSchema }))
        .optional(),
    })
    .optional(),
  solutions: z.record(z.string(), z.array(compiledCodeSchema)),
});

export const compiledCapstoneSolutionSchema = z.strictObject({
  schema: z.literal(1),
  partId: partSchema.shape.id,
  summary: richSchema,
  remember: z.array(richSchema),
  sections: z.array(notesSectionSchema),
  checklist: z.array(richSchema),
});

export const compiledGuideSchema = z.strictObject({
  schema: z.literal(1),
  id: z.string(),
  title: z.string(),
  summary: richSchema,
  sections: z.array(notesSectionSchema),
});

const stepTypeSchema = z.enum(stepSchema.options.map((option) => option.shape.type.value));

export const manifestLessonSchema = z.strictObject({
  id: idSchema,
  slug: z.string(),
  title: z.string(),
  objective: z.string(),
  level: lessonSchema.shape.level,
  minutes: z.int(),
  concepts: z.array(idSchema),
  prerequisites: z.array(idSchema),
  stepCount: z.int(),
  stepTypes: z.array(stepTypeSchema),
  needsTyping: z.boolean(),
  assessment: z.literal(true).optional(),
  file: z.string(),
  solutionsFile: z.string().optional(),
  lectureFile: z.string(),
});

export const manifestModuleSchema = z.strictObject({
  id: moduleSchema.shape.id,
  number: z.int(),
  slug: z.string(),
  title: z.string(),
  summary: z.string(),
  why: moduleSchema.shape.why,
  youCanBuild: moduleSchema.shape.youCanBuild,
  lab: z.string().optional(),
  concepts: z.array(conceptSchema),
  lessons: z.array(manifestLessonSchema),
});

export const manifestPartSchema = z.strictObject({
  id: partSchema.shape.id,
  title: z.string(),
  summary: z.string(),
  modules: z.array(moduleSchema.shape.id),
  capstone: z.strictObject({
    title: z.string(),
    brief: z.string(),
    solutionFile: z.string().optional(),
  }),
  lessons: z.array(idSchema),
  concepts: z.array(idSchema),
});

export const manifestSchema = z.strictObject({
  schema: z.literal(1),
  contentRev: z.string().regex(/^[0-9a-f]{12}$/),
  course: z.strictObject({ title: z.string(), summary: z.string() }),
  modules: z.array(manifestModuleSchema),
  parts: z.array(manifestPartSchema),
  guides: z.array(z.strictObject({ id: z.string(), title: z.string(), file: z.string() })),
});

// ---------------------------------------------------------------------------
// Drift check. Each line fails to compile when compiled.ts and the schemas above disagree.
// ---------------------------------------------------------------------------

type Mutual<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;
const same = <T extends true>(): T | undefined => undefined;

same<Mutual<z.infer<typeof compiledStepSchema>, CompiledStep>>();
same<Mutual<z.infer<typeof compiledLessonSchema>, CompiledLesson>>();
same<Mutual<z.infer<typeof compiledSolutionsSchema>, CompiledSolutions>>();
same<Mutual<z.infer<typeof manifestSchema>, Manifest>>();
same<Mutual<z.infer<typeof compiledLectureExtrasSchema>, CompiledLectureExtras>>();
same<Mutual<z.infer<typeof compiledCapstoneSolutionSchema>, CompiledCapstoneSolution>>();
same<Mutual<z.infer<typeof compiledGuideSchema>, CompiledGuide>>();

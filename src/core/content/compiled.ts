import type {
  Concept,
  Language,
  Lesson,
  PlaygroundCheck,
  Reference,
  SqlStepChecks,
  StepType,
} from './schema';
import type { ExplainBackAudience, ExplainBackKind } from './explain-back';
import type { FigureId } from './figures';
import type { VerifyLens } from './lenses';
import type { PythonPackage } from '../running/python-packages';

/*
 * The shapes inside the static bundle (`public/content/v1/`). The web client reads them
 * now and the Swift port mirrors them later, so they are plain data: no classes, no
 * unions without a `type` discriminant, optional fields omitted and never null.
 *
 * A compiled lesson is the authored lesson with two changes:
 *  - every markdown string becomes a `Rich`, so no client needs a markdown parser to show
 *    a lesson, while iOS can still feed `md` to AttributedString
 *  - every code string gains a highlighted sibling (`code` and `codeHtml`), so no
 *    highlighter ships to the browser
 *
 * The zod mirror of these types is compiled-schema.ts. A type-level check there fails the
 * build when the two drift apart.
 */

export const BUNDLE_SCHEMA = 1;

/**
 * `html` is block-level (paragraphs, lists, fences) except for choice text, which is
 * inline because it sits inside a button. Colours in `html` are CSS variables only.
 */
export interface Rich {
  md: string;
  html: string;
}

export interface CompiledChoice {
  text: Rich;
  correct?: boolean;
  feedback: Rich;
}

interface Scored {
  id: string;
  concept: string;
  difficulty: number;
}

/** Each line is a `<span class="line" data-line="n">`, so a client can make lines tappable. */
interface Highlighted {
  code: string;
  codeHtml: string;
  language: Language;
}

export interface CompiledProseStep {
  type: 'prose';
  id: string;
  body: Rich;
  figure?: { id: FigureId; caption: string };
}

export interface CompiledPredictStep extends Scored, Highlighted {
  type: 'predict-output';
  question: Rich;
  choices: CompiledChoice[];
}

export interface CompiledMultipleChoiceStep extends Scored {
  type: 'multiple-choice';
  question: Rich;
  code?: string;
  codeHtml?: string;
  language?: Language;
  choices: CompiledChoice[];
}

export interface CompiledTraceTableStep extends Scored, Highlighted {
  type: 'trace-table';
  prompt: Rich;
  columns: string[];
  rows: { line: number; values: string[]; given?: boolean }[];
}

export interface CompiledFillBlankStep extends Scored {
  type: 'fill-blank';
  prompt: Rich;
  template: string;
  /** Each `{{n}}` is an empty `<span data-blank="n">` for the client to mount a slot in. */
  templateHtml: string;
  language: Language;
  blanks: { key: string; answer: string; accept?: string[] }[];
  bank: string[];
}

export interface CompiledParsonsStep extends Scored {
  type: 'parsons';
  prompt: Rich;
  language: Language;
  blocks: { id: string; code: string; codeHtml: string; indent?: number; subgoal?: string }[];
  distractors?: { id: string; code: string; codeHtml: string; feedback: Rich }[];
  checkIndent?: boolean;
}

interface LineHunt extends Scored, Highlighted {
  prompt: Rich;
  lines: number[];
  reasons: CompiledChoice[];
  fix?: string;
  fixHtml?: string;
  /** A second question, asked with the reason: how to prove the fix. One choice is right. */
  verify?: { question: Rich; choices: CompiledChoice[] };
}

export interface CompiledBugHuntStep extends LineHunt {
  type: 'bug-hunt';
}

export interface CompiledAiReviewStep extends LineHunt {
  type: 'ai-review';
  request: string;
  flawClass:
    | 'logic'
    | 'race'
    | 'security'
    | 'hallucinated-api'
    | 'edge-case'
    | 'performance'
    | 'data-exposure'
    | 'regression';
}

/** The reference solution is not here. It ships in the separate solutions file. */
export interface CompiledCodeChallengeStep extends Scored {
  type: 'code-challenge';
  prompt: Rich;
  language: 'js' | 'ts' | 'tsx' | 'python';
  starterCode: string;
  /** Holds the editor's space before CodeMirror loads. */
  starterHtml: string;
  testsCode: string;
  /** Assessments only. Shipped for offline use, never shown before the attempt is scored. */
  hiddenCode?: string;
  performanceCode?: string;
  /** Per performance test, in milliseconds. */
  timeLimitMs?: number;
  /**
   * Resolved at build time (src/core/typecheck/verdict.ts): present and true when the
   * editor checks types and a run must type-check to pass. Absent means no checking.
   */
  typecheck?: true;
  /** Python only: packages the run loads first (src/core/running/python-packages.ts). */
  packages?: PythonPackage[];
  /** Starter lines the learner edits, as "5-9" (src/core/content/editable.ts). */
  editable?: string;
  hints: Rich[];
  /**
   * The same challenge in a second language (src/core/content/twin.ts). Its solution is in
   * the solutions file under `<id>:twin`, and in the lecture beside the main one.
   */
  twin?: CompiledCodeChallengeTwin;
}

/** A twin's own files and runtime. Prompt, hints, id and scoring are the step's. */
export interface CompiledCodeChallengeTwin {
  language: 'js' | 'ts' | 'python';
  starterCode: string;
  starterHtml: string;
  testsCode: string;
  /** Resolved at build time, as for the main files. */
  typecheck?: true;
  packages?: PythonPackage[];
  editable?: string;
}

export interface CompiledExplainBackStep extends Scored {
  type: 'explain-back';
  prompt: Rich;
  rubric: string[];
  modelAnswer: Rich;
  /** Absent means a teammate (src/core/content/explain-back.ts). */
  audience?: ExplainBackAudience;
  /** Absent means explain: why it happens. */
  kind?: ExplainBackKind;
}

export type CompiledPortableStep =
  | CompiledProseStep
  | CompiledPredictStep
  | CompiledMultipleChoiceStep
  | CompiledTraceTableStep
  | CompiledFillBlankStep
  | CompiledParsonsStep
  | CompiledBugHuntStep
  | CompiledAiReviewStep
  | CompiledCodeChallengeStep
  | CompiledExplainBackStep;

export interface CompiledLabStep {
  type: 'lab';
  id: string;
  concept: string;
  lab: string;
  intro: Rich;
  preset?: Record<string, unknown>;
  checkpoint?: { question: Rich; choices: CompiledChoice[]; difficulty: number };
  fallback: CompiledPortableStep;
}

export interface CompiledIncidentStep extends Scored {
  type: 'incident';
  incident: string;
  fallback: CompiledPortableStep;
}

/**
 * A page to edit and watch. The solution ships inside the lesson, not in the solutions
 * file: it is a few lines of HTML, it must work offline, and it is shown only after a
 * failed attempt. `editable` is resolved at build time, so no client applies the default.
 */
export interface CompiledPlaygroundStep {
  type: 'playground';
  id: string;
  concept?: string;
  difficulty?: number;
  prompt: Rich;
  html?: string;
  css?: string;
  js?: string;
  /** A React component file. Its default export is rendered into `#root`. */
  jsx?: string;
  editable: ('html' | 'css' | 'js' | 'jsx')[];
  showTree?: boolean;
  checks?: PlaygroundCheck[];
  solution?: { html?: string; css?: string; js?: string; jsx?: string };
  hints?: Rich[];
}

/**
 * SQL against a small seeded Postgres database (src/core/sql). The solution ships inside
 * the lesson: the page runs it to get the result a learner's is compared with, offline
 * too. `setup` and `starter` are resolved to '' at build time when absent.
 */
export interface CompiledSqlStep {
  type: 'sql';
  id: string;
  concept?: string;
  difficulty?: number;
  prompt: Rich;
  setup: string;
  starter: string;
  solution?: string;
  checks?: SqlStepChecks;
  showSchema?: boolean;
  hints?: Rich[];
}

export type CompiledStep =
  | CompiledPortableStep
  | CompiledLabStep
  | CompiledIncidentStep
  | CompiledPlaygroundStep
  | CompiledSqlStep;

export interface CompiledRecallCard {
  id: string;
  concept: string;
  front: Rich;
  back: Rich;
}

export interface CompiledLesson {
  schema: typeof BUNDLE_SCHEMA;
  id: string;
  /** Where the lesson lives, so a client can build its URL without the manifest. */
  moduleId: string;
  moduleSlug: string;
  slug: string;
  title: string;
  objective: string;
  level: Lesson['level'];
  minutes: number;
  /** A timed assessment: `minutes` is its time limit. */
  assessment?: true;
  concepts: string[];
  prerequisites: string[];
  opening: Lesson['opening'];
  steps: CompiledStep[];
  /** Three lines on what the learner can now do, for the summary screen. */
  recap?: Rich[];
  recall: CompiledRecallCard[];
  references: Reference[];
  deepDive?: Rich;
}

/** `solutions/<lessonId>.<hash>.json`. Fetched only when the learner asks for a solution. */
export interface CompiledSolutions {
  schema: typeof BUNDLE_SCHEMA;
  lessonId: string;
  /** Step id to reference solution source. A twin's is under `<stepId>:twin`. */
  solutions: Record<string, string>;
}

/** Highlighted source, for reading. `label` names the file of a multi-file solution. */
export interface CompiledCode {
  label?: string;
  code: string;
  html: string;
  language: Language;
}

export interface CompiledNotesSection {
  /** Inline HTML: a heading may hold `code`. */
  title: Rich;
  body: Rich;
}

/** `notes.yaml`, rendered (src/core/content/notes.ts, docs/LECTURE-BRIEF.md). */
export interface CompiledNotes {
  summary: Rich;
  remember: Rich[];
  sections: CompiledNotesSection[];
  pitfalls?: Rich[];
  interview?: { question: Rich; answer: Rich }[];
  /** What people say a term is, and what it actually means. */
  terms?: { term: string; say: string; means: Rich }[];
  /** Before you ship: one inline check per item, each under a lens. */
  verify?: { lens: VerifyLens; check: Rich }[];
}

/**
 * `lectures/<lessonId>.<hash>.json`. Everything a lecture shows that the lesson file does
 * not carry: the notes, and every reference solution highlighted for reading. The lesson
 * player never fetches it, so a solution still cannot leak into a practice session.
 */
export interface CompiledLectureExtras {
  schema: typeof BUNDLE_SCHEMA;
  lessonId: string;
  notes?: CompiledNotes;
  /**
   * Step id to its solution, one entry per file. Code challenges, playgrounds and sql. A
   * challenge with a twin has two entries, each labelled with its language.
   */
  solutions: Record<string, CompiledCode[]>;
}

/** `capstones/<partId>.<hash>.json`: the worked solution of a part's project. */
export interface CompiledCapstoneSolution {
  schema: typeof BUNDLE_SCHEMA;
  partId: string;
  summary: Rich;
  remember: Rich[];
  sections: CompiledNotesSection[];
  /** Inline HTML. */
  checklist: Rich[];
}

/** `guides/<id>.<hash>.json`: a standalone reading that a fast track closes with. */
export interface CompiledGuide {
  schema: typeof BUNDLE_SCHEMA;
  id: string;
  title: string;
  summary: Rich;
  sections: CompiledNotesSection[];
}

export interface ManifestLesson {
  id: string;
  slug: string;
  title: string;
  objective: string;
  level: Lesson['level'];
  minutes: number;
  concepts: string[];
  prerequisites: string[];
  stepCount: number;
  /** Distinct step types, sorted. */
  stepTypes: StepType[];
  /** True when any step needs a keyboard, so a phone session can leave the lesson out. */
  needsTyping: boolean;
  /** A timed assessment: practice lists it with the other mock tests. */
  assessment?: true;
  /** Path relative to the bundle root: `lessons/js.closures.0123456789ab.json`. */
  file: string;
  solutionsFile?: string;
  /** `lectures/<id>.<hash>.json`: what the lecture needs beyond the lesson file. */
  lectureFile: string;
}

export interface ManifestModule {
  id: string;
  number: number;
  slug: string;
  title: string;
  summary: string;
  why: string;
  youCanBuild: string;
  lab?: string;
  concepts: Concept[];
  lessons: ManifestLesson[];
}

/** The one course. Its modules sit beside it in the manifest. */
export interface ManifestCourse {
  title: string;
  summary: string;
}

/**
 * A stretch of the journey with a checkpoint and a capstone at its end. `lessons` and
 * `concepts` are the published ones, in journey order: woven lessons sit where they are
 * taught, in the part of the lesson they follow.
 */
export interface ManifestPart {
  id: string;
  title: string;
  summary: string;
  /** Module ids, in course order. Woven modules are in no part. */
  modules: string[];
  capstone: {
    title: string;
    brief: string;
    /** `capstones/<partId>.<hash>.json`, when a worked solution has been written. */
    solutionFile?: string;
  };
  lessons: string[];
  concepts: string[];
}

export interface Manifest {
  schema: typeof BUNDLE_SCHEMA;
  /** Changes when any lesson changes. Progress events carry it. */
  contentRev: string;
  course: ManifestCourse;
  /** In course order. */
  modules: ManifestModule[];
  /** In course order. Empty for a course with no parts. */
  parts: ManifestPart[];
  /** Standalone readings, by id. */
  guides: { id: string; title: string; file: string }[];
}

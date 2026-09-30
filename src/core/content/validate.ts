import { allLessons, allModules, LOCK_PATH } from './catalog';
import type { Issue, LessonLocation, RawCatalog, RawLesson, Severity } from './catalog';
import { lessonCodeFields, lessonTextFields, withFallbacks } from './fields';
import type { CodeField, TextField } from './fields';
import { diffLock } from './lock';
import { orderOfDir, outlineEntries } from './outline';
import { wovenModuleIds } from './parts';
import type { RawOutline } from './outline';
import { lockedFrame, locateRegion, parseLineRange } from './editable';
import { editableFields } from './schema';
import type { Choice, CodeChallengeStep, Part, PlaygroundField, Step } from './schema';
import { challengeVariants } from './twin';
import { typecheckOf } from '../typecheck/verdict';
import { importedPythonPackages } from '../running/python-packages';
import {
  bannedWordsIn,
  EM_DASH,
  fencesOf,
  hasLevelOneHeading,
  hasRawHtml,
  lineCount,
  MAX_CODE_LINES,
  MAX_SENTENCE_WORDS,
  proseOnly,
  sentencesOf,
  withdrawnSettingTermsIn,
  wordCount,
} from './style';

/*
 * The rules zod cannot express: uniqueness, references between files, answers that agree
 * with their code, and the house style. Pure: it receives parsed objects and returns
 * issues, so the same function serves the CLI, the tests and a future editor plugin.
 *
 * Rules are rows in tables. A row names the rule, fixes its severity and returns findings
 * for one subject (a text field, a step, a lesson or the whole catalog). Adding a rule is
 * adding a row.
 */

interface Finding {
  where?: string;
  message: string;
}

interface Rule<Subject> {
  rule: string;
  severity: Severity;
  check: (subject: Subject, index: CatalogIndex) => Finding[];
}

/** Lookups built once per run, so reference rules stay linear. */
interface CatalogIndex {
  /** Concept id to the id of the module that defines it. */
  conceptModule: ReadonlyMap<string, string>;
  lessonIds: ReadonlySet<string>;
}

const plural = (n: number, word: string): string => `${n} ${word}${n === 1 ? '' : 's'}`;

function duplicates(values: readonly string[]): string[] {
  const seen = new Set<string>();
  const twice = new Set<string>();
  for (const value of values) (seen.has(value) ? twice : seen).add(value);
  return [...twice];
}

// ---------------------------------------------------------------------------
// Text rules: run on every author-written string, found by the one walker
// ---------------------------------------------------------------------------

const at = (field: TextField | CodeField, message: string): Finding => ({
  where: field.where,
  message: `${field.field}: ${message}`,
});

const isMarkdown = (field: TextField): boolean => field.kind !== 'plain';

const TEXT_RULES: Rule<TextField>[] = [
  {
    rule: 'markdown-html',
    severity: 'error',
    check: (f) =>
      isMarkdown(f) && hasRawHtml(f.text)
        ? [at(f, 'HTML tags are not allowed. Use markdown, or put the tag in backticks if it is code.')]
        : [],
  },
  {
    rule: 'markdown-h1',
    severity: 'error',
    check: (f) =>
      isMarkdown(f) && hasLevelOneHeading(f.text)
        ? [at(f, 'A "#" heading is not allowed, because the lesson title is the only level-1 heading. Use "##".')]
        : [],
  },
  {
    rule: 'markdown-inline-block',
    severity: 'error',
    check: (f) =>
      f.kind === 'inline' && (/\n\s*\n/.test(f.text) || fencesOf(f.text).length > 0)
        ? [at(f, 'This text sits inside a button, so it must be one paragraph with no code fence.')]
        : [],
  },
  {
    rule: 'style-banned-word',
    severity: 'warning',
    check: (f) =>
      bannedWordsIn(f.text).map((word) =>
        at(f, `Remove "${word}". It adds no meaning (docs/CONTENT-GUIDE.md, style rule 4).`),
      ),
  },
  {
    rule: 'style-exclamation',
    severity: 'warning',
    check: (f) =>
      proseOnly(f.text).includes('!') ? [at(f, 'Replace the exclamation mark with a full stop.')] : [],
  },
  {
    rule: 'style-em-dash',
    severity: 'warning',
    check: (f) =>
      f.text.includes(EM_DASH)
        ? [at(f, 'Replace the em-dash with a comma, a colon or two sentences.')]
        : [],
  },
  {
    rule: 'style-long-sentence',
    severity: 'warning',
    check: (f) =>
      sentencesOf(f.text)
        .map(wordCount)
        .filter((words) => words > MAX_SENTENCE_WORDS)
        .map((words) =>
          at(f, `A sentence has ${words} words. Split it so each has ${MAX_SENTENCE_WORDS} or fewer.`),
        ),
  },
  {
    rule: 'code-too-long',
    severity: 'warning',
    check: (f) =>
      fencesOf(f.text)
        .filter((fence) => fence.lines > MAX_CODE_LINES)
        .map((fence) => at(f, tooLong(fence.lines))),
  },
];

const tooLong = (lines: number): string =>
  `The code has ${lines} lines. Cut it to ${MAX_CODE_LINES} or fewer, so it fits a phone screen.`;

const CODE_RULES: Rule<CodeField>[] = [
  {
    rule: 'code-too-long',
    severity: 'warning',
    check: (f) => (lineCount(f.code) > MAX_CODE_LINES ? [at(f, tooLong(lineCount(f.code)))] : []),
  },
];

// ---------------------------------------------------------------------------
// Step rules
// ---------------------------------------------------------------------------

/** Every list in a step where exactly one entry is the right answer. */
function choiceLists(step: Step): { field: string; choices: readonly Choice[] }[] {
  switch (step.type) {
    case 'predict-output':
    case 'multiple-choice':
      return [{ field: 'choices', choices: step.choices }];
    case 'bug-hunt':
    case 'ai-review':
      return [{ field: 'reasons', choices: step.reasons }];
    case 'lab':
      return step.checkpoint ? [{ field: 'checkpoint.choices', choices: step.checkpoint.choices }] : [];
    default:
      return [];
  }
}

/** Line numbers a step points at, with the code they point into. */
function lineReferences(step: Step): { code: string; lines: number[] } | undefined {
  if (step.type === 'bug-hunt' || step.type === 'ai-review') return step;
  if (step.type === 'trace-table') return { code: step.code, lines: step.rows.map((r) => r.line) };
  return undefined;
}

const templateKeys = (template: string): string[] =>
  [...template.matchAll(/\{\{(\d+)\}\}/g)].flatMap((match) => (match[1] ? [match[1]] : []));

/** Letters, digits, dots and hyphens only, so a step can never read outside its folder. */
const SAFE_FILE_NAME = /^[a-z0-9][a-z0-9.-]*\.(ts|tsx|js|py)$/;
export const isSafeFileName = (name: string): boolean => SAFE_FILE_NAME.test(name);

/** A Python challenge runs .py files; JavaScript and TypeScript run .ts and .js files. */
type ChallengeLanguage = 'js' | 'ts' | 'tsx' | 'python';

/** The extension of a challenge file's name, without the dot. */
const extensionOf = (name: string): string => name.slice(name.lastIndexOf('.') + 1);

/**
 * Each language has its own extension: .py for Python, .tsx for tsx (JSX only parses
 * there, for the type-checker and the editor alike), .ts or .js otherwise.
 */
const fitsLanguage = (name: string, language: ChallengeLanguage): boolean => {
  const extension = extensionOf(name);
  if (language === 'python') return extension === 'py';
  if (language === 'tsx') return extension === 'tsx';
  return extension === 'ts' || extension === 'js';
};

function languageMismatch(name: string, language: ChallengeLanguage): string {
  if (language === 'python') {
    return `"${name}" is not a Python file. A Python challenge names its files in the step, because the defaults are TypeScript: starter: starter.py, solution: solution.py, tests: tests.py.`;
  }
  if (language === 'tsx') {
    return `"${name}" belongs to a tsx challenge, so it must end in .tsx. Name the files in the step: starter: starter.tsx, solution: solution.tsx, tests: tests.tsx.`;
  }
  const kind = extensionOf(name) === 'py' ? 'a Python file' : 'a .tsx file';
  const fix = extensionOf(name) === 'py' ? 'language: python' : 'language: tsx';
  return `"${name}" is ${kind}, but the step's language is "${language}". Set ${fix}, or point at a .${language} file.`;
}

/** The files of one language: the main step's, or its twin's read as a step. */
const ownFileNames = (step: CodeChallengeStep): string[] => [
  step.starter,
  step.solution,
  step.tests,
  ...[step.hidden, step.performance, step.bruteForce].filter(
    (name): name is string => name !== undefined,
  ),
];

/** Every file a challenge reads, its twin's included. */
export const challengeFileNames = (step: CodeChallengeStep): string[] =>
  challengeVariants(step).flatMap(ownFileNames);

/** Every challenge of a lesson, each twin read as a step of its own with the step's id. */
const challengeStepsOf = (lesson: RawLesson): CodeChallengeStep[] =>
  lesson.data.steps.flatMap((step) =>
    step.type === 'code-challenge' ? challengeVariants(step) : [],
  );

/** An assessment's time limit is its `minutes`, which may run past an ordinary lesson's. */
const MAX_LESSON_MINUTES = 60;
const MAX_ASSESSMENT_TASKS = 3;

const PLAYGROUND_FIELDS: readonly PlaygroundField[] = ['jsx', 'html', 'css', 'js'];

/** The playground rules below only look at playgrounds. */
const playgroundRule =
  (check: (step: Extract<Step, { type: 'playground' }>) => Finding[]) =>
  (step: Step): Finding[] =>
    step.type === 'playground' ? check(step) : [];

/** The sql rules below only look at sql steps. */
const sqlRule =
  (check: (step: Extract<Step, { type: 'sql' }>) => Finding[]) =>
  (step: Step): Finding[] =>
    step.type === 'sql' ? check(step) : [];

const STEP_RULES: Rule<Step>[] = [
  {
    rule: 'playground-scored-fields',
    severity: 'error',
    check: playgroundRule((step) => {
      if (step.checks === undefined) return [];
      const missing = [
        ...(step.concept === undefined ? ['"concept"'] : []),
        ...(step.difficulty === undefined ? ['"difficulty"'] : []),
      ];
      return missing.length === 0
        ? []
        : [{ where: step.id, message: `A playground with checks is scored, so it needs ${missing.join(' and ')}.` }];
    }),
  },
  {
    rule: 'playground-solution-missing',
    severity: 'error',
    check: playgroundRule((step) =>
      step.checks !== undefined && step.solution === undefined
        ? [{ where: step.id, message: 'A playground with checks needs a "solution". The gate runs the checks on it, and a learner who gives up is shown it.' }]
        : [],
    ),
  },
  {
    rule: 'playground-solution-unchecked',
    severity: 'warning',
    check: playgroundRule((step) =>
      step.checks === undefined && step.solution !== undefined
        ? [{ where: step.id, message: 'This playground has a "solution" but no "checks", so nothing checks it and no learner sees it. Add checks or remove the solution.' }]
        : [],
    ),
  },
  {
    rule: 'playground-page-missing',
    severity: 'error',
    check: playgroundRule((step) =>
      step.html === undefined && step.jsx === undefined
        ? [{ where: step.id, message: 'A playground needs "html" for a page, or "jsx" for a React component. Add html: "" for an empty page.' }]
        : [],
    ),
  },
  {
    rule: 'playground-js-with-jsx',
    severity: 'error',
    check: playgroundRule((step) =>
      step.jsx !== undefined && step.js !== undefined
        ? [{ where: step.id, message: 'A React playground runs its component, not a separate script. Move the code from "js" into the component, or drop "jsx".' }]
        : [],
    ),
  },
  {
    rule: 'playground-actions-need-jsx',
    severity: 'error',
    check: playgroundRule((step) =>
      step.jsx === undefined
        ? (step.checks ?? [])
            .filter((check) => check.actions !== undefined)
            .map((check) => ({
              where: step.id,
              message: `The check "${check.label}" has actions, which run on a fresh render of a React component. Add "jsx", or remove the actions.`,
            }))
        : [],
    ),
  },
  {
    rule: 'playground-editable-missing',
    severity: 'error',
    check: playgroundRule((step) =>
      (step.editable ?? [])
        .filter((field) => !(field === 'html' && step.jsx === undefined) && step[field] === undefined)
        .map((field) => ({
          where: step.id,
          message: `"editable" lists "${field}", but the step has no "${field}". Add ${field}: "" for an empty tab, or remove it from "editable".`,
        })),
    ),
  },
  {
    rule: 'playground-solution-field',
    severity: 'error',
    check: playgroundRule((step) => {
      const editable = new Set(editableFields(step));
      return PLAYGROUND_FIELDS.filter(
        (field) => step.solution?.[field] !== undefined && !editable.has(field),
      ).map((field) => ({
        where: step.id,
        message: `The solution changes "${field}", which the learner cannot edit. Add "${field}" to "editable", or remove it from the solution.`,
      }));
    }),
  },
  {
    rule: 'playground-check-zero',
    severity: 'error',
    check: playgroundRule((step) =>
      (step.checks ?? [])
        .filter(
          (check) =>
            check.count === 0 &&
            (check.text !== undefined || check.attribute !== undefined || check.style !== undefined),
        )
        .map((check) => ({
          where: step.id,
          message: `The check "${check.label}" wants no match, so it has no first match to read text, an attribute or a style from. Remove "count: 0" or those keys.`,
        })),
    ),
  },
  {
    rule: 'sql-scored-fields',
    severity: 'error',
    check: sqlRule((step) => {
      if (step.checks === undefined) return [];
      const missing = [
        ...(step.concept === undefined ? ['"concept"'] : []),
        ...(step.difficulty === undefined ? ['"difficulty"'] : []),
      ];
      return missing.length === 0
        ? []
        : [{ where: step.id, message: `A sql step with checks is scored, so it needs ${missing.join(' and ')}.` }];
    }),
  },
  {
    rule: 'sql-solution-missing',
    severity: 'error',
    check: sqlRule((step) =>
      step.checks !== undefined && step.solution === undefined
        ? [{ where: step.id, message: 'A sql step with checks needs a "solution". The learner\'s result is compared with its result, and a learner who gives up is shown it.' }]
        : [],
    ),
  },
  {
    rule: 'sql-solution-unchecked',
    severity: 'warning',
    check: sqlRule((step) =>
      step.checks === undefined && step.solution !== undefined
        ? [{ where: step.id, message: 'This sql step has a "solution" but no "checks", so nothing compares with it and no learner sees it. Add checks: { ordered: false }, or remove the solution.' }]
        : [],
    ),
  },
  {
    rule: 'sql-schema-empty',
    severity: 'warning',
    check: sqlRule((step) =>
      step.showSchema === true && (step.setup ?? '').trim() === ''
        ? [{ where: step.id, message: '"showSchema" shows the tables the setup makes, and this step has no setup. Add one or remove showSchema.' }]
        : [],
    ),
  },
  {
    rule: 'one-correct',
    severity: 'error',
    check: (step) =>
      choiceLists(step).flatMap(({ field, choices }) => {
        const correct = choices.filter((choice) => choice.correct === true).length;
        if (correct === 1) return [];
        const found = correct === 0 ? 'none' : String(correct);
        return [
          {
            where: step.id,
            message: `${field}: exactly one entry needs "correct: true", found ${found}.`,
          },
        ];
      }),
  },
  {
    rule: 'line-out-of-range',
    severity: 'error',
    check: (step) => {
      const refs = lineReferences(step);
      if (!refs) return [];
      const total = lineCount(refs.code);
      return refs.lines
        .filter((line) => line > total)
        .map((line) => ({
          where: step.id,
          message: `This step points at line ${line}, but the code has ${plural(total, 'line')}.`,
        }));
    },
  },
  {
    rule: 'trace-row-width',
    severity: 'error',
    check: (step) =>
      step.type !== 'trace-table'
        ? []
        : step.rows
            .filter((row) => row.values.length !== step.columns.length)
            .map((row) => ({
              where: step.id,
              message: `The row for line ${row.line} has ${plural(row.values.length, 'value')}, but the table has ${plural(step.columns.length, 'column')}. Give one value per column.`,
            })),
  },
  {
    rule: 'trace-all-given',
    severity: 'error',
    check: (step) =>
      step.type === 'trace-table' && step.rows.every((row) => row.given === true)
        ? [{ where: step.id, message: 'Every row is "given", so the learner has nothing to fill in. Remove "given" from at least one row.' }]
        : [],
  },
  {
    rule: 'blank-missing',
    severity: 'error',
    check: (step) => {
      if (step.type !== 'fill-blank') return [];
      const keys = new Set(step.blanks.map((blank) => blank.key));
      return [...new Set(templateKeys(step.template))]
        .filter((key) => !keys.has(key))
        .map((key) => ({
          where: step.id,
          message: `The template has {{${key}}}, but "blanks" has no entry with key "${key}". Add one.`,
        }));
    },
  },
  {
    rule: 'blank-unused',
    severity: 'error',
    check: (step) => {
      if (step.type !== 'fill-blank') return [];
      const keys = new Set(templateKeys(step.template));
      return step.blanks
        .filter((blank) => !keys.has(blank.key))
        .map((blank) => ({
          where: step.id,
          message: `The blank with key "${blank.key}" is never used. Put {{${blank.key}}} in the template or remove the blank.`,
        }));
    },
  },
  {
    rule: 'blank-duplicate',
    severity: 'error',
    check: (step) =>
      step.type !== 'fill-blank'
        ? []
        : duplicates(step.blanks.map((blank) => blank.key)).map((key) => ({
            where: step.id,
            message: `Two blanks have the key "${key}". Give each blank its own number.`,
          })),
  },
  {
    rule: 'blank-answer-not-in-bank',
    severity: 'error',
    check: (step) =>
      step.type !== 'fill-blank'
        ? []
        : step.blanks
            .filter((blank) => !step.bank.includes(blank.answer))
            .map((blank) => ({
              where: step.id,
              message: `The answer "${blank.answer}" for {{${blank.key}}} is not in "bank", so the learner cannot pick it. Add it to the bank.`,
            })),
  },
  {
    rule: 'duplicate-block-id',
    severity: 'error',
    check: (step) =>
      step.type !== 'parsons'
        ? []
        : duplicates([...step.blocks, ...(step.distractors ?? [])].map((block) => block.id)).map(
            (id) => ({
              where: step.id,
              message: `The block id "${id}" is used twice. Block and distractor ids must differ inside one step.`,
            }),
          ),
  },
  {
    rule: 'challenge-file-name',
    severity: 'error',
    check: (step) =>
      step.type !== 'code-challenge'
        ? []
        : challengeFileNames(step)
            .filter((name) => !isSafeFileName(name))
            .map((name) => ({
              where: step.id,
              message: `"${name}" is not a usable file name. Name a .ts, .tsx, .js or .py file that sits next to lesson.yaml, in lowercase with no folders, for example "starter.ts".`,
            })),
  },
  {
    rule: 'challenge-file-language',
    severity: 'error',
    check: (step) =>
      step.type !== 'code-challenge'
        ? []
        : challengeVariants(step).flatMap((variant) =>
            ownFileNames(variant)
              .filter((name) => isSafeFileName(name) && !fitsLanguage(name, variant.language))
              .map((name) => ({
                where: step.id,
                message: languageMismatch(name, variant.language),
              })),
          ),
  },
  {
    rule: 'twin-shape',
    severity: 'error',
    check: (step) => {
      if (step.type !== 'code-challenge' || step.twin === undefined) return [];
      const findings: Finding[] = [];
      if (step.twin.language === step.language) {
        findings.push({ where: step.id, message: `The twin is in ${step.language}, like the step. A twin is the same challenge in another language: set its "language" to one the step does not use.` });
      }
      if (step.hidden !== undefined) {
        findings.push({ where: step.id, message: 'An assessment task is scored on hidden tests in one language, so it cannot have a twin. Remove "twin".' });
      }
      return findings;
    },
  },
  {
    rule: 'typecheck-language',
    severity: 'error',
    check: (step) =>
      step.type === 'code-challenge' && step.typecheck === true && !typecheckOf(step)
        ? [{ where: step.id, message: `Only TypeScript is type-checked: a "ts" step with .ts files. Remove "typecheck" from this ${step.language} step.` }]
        : [],
  },
  {
    rule: 'typecheck-expectation',
    severity: 'error',
    check: (step) =>
      step.type === 'code-challenge' && step.expectStarterTypeError === true && !typecheckOf(step)
        ? [{ where: step.id, message: '"expectStarterTypeError" needs the type checker, which this step does not run. Remove it, or drop "typecheck: false".' }]
        : [],
  },
];

// ---------------------------------------------------------------------------
// Lesson rules
// ---------------------------------------------------------------------------

/** The concept a step names, if any. Prose names none; a free playground may. */
const conceptOf = (step: Step): string | undefined =>
  step.type === 'prose' ? undefined : step.concept;

/** The concept a step gives scored evidence for. A playground or sql step scores only with checks. */
const scoredConceptOf = (step: Step): string | undefined =>
  (step.type === 'playground' || step.type === 'sql') && step.checks === undefined
    ? undefined
    : conceptOf(step);

/** Every `concept` mentioned inside a lesson, with where it was mentioned. */
function conceptMentions(location: LessonLocation): { where: string; concept: string }[] {
  const { data } = location.lesson;
  return [
    ...data.concepts.map((concept) => ({ where: 'concepts', concept })),
    ...withFallbacks(data.steps).flatMap((step) => {
      const concept = conceptOf(step);
      return concept === undefined ? [] : [{ where: step.id, concept }];
    }),
    ...data.recall.map((card) => ({ where: card.id, concept: card.concept })),
  ];
}

const sentenceEnds = (text: string): number =>
  proseOnly(text)
    .split(/(?<=[.?!])\s+/)
    .filter((sentence) => sentence.trim() !== '').length;

/** Every string anywhere inside a value: text, code, choices, cards. */
function stringsIn(value: unknown): string[] {
  if (typeof value === 'string') return [value];
  if (Array.isArray(value)) return value.flatMap(stringsIn);
  if (value !== null && typeof value === 'object') return Object.values(value).flatMap(stringsIn);
  return [];
}

const LESSON_RULES: Rule<LessonLocation>[] = [
  {
    // AGENTS.md, law 10: examples are generic. Code and challenge files are searched
    // too, because a setting hides as easily in a string literal or a URL.
    rule: 'withdrawn-setting',
    severity: 'error',
    check: ({ lesson }) => {
      const { data } = lesson;
      const parts: { where: string; value: unknown }[] = [
        { where: 'opening', value: data.opening },
        ...data.steps.map((step) => ({ where: step.id, value: step })),
        { where: 'recap', value: data.recap },
        { where: 'recall', value: data.recall },
        { where: 'references', value: data.references },
        { where: 'deepDive', value: data.deepDive },
        ...Object.entries(lesson.files).map(([name, text]) => ({ where: name, value: text })),
      ];
      return parts.flatMap(({ where, value }) => {
        const terms = [...new Set(stringsIn(value).flatMap((text) => withdrawnSettingTermsIn(text)))];
        return terms.length === 0
          ? []
          : [{ where, message: `"${terms.join('", "')}" belongs to the withdrawn single-product setting or names a real person. Use a plain, generic example (docs/AUTHOR-BRIEF.md, "Examples").` }];
      });
    },
  },
  {
    rule: 'duplicate-step-id',
    severity: 'error',
    check: ({ lesson }) =>
      duplicates(withFallbacks(lesson.data.steps).map((step) => step.id)).map((id) => ({
        where: id,
        message: `Two steps have the id "${id}". Progress is stored by step id, so each needs its own.`,
      })),
  },
  {
    rule: 'duplicate-card-id',
    severity: 'error',
    check: ({ lesson }) =>
      duplicates(lesson.data.recall.map((card) => card.id)).map((id) => ({
        where: id,
        message: `Two recall cards have the id "${id}". Review history is stored by card id, so each needs its own.`,
      })),
  },
  {
    rule: 'lesson-id-prefix',
    severity: 'error',
    check: ({ module, lesson }) =>
      lesson.data.id.startsWith(`${module.data.id}.`)
        ? []
        : [{ message: `The lesson id "${lesson.data.id}" must start with its module id: "${module.data.id}.".` }],
  },
  {
    rule: 'concept-unknown',
    severity: 'error',
    check: (location, index) =>
      conceptMentions(location)
        .filter(({ concept }) => !index.conceptModule.has(concept))
        .map(({ where, concept }) => ({
          where,
          message: `The concept "${concept}" is not defined in any module.yaml. Check the spelling or add it to the module's "concepts".`,
        })),
  },
  {
    rule: 'concept-foreign-module',
    severity: 'error',
    check: ({ module, lesson }, index) =>
      lesson.data.concepts
        .filter((concept) => (index.conceptModule.get(concept) ?? module.data.id) !== module.data.id)
        .map((concept) => ({
          where: 'concepts',
          message: `The concept "${concept}" belongs to the module "${index.conceptModule.get(concept)}". A lesson lists only concepts of its own module. A step may still practise it.`,
        })),
  },
  {
    rule: 'prerequisite-unknown',
    severity: 'error',
    check: ({ lesson }, index) =>
      lesson.data.prerequisites.flatMap((id): Finding[] => {
        if (id === lesson.data.id) {
          return [{ where: 'prerequisites', message: 'A lesson cannot list itself as a prerequisite.' }];
        }
        return index.lessonIds.has(id)
          ? []
          : [{ where: 'prerequisites', message: `The prerequisite "${id}" is not the id of any lesson.` }];
      }),
  },
  {
    rule: 'no-explain-back',
    severity: 'error',
    check: ({ lesson }) =>
      lesson.data.assessment === true ||
      lesson.data.steps.some((step) => step.type === 'explain-back')
        ? []
        : [{ message: 'Add an "explain-back" step. Every lesson ends by asking for a cause in the learner\'s own words.' }],
  },
  {
    rule: 'step-variety',
    severity: 'error',
    check: ({ lesson }) => {
      const types = new Set(lesson.data.steps.map((step) => step.type));
      return lesson.data.assessment === true || types.size >= 3
        ? []
        : [{ message: `The lesson uses ${plural(types.size, 'step type')}. Use at least 3, in the order predict or trace, arrange, fix, write, explain.` }];
    },
  },
  {
    rule: 'concept-unscored',
    severity: 'warning',
    check: ({ lesson }) => {
      // One assessment task gives evidence for several concepts at once, as a real test does.
      if (lesson.data.assessment === true) return [];
      const scored = new Set(withFallbacks(lesson.data.steps).map(scoredConceptOf));
      return lesson.data.concepts
        .filter((concept) => !scored.has(concept))
        .map((concept) => ({
          where: 'concepts',
          message: `No scored step gives evidence for "${concept}". Add one, or remove the concept from the lesson.`,
        }));
    },
  },
  {
    rule: 'opening-too-long',
    severity: 'error',
    check: ({ lesson }) => {
      const count = sentenceEnds(lesson.data.opening.text);
      return count <= 2
        ? []
        : [{ where: 'opening', message: `The opening has ${count} sentences. It states the failure in at most two.` }];
    },
  },
  {
    rule: 'challenge-file-missing',
    severity: 'error',
    check: ({ lesson }) =>
      lesson.data.steps.flatMap((step) =>
        step.type !== 'code-challenge'
          ? []
          : challengeFileNames(step)
              .filter((name) => isSafeFileName(name) && lesson.files[name] === undefined)
              .map((name) => ({
                where: step.id,
                message: `The file "${name}" does not exist next to lesson.yaml. Create it, or fix the name in the step.`,
              })),
      ),
  },
  {
    rule: 'lesson-minutes',
    severity: 'error',
    check: ({ lesson }) =>
      lesson.data.assessment === true || lesson.data.minutes <= MAX_LESSON_MINUTES
        ? []
        : [{ where: 'minutes', message: `A lesson takes at most ${MAX_LESSON_MINUTES} minutes. Only an assessment may run longer, because its minutes are the time limit.` }],
  },
  {
    rule: 'assessment-shape',
    severity: 'error',
    check: ({ lesson }) => {
      const { steps, assessment } = lesson.data;
      const tasks = steps.filter((step) => step.type === 'code-challenge');
      if (assessment !== true) {
        return tasks
          .filter((step) => step.hidden !== undefined || step.performance !== undefined)
          .map((step) => ({
            where: step.id,
            message: 'Hidden and performance tests are scored only in an assessment. Set "assessment: true" on the lesson, or move these tests into "tests".',
          }));
      }
      const findings: Finding[] = steps
        .filter((step) => step.type !== 'prose' && step.type !== 'code-challenge')
        .map((step) => ({
          where: step.id,
          message: `An assessment holds prose briefs and code challenges only, like the real test. Move the "${step.type}" step to a lesson.`,
        }));
      if (tasks.length === 0 || tasks.length > MAX_ASSESSMENT_TASKS) {
        findings.push({
          message: `An assessment has 1 to ${MAX_ASSESSMENT_TASKS} tasks. This one has ${tasks.length}.`,
        });
      }
      for (const step of tasks) {
        if (step.hidden === undefined) {
          findings.push({
            where: step.id,
            message: 'Every assessment task needs "hidden" tests: the score comes from tests the learner never sees.',
          });
        }
      }
      return findings;
    },
  },
  {
    rule: 'performance-without-hidden',
    severity: 'error',
    check: ({ lesson }) =>
      lesson.data.steps.flatMap((step) =>
        step.type === 'code-challenge' &&
        (step.performance !== undefined || step.bruteForce !== undefined || step.timeLimitMs !== undefined) &&
        step.hidden === undefined
          ? [{ where: step.id, message: '"performance", "timeLimitMs" and "bruteForce" only make sense with "hidden" correctness tests. Add them.' }]
          : [],
      ),
  },
  {
    rule: 'editable-range',
    severity: 'error',
    check: ({ lesson }) =>
      challengeStepsOf(lesson).flatMap((step): Finding[] => {
        if (step.editable === undefined) return [];
        const range = parseLineRange(step.editable);
        const lines = lineCount(lesson.files[step.starter] ?? '');
        let message: string | undefined;
        if (!range) {
          message = `"editable" is "${step.editable}". Name the starter lines the learner writes, as "2-4" or "3".`;
        } else if (range.last > lines) {
          message = `"editable" reaches line ${range.last}, and the starter has ${lines} lines.`;
        } else if (range.first === 1 && range.last === lines) {
          message = '"editable" covers the whole starter, so it locks nothing. Remove it, or leave the scaffold out of the range.';
        }
        return message === undefined ? [] : [{ where: step.id, message }];
      }),
  },
  {
    rule: 'editable-solution',
    severity: 'error',
    check: ({ lesson }) =>
      challengeStepsOf(lesson).flatMap((step): Finding[] => {
        if (step.editable === undefined) return [];
        const range = parseLineRange(step.editable);
        const frame = range && lockedFrame(lesson.files[step.starter] ?? '', range);
        if (!frame || locateRegion(lesson.files[step.solution] ?? '', frame)) return [];
        return [{ where: step.id, message: `The solution changes a locked line. Outside lines ${step.editable}, "${step.solution}" must match "${step.starter}" exactly, or the learner could never write it.` }];
      }),
  },
  {
    rule: 'python-packages',
    severity: 'error',
    check: ({ lesson }) =>
      challengeStepsOf(lesson).flatMap((step): Finding[] => {
        const named = step.packages ?? [];
        if (step.language !== 'python') {
          return named.length === 0
            ? []
            : [{ where: step.id, message: `"packages" loads Python packages, and this step is ${step.language}. Remove it.` }];
        }
        const sources = ownFileNames(step).map((name) => lesson.files[name] ?? '');
        const imported = importedPythonPackages(...sources);
        const findings: Finding[] = [];
        const unnamed = imported.filter((name) => !named.includes(name));
        if (unnamed.length > 0) {
          findings.push({
            where: step.id,
            message: `The files import ${unnamed.join(' and ')}. Name every package the step loads: packages: [${imported.join(', ')}].`,
          });
        }
        for (const name of named.filter((pkg) => !imported.includes(pkg))) {
          findings.push({
            where: step.id,
            message: `No file of this step imports "${name}", so it would be downloaded for nothing. Remove it from "packages".`,
          });
        }
        return findings;
      }),
  },
  {
    rule: 'challenge-file-shared',
    severity: 'error',
    check: ({ lesson }) =>
      duplicates(
        lesson.data.steps.flatMap((step) =>
          step.type === 'code-challenge' ? challengeFileNames(step) : [],
        ),
      ).map((name) => ({
        message: `The file "${name}" is used by more than one code challenge. Name the files per step, for example "total.starter.ts", and set "starter", "solution" and "tests" in each step.`,
      })),
  },
];

// ---------------------------------------------------------------------------
// Catalog rules
// ---------------------------------------------------------------------------

interface Located extends Finding {
  path: string;
}

interface CatalogRule {
  rule: string;
  severity: Severity;
  check: (catalog: RawCatalog, index: CatalogIndex) => Located[];
}

/** Reports the second and later holders of an id, since the first one was there first. */
function duplicateIds(
  entries: readonly { id: string; path: string }[],
  message: (id: string, firstPath: string) => string,
): Located[] {
  const first = new Map<string, string>();
  return entries.flatMap(({ id, path }) => {
    const firstPath = first.get(id);
    if (firstPath === undefined) {
      first.set(id, path);
      return [];
    }
    return [{ path, message: message(id, firstPath) }];
  });
}

const pad = (order: number): string => String(order).padStart(2, '0');

function duplicateOrders(siblings: readonly { order: number; path: string }[]): Located[] {
  return duplicateIds(
    siblings.map(({ order, path }) => ({ id: pad(order), path })),
    (order, firstPath) =>
      `Two folders start with the number ${order} (the other is ${firstPath}). Give each its own number, or the order is undefined.`,
  );
}

const CATALOG_RULES: CatalogRule[] = [
  {
    rule: 'duplicate-module-id',
    severity: 'error',
    check: (catalog) =>
      duplicateIds(
        allModules(catalog).map((module) => ({ id: module.data.id, path: module.path })),
        (id, firstPath) => `The module id "${id}" is already used by ${firstPath}.`,
      ),
  },
  {
    rule: 'duplicate-lesson-id',
    severity: 'error',
    check: (catalog) =>
      duplicateIds(
        allLessons(catalog).map(({ lesson }) => ({ id: lesson.data.id, path: lesson.path })),
        (id, firstPath) => `The lesson id "${id}" is already used by ${firstPath}. Lesson ids are unique across the course.`,
      ),
  },
  {
    rule: 'duplicate-concept-id',
    severity: 'error',
    check: (catalog) =>
      duplicateIds(
        allModules(catalog).flatMap((module) =>
          module.data.concepts.map((concept) => ({ id: concept.id, path: module.path })),
        ),
        (id, firstPath) => `The concept "${id}" is already defined in ${firstPath}. Define a concept once.`,
      ),
  },
  {
    rule: 'module-number',
    severity: 'error',
    check: (catalog) =>
      allModules(catalog)
        .filter((module) => module.order !== module.data.number)
        .map((module) => ({
          path: module.path,
          message: `The folder starts with "${pad(module.order)}-" but "number" is ${module.data.number}. Make them the same.`,
        })),
  },
  {
    rule: 'duplicate-order',
    severity: 'error',
    check: (catalog) => [
      ...duplicateOrders(allModules(catalog)),
      ...allModules(catalog).flatMap((module) => duplicateOrders(module.lessons)),
    ],
  },
  {
    rule: 'concept-id-prefix',
    severity: 'error',
    check: (catalog) =>
      allModules(catalog).flatMap((module) =>
        module.data.concepts
          .filter((concept) => !concept.id.startsWith(`${module.data.id}.`))
          .map((concept) => ({
            path: module.path,
            where: concept.id,
            message: `The concept id "${concept.id}" must start with its module id: "${module.data.id}.".`,
          })),
      ),
  },
  {
    rule: 'confusable-unknown',
    severity: 'error',
    check: (catalog, index) =>
      allModules(catalog).flatMap((module) =>
        module.data.concepts.flatMap((concept) =>
          (concept.confusableWith ?? [])
            .filter((target) => !index.conceptModule.has(target) || target === concept.id)
            .map((target) => ({
              path: module.path,
              where: concept.id,
              message: `"confusableWith" names "${target}", which is not another defined concept. Check the spelling.`,
            })),
        ),
      ),
  },
  {
    rule: 'lock-id-removed',
    severity: 'error',
    check: (catalog) =>
      diffLock(catalog, catalog.lock).removed.map((id) => ({
        path: LOCK_PATH,
        message: `The published id "${id}" is no longer in the content. Learners have progress stored under it. Restore the id, or list it under "retired" if it is gone for good.`,
      })),
  },
  {
    rule: 'lock-id-reused',
    severity: 'error',
    check: (catalog) =>
      diffLock(catalog, catalog.lock).reused.map((id) => ({
        path: LOCK_PATH,
        message: `The id "${id}" was retired and is in the content again. Old progress would attach to new material. Choose a new id.`,
      })),
  },
  {
    rule: 'lock-stale',
    severity: 'warning',
    check: (catalog) => {
      const { unpublished } = diffLock(catalog, catalog.lock);
      return unpublished.length === 0
        ? []
        : [
            {
              path: LOCK_PATH,
              message: `${plural(unpublished.length, 'new id')} not in the lock yet, for example "${unpublished[0]}". Run "pnpm validate:content --write-lock" and commit the file.`,
            },
          ];
    },
  },
];

// ---------------------------------------------------------------------------
// Running the tables
// ---------------------------------------------------------------------------

function buildIndex(catalog: RawCatalog): CatalogIndex {
  const conceptModule = new Map<string, string>();
  for (const owner of allModules(catalog)) {
    for (const concept of owner.data.concepts) {
      // First definition wins. The duplicate is reported by its own rule.
      if (!conceptModule.has(concept.id)) conceptModule.set(concept.id, owner.data.id);
    }
  }
  return {
    conceptModule,
    lessonIds: new Set(allLessons(catalog).map(({ lesson }) => lesson.data.id)),
  };
}

function run<Subject>(
  rules: readonly Rule<Subject>[],
  subjects: readonly Subject[],
  path: string,
  index: CatalogIndex,
): Issue[] {
  return rules.flatMap(({ rule, severity, check }) =>
    subjects.flatMap((subject) =>
      check(subject, index).map((finding) => ({ severity, path, rule, ...finding })),
    ),
  );
}

function validateLesson(location: LessonLocation, index: CatalogIndex): Issue[] {
  const { path, data } = location.lesson;
  return [
    ...run(LESSON_RULES, [location], path, index),
    ...run(STEP_RULES, withFallbacks(data.steps), path, index),
    ...run(TEXT_RULES, lessonTextFields(data), path, index),
    ...run(CODE_RULES, lessonCodeFields(data), path, index),
  ];
}

export function validateCatalog(input: RawCatalog): Issue[] {
  const index = buildIndex(input);
  const catalogIssues = CATALOG_RULES.flatMap(({ rule, severity, check }) =>
    check(input, index).map((finding) => ({ severity, rule, ...finding })),
  );
  return [...catalogIssues, ...allLessons(input).flatMap((l) => validateLesson(l, index))];
}

/** Every rule name with its severity, for the docs and for a test that each one is covered. */
export const RULES: readonly { rule: string; severity: Severity }[] = [
  ...CATALOG_RULES,
  ...LESSON_RULES,
  ...STEP_RULES,
  ...TEXT_RULES,
  ...CODE_RULES,
].map(({ rule, severity }) => ({ rule, severity }));

// ---------------------------------------------------------------------------
// Outline rules
// ---------------------------------------------------------------------------

/*
 * `outline.yaml` fixes the id and the folder of every lesson before it is written, so
 * authors who work in parallel cannot collide. These rules tie the plan to the module files,
 * to the published lessons and to the lesson index of the news reader profile. They run
 * apart from `validateCatalog` because the outline is not part of the compiled bundle.
 */

export const INTERESTS_PATH = 'content/interests.yaml';

export interface OutlineInput {
  catalog: RawCatalog;
  /** Absent when there is no `outline.yaml`, and then nothing is checked against a plan. */
  outline?: RawOutline;
  /** Lesson ids named by the lesson index of `content/interests.yaml`. */
  interestLessonIds?: readonly string[];
}

interface OutlineRule {
  rule: string;
  severity: Severity;
  check: (input: OutlineInput, index: CatalogIndex) => Located[];
}

const dirOf = (numbered: { order: number; slug: string }): string =>
  `${pad(numbered.order)}-${numbered.slug}`;

const plannedIn = (outline: RawOutline | undefined) =>
  outline ? outlineEntries(outline.data).map((entry) => ({ ...entry, path: outline.path })) : [];

/** Runs a check only when there is an outline to check against. */
const withOutline =
  (check: (outline: RawOutline, input: OutlineInput) => Located[]) =>
  (input: OutlineInput): Located[] =>
    input.outline ? check(input.outline, input) : [];

/** The parts of the course with where they are written, or nothing to check. */
const partsIn = (catalog: RawCatalog): { parts: Part[]; path: string } | undefined => {
  const parts = catalog.course?.data.parts;
  return parts && catalog.course ? { parts, path: catalog.course.path } : undefined;
};

/** Runs a check only when the course is divided into parts. */
const withParts =
  (check: (parts: Part[], path: string, input: OutlineInput) => Located[]) =>
  (input: OutlineInput): Located[] => {
    const found = partsIn(input.catalog);
    return found ? check(found.parts, found.path, input) : [];
  };

/** Runs a check only when the course has parts and an outline to hold them against. */
const withPartsAndOutline = (
  check: (parts: Part[], path: string, outline: RawOutline) => Located[],
) => withParts((parts, path, input) => (input.outline ? check(parts, path, input.outline) : []));

const PART_RULES: OutlineRule[] = [
  {
    rule: 'part-duplicate-id',
    severity: 'error',
    check: withParts((parts, path) =>
      duplicateIds(
        parts.map((part) => ({ id: part.id, path })),
        (id) => `The part id "${id}" is used twice. Give each part its own id.`,
      ),
    ),
  },
  {
    rule: 'part-id-clash',
    severity: 'error',
    check: withParts((parts, path, { catalog, outline }) => {
      const moduleIds = new Set([
        ...allModules(catalog).map((module) => module.data.id),
        ...(outline?.data.modules.map((module) => module.id) ?? []),
      ]);
      return parts
        .filter((part) => moduleIds.has(part.id))
        .map((part) => ({
          path,
          where: part.id,
          message: `The part id "${part.id}" is also a module id. Progress events name parts and modules in the same field, so pick another word.`,
        }));
    }),
  },
  {
    rule: 'part-module-unknown',
    severity: 'error',
    check: withParts((parts, path, { catalog, outline }) => {
      const known = new Set([
        ...allModules(catalog).map((module) => module.data.id),
        ...(outline?.data.modules.map((module) => module.id) ?? []),
      ]);
      return parts.flatMap((part) =>
        part.modules
          .filter((id) => !known.has(id))
          .map((id) => ({
            path,
            where: part.id,
            message: `The part "${part.id}" lists the module "${id}", which does not exist. Check the spelling against the module ids in outline.yaml.`,
          })),
      );
    }),
  },
  {
    rule: 'part-module-repeated',
    severity: 'error',
    check: withParts((parts, path) =>
      duplicateIds(
        parts.flatMap((part) => part.modules.map((id) => ({ id, path }))),
        (id) => `The module "${id}" is listed more than once. Each module belongs to exactly one part.`,
      ),
    ),
  },
  {
    rule: 'part-module-woven',
    severity: 'error',
    check: withPartsAndOutline((parts, path, outline) => {
      const woven = wovenModuleIds(outline.data);
      return parts.flatMap((part) =>
        part.modules
          .filter((id) => woven.has(id))
          .map((id) => ({
            path,
            where: part.id,
            message: `The module "${id}" is woven, so it belongs to no part. Each of its lessons already counts towards the part of the lesson it follows. Remove it from "${part.id}".`,
          })),
      );
    }),
  },
  {
    rule: 'part-module-missing',
    severity: 'error',
    check: withPartsAndOutline((parts, path, outline) => {
      const woven = wovenModuleIds(outline.data);
      const listed = new Set(parts.flatMap((part) => part.modules));
      return outline.data.modules
        .filter((module) => !woven.has(module.id) && !listed.has(module.id))
        .map((module) => ({
          path,
          where: module.id,
          message: `The module "${module.id}" is in no part. Add it to the part it belongs to, in course order.`,
        }));
    }),
  },
  {
    rule: 'part-module-order',
    severity: 'error',
    check: withPartsAndOutline((parts, path, outline) => {
      const woven = wovenModuleIds(outline.data);
      const position = new Map(outline.data.modules.map((module, i) => [module.id, i]));
      // A woven or unknown module has its own rule; order is only asked of the rest.
      const listed = parts
        .flatMap((part) => part.modules)
        .filter((id) => position.has(id) && !woven.has(id));
      const firstOut = listed.findIndex(
        (id, i) => i > 0 && (position.get(id) ?? 0) < (position.get(listed[i - 1] ?? '') ?? 0),
      );
      if (firstOut < 0) return [];
      const [before, id] = [listed[firstOut - 1] ?? '', listed[firstOut] ?? ''];
      return [
        {
          path,
          where: id,
          message: `The module "${id}" comes before "${before}" in outline.yaml, but after it in the parts. List parts and their modules in course order.`,
        },
      ];
    }),
  },
];

const OUTLINE_RULES: OutlineRule[] = [
  {
    rule: 'outline-duplicate-id',
    severity: 'error',
    check: withOutline((outline) => [
      ...duplicateIds(
        plannedIn(outline).map(({ lesson, path }) => ({ id: lesson.id, path })),
        (id) => `The lesson id "${id}" is planned twice. Each lesson id appears once in the outline.`,
      ),
      ...duplicateIds(
        outline.data.modules.map((module) => ({ id: module.id, path: outline.path })),
        (id) => `The module id "${id}" appears twice. List each module once.`,
      ),
    ]),
  },
  {
    rule: 'outline-duplicate-dir',
    severity: 'error',
    check: withOutline((outline) => [
      ...duplicateIds(
        outline.data.modules.map((module) => ({ id: module.dir, path: outline.path })),
        (dir) => `The module folder "${dir}" appears twice. Two modules cannot share a folder.`,
      ),
      ...outline.data.modules.flatMap((module) =>
        duplicateIds(
          module.lessons.map((lesson) => ({ id: lesson.dir, path: outline.path })),
          (dir) => `The lesson folder "${dir}" appears twice in the module "${module.id}". Two lessons cannot share a folder.`,
        ).map((found) => ({ ...found, where: module.id })),
      ),
    ]),
  },
  {
    rule: 'outline-dir-order',
    severity: 'error',
    check: withOutline((outline) =>
      outline.data.modules.flatMap((module) =>
        module.lessons
          .map((lesson, position) => ({ lesson, expected: position + 1 }))
          .filter(({ lesson, expected }) => orderOfDir(lesson.dir) !== expected)
          .map(({ lesson, expected }) => ({
            path: outline.path,
            where: lesson.id,
            message: `The folder "${lesson.dir}" is lesson ${expected} of the module "${module.id}", so it must start with "${pad(expected)}-". Lessons are numbered from 01 in course order.`,
          })),
      ),
    ),
  },
  {
    rule: 'outline-lesson-id-prefix',
    severity: 'error',
    check: ({ outline }) =>
      plannedIn(outline)
        .filter(({ module, lesson }) => !lesson.id.startsWith(`${module.id}.`))
        .map(({ module, lesson, path }) => ({
          path,
          where: lesson.id,
          message: `The lesson id "${lesson.id}" must start with its module id: "${module.id}.".`,
        })),
  },
  {
    rule: 'outline-module-unknown',
    severity: 'error',
    check: withOutline((outline, { catalog }) => {
      const dirs = new Map(allModules(catalog).map((m) => [m.data.id, dirOf(m)]));
      return outline.data.modules
        .filter((module) => dirs.get(module.id) !== module.dir)
        .map((module) => ({
          path: outline.path,
          where: module.id,
          message: dirs.has(module.id)
            ? `The module "${module.id}" is planned in "${module.dir}", but its module.yaml is in "${dirs.get(module.id)}". Make them the same.`
            : `No module.yaml with the id "${module.id}" exists in the course. Create ${module.dir}/module.yaml, or fix the id.`,
        }));
    }),
  },
  {
    rule: 'outline-concept-unknown',
    severity: 'error',
    check: ({ outline }, index) =>
      plannedIn(outline).flatMap(({ lesson, path }) =>
        lesson.concepts
          .filter((concept) => !index.conceptModule.has(concept))
          .map((concept) => ({
            path,
            where: lesson.id,
            message: `The concept "${concept}" is not defined in any module.yaml. Check the spelling, or add it to the module's "concepts".`,
          })),
      ),
  },
  {
    rule: 'outline-concept-foreign',
    severity: 'error',
    check: ({ outline }, index) =>
      plannedIn(outline).flatMap(({ module, lesson, path }) =>
        lesson.concepts
          .filter((concept) => (index.conceptModule.get(concept) ?? module.id) !== module.id)
          .map((concept) => ({
            path,
            where: lesson.id,
            message: `The concept "${concept}" belongs to the module "${index.conceptModule.get(concept)}". A lesson lists only concepts of its own module, because lesson.yaml has the same rule.`,
          })),
      ),
  },
  {
    rule: 'outline-concept-unused',
    severity: 'warning',
    check: withOutline((outline, { catalog }) => {
      const used = new Set(outlineEntries(outline.data).flatMap(({ lesson }) => lesson.concepts));
      const planned = new Set(outline.data.modules.map((module) => module.id));
      return allModules(catalog)
        .filter((module) => planned.has(module.data.id))
        .flatMap((module) =>
          module.data.concepts
            .filter((concept) => !used.has(concept.id))
            .map((concept) => ({
              path: module.path,
              where: concept.id,
              message: `No lesson in ${outline.path} teaches "${concept.id}". Add it to a lesson's "concepts", or remove the concept.`,
            })),
        );
    }),
  },
  {
    rule: 'outline-woven-unknown',
    severity: 'error',
    check: ({ outline }) => {
      const ids = new Set(plannedIn(outline).map(({ lesson }) => lesson.id));
      return plannedIn(outline)
        .filter(({ lesson }) => lesson.wovenAfter !== undefined)
        .filter(({ lesson }) => lesson.wovenAfter === lesson.id || !ids.has(lesson.wovenAfter ?? ''))
        .map(({ lesson, path }) => ({
          path,
          where: lesson.id,
          message: `"wovenAfter" names "${lesson.wovenAfter}", which is not the id of another planned lesson.`,
        }));
    },
  },
  {
    rule: 'outline-lesson-unplanned',
    severity: 'error',
    check: withOutline((outline, { catalog }) => {
      const ids = new Set(outlineEntries(outline.data).map(({ lesson }) => lesson.id));
      return allLessons(catalog)
        .filter(({ lesson }) => !ids.has(lesson.data.id))
        .map(({ lesson }) => ({
          path: lesson.path,
          message: `The lesson id "${lesson.data.id}" is not in ${outline.path}. Use the id the outline plans for this lesson, or add the lesson to the outline first.`,
        }));
    }),
  },
  {
    rule: 'outline-lesson-dir',
    severity: 'error',
    check: withOutline((outline, { catalog }) => {
      const planned = new Map(
        outlineEntries(outline.data).map(({ module, lesson }) => [lesson.id, `${module.dir}/${lesson.dir}`]),
      );
      return allLessons(catalog)
        .map(({ module, lesson }) => ({
          lesson,
          actual: `${dirOf(module)}/${dirOf(lesson)}`,
          expected: planned.get(lesson.data.id),
        }))
        .filter(({ actual, expected }) => expected !== undefined && expected !== actual)
        .map(({ lesson, actual, expected }) => ({
          path: lesson.path,
          message: `The lesson "${lesson.data.id}" is in "${actual}", but the outline plans it in "${expected}". Move the folder.`,
        }));
    }),
  },
  {
    rule: 'confusable-asymmetric',
    severity: 'error',
    check: ({ catalog }) => {
      const links = new Map(
        allModules(catalog).flatMap((module) =>
          module.data.concepts.map((concept) => [concept.id, concept.confusableWith ?? []] as const),
        ),
      );
      return allModules(catalog).flatMap((module) =>
        module.data.concepts.flatMap((concept) =>
          (concept.confusableWith ?? [])
            // A target that does not exist is reported by confusable-unknown.
            .filter((target) => links.has(target) && !links.get(target)?.includes(concept.id))
            .map((target) => ({
              path: module.path,
              where: concept.id,
              message: `"${concept.id}" lists "${target}" under "confusableWith", but "${target}" does not list it back. Add "${concept.id}" there, because practice interleaves the pair in both directions.`,
            })),
        ),
      );
    },
  },
  {
    rule: 'interests-lesson-unknown',
    severity: 'error',
    // With no outline there is no plan to check against, and every id would look wrong.
    check: withOutline((outline, { interestLessonIds = [] }) => {
      const ids = new Set(plannedIn(outline).map(({ lesson }) => lesson.id));
      return interestLessonIds
        .filter((id) => !ids.has(id))
        .map((id) => ({
          path: INTERESTS_PATH,
          where: id,
          message: `The lesson index names "${id}", which the outline does not plan. Use the id from outline.yaml, or the news link will never resolve.`,
        }));
    }),
  },
];

export function validateOutline(input: OutlineInput): Issue[] {
  const index = buildIndex(input.catalog);
  return [...OUTLINE_RULES, ...PART_RULES].flatMap(({ rule, severity, check }) =>
    check(input, index).map((finding) => ({ severity, rule, ...finding })),
  );
}

/** Kept apart from RULES: these rules need the outline, which `validateCatalog` never sees. */
export const OUTLINE_RULE_LIST: readonly { rule: string; severity: Severity }[] = [
  ...OUTLINE_RULES,
  ...PART_RULES,
].map(({ rule, severity }) => ({ rule, severity }));

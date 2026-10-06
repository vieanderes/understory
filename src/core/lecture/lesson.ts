import type {
  CompiledChoice,
  CompiledCode,
  CompiledLectureExtras,
  CompiledLesson,
  CompiledNotesSection,
  CompiledPortableStep,
  CompiledStep,
  Rich,
} from '../content/compiled';
import type { FigureId } from '../content/figures';
import { VERIFY_LENSES, type VerifyLens } from '../content/lenses';
import type { Language, Reference } from '../content/schema';

/*
 * A lesson turned into reading. The player asks, waits and reveals; a lecture shows the
 * question and its answer together, with the reason, so it can be read straight through
 * or printed. Every step keeps its id, so a lecture can link back to the step it came from.
 */

export interface ShownCode {
  html: string;
  language: Language;
}

/** A wrong answer people give, and why it is wrong: the misconception, named. */
export interface WrongAnswer {
  answer: Rich;
  why: Rich;
}

export type LectureBlock =
  | { kind: 'explanation'; id: string; body: Rich; figure?: { id: FigureId; caption: string } }
  | {
      kind: 'question';
      id: string;
      /** `predict` asks what code prints; `choice` asks about an idea. */
      variant: 'predict' | 'choice' | 'checkpoint';
      code?: ShownCode;
      question: Rich;
      answer: Rich;
      why: Rich;
      wrong: WrongAnswer[];
    }
  | {
      kind: 'trace';
      id: string;
      prompt: Rich;
      code: ShownCode;
      columns: string[];
      rows: { line: number; values: string[] }[];
    }
  | {
      kind: 'completed';
      id: string;
      /** A gap-fill with its gaps filled, or Parsons blocks in order. */
      variant: 'fill-blank' | 'parsons';
      prompt: Rich;
      solution: CompiledCode[];
      /** Parsons lines that do not belong, and why. */
      leftOut: { code: ShownCode; why: Rich }[];
    }
  | {
      kind: 'bug';
      id: string;
      variant: 'bug-hunt' | 'ai-review';
      /** What the assistant was asked, for an AI review. */
      request?: string;
      prompt: Rich;
      code: ShownCode;
      lines: number[];
      answer: Rich;
      why: Rich;
      wrong: WrongAnswer[];
      fix?: ShownCode;
    }
  | {
      kind: 'exercise';
      id: string;
      variant: 'code' | 'page' | 'sql';
      prompt: Rich;
      starter?: ShownCode;
      hints: Rich[];
      /** Empty when no reference solution was written (a free playground). */
      solution: CompiledCode[];
    }
  | { kind: 'model-answer'; id: string; prompt: Rich; points: string[]; answer: Rich };

export interface LessonLecture {
  id: string;
  moduleId: string;
  moduleSlug: string;
  slug: string;
  title: string;
  objective: string;
  level: CompiledLesson['level'];
  /** The time the interactive lesson takes. */
  lessonMinutes: number;
  /** The time this lecture takes to read (reading.ts). */
  readingMinutes: number;
  assessment: boolean;
  /** The big picture from the notes. Without notes the view shows `opening` instead. */
  summary?: Rich;
  /** The lesson's opening, two plain sentences. */
  opening: string;
  /** The sentences to know by heart: the notes' list, or the recap without notes. */
  remember: Rich[];
  blocks: LectureBlock[];
  deeper: CompiledNotesSection[];
  deepDive?: Rich;
  pitfalls: Rich[];
  /** Before you ship: the notes' checks, grouped by lens in VERIFY_LENSES order. */
  verify: VerifyGroup[];
  interview: { question: Rich; answer: Rich }[];
  /** What people say a term is, and what it actually means. */
  terms: { term: string; say: string; means: Rich }[];
  flashcards: { id: string; front: Rich; back: Rich }[];
  references: Reference[];
  hasNotes: boolean;
}

export interface VerifyGroup {
  lens: VerifyLens;
  label: string;
  checks: Rich[];
}

export const VERIFY_LENS_LABEL: Record<VerifyLens, string> = {
  breaks: 'What breaks',
  scales: 'What scales',
  confuses: 'What confuses',
  leaks: 'What leaks',
  tests: 'How to test it',
};

/** The checks under each lens, lenses in their fixed order and empty ones left out. */
export function verifyGroups(checks: readonly { lens: VerifyLens; check: Rich }[]): VerifyGroup[] {
  return VERIFY_LENSES.flatMap((lens) => {
    const under = checks.filter((item) => item.lens === lens).map((item) => item.check);
    return under.length === 0 ? [] : [{ lens, label: VERIFY_LENS_LABEL[lens], checks: under }];
  });
}

const shown = (code: string | undefined, html: string | undefined, language?: Language) =>
  html === undefined || code === undefined ? undefined : { html, language: language ?? 'text' };

/** The right choice and the reasons against the others. Authors mark exactly one right. */
function answered(choices: readonly CompiledChoice[]): {
  answer: Rich;
  why: Rich;
  wrong: WrongAnswer[];
} {
  const right = choices.find((choice) => choice.correct === true) ?? choices[0];
  if (!right) throw new Error('A choice step has no choices.');
  return {
    answer: right.text,
    why: right.feedback,
    wrong: choices
      .filter((choice) => choice !== right)
      .map((choice) => ({ answer: choice.text, why: choice.feedback })),
  };
}

function portableBlock(
  step: CompiledPortableStep,
  solutions: CompiledLectureExtras['solutions'],
): LectureBlock {
  switch (step.type) {
    case 'prose':
      return {
        kind: 'explanation',
        id: step.id,
        body: step.body,
        ...(step.figure ? { figure: step.figure } : {}),
      };
    case 'predict-output':
      return {
        kind: 'question',
        id: step.id,
        variant: 'predict',
        code: { html: step.codeHtml, language: step.language },
        question: step.question,
        ...answered(step.choices),
      };
    case 'multiple-choice': {
      const code = shown(step.code, step.codeHtml, step.language);
      return {
        kind: 'question',
        id: step.id,
        variant: 'choice',
        ...(code ? { code } : {}),
        question: step.question,
        ...answered(step.choices),
      };
    }
    case 'trace-table':
      return {
        kind: 'trace',
        id: step.id,
        prompt: step.prompt,
        code: { html: step.codeHtml, language: step.language },
        columns: step.columns,
        rows: step.rows.map(({ line, values }) => ({ line, values })),
      };
    case 'fill-blank':
      return {
        kind: 'completed',
        id: step.id,
        variant: 'fill-blank',
        prompt: step.prompt,
        solution: solutions[step.id] ?? [],
        leftOut: [],
      };
    case 'parsons':
      return {
        kind: 'completed',
        id: step.id,
        variant: 'parsons',
        prompt: step.prompt,
        solution: solutions[step.id] ?? [],
        leftOut: (step.distractors ?? []).map((distractor) => ({
          code: { html: distractor.codeHtml, language: step.language },
          why: distractor.feedback,
        })),
      };
    case 'bug-hunt':
    case 'ai-review': {
      const fix = shown(step.fix, step.fixHtml, step.language);
      return {
        kind: 'bug',
        id: step.id,
        variant: step.type,
        ...(step.type === 'ai-review' ? { request: step.request } : {}),
        prompt: step.prompt,
        code: { html: step.codeHtml, language: step.language },
        lines: step.lines,
        ...answered(step.reasons),
        ...(fix ? { fix } : {}),
      };
    }
    case 'code-challenge':
      return {
        kind: 'exercise',
        id: step.id,
        variant: 'code',
        prompt: step.prompt,
        starter: { html: step.starterHtml, language: step.language },
        hints: step.hints,
        solution: solutions[step.id] ?? [],
      };
    case 'explain-back':
      return {
        kind: 'model-answer',
        id: step.id,
        prompt: step.prompt,
        points: step.rubric,
        answer: step.modelAnswer,
      };
  }
}

function stepBlocks(
  step: CompiledStep,
  solutions: CompiledLectureExtras['solutions'],
): LectureBlock[] {
  switch (step.type) {
    case 'lab':
      // A lab is interactive and cannot print. Its intro and the step that stands in for it
      // offline carry the idea; the checkpoint question reads like any other.
      return [
        { kind: 'explanation', id: `${step.id}-intro`, body: step.intro },
        ...(step.checkpoint
          ? [
              {
                kind: 'question' as const,
                id: `${step.id}-checkpoint`,
                variant: 'checkpoint' as const,
                question: step.checkpoint.question,
                ...answered(step.checkpoint.choices),
              },
            ]
          : []),
        portableBlock(step.fallback, solutions),
      ];
    case 'incident':
      return [portableBlock(step.fallback, solutions)];
    case 'playground':
      return [
        {
          kind: 'exercise',
          id: step.id,
          variant: 'page',
          prompt: step.prompt,
          hints: step.hints ?? [],
          solution: solutions[step.id] ?? [],
        },
      ];
    case 'sql':
      return [
        {
          kind: 'exercise',
          id: step.id,
          variant: 'sql',
          prompt: step.prompt,
          hints: step.hints ?? [],
          solution: solutions[step.id] ?? [],
        },
      ];
    default:
      return [portableBlock(step, solutions)];
  }
}

const WORDS_PER_MINUTE = 200;
/** Code is read slower than prose: a line counts as this many words. */
const WORDS_PER_CODE_LINE = 4;

const FENCE = /^(```|~~~)[^\n]*\n([\s\S]*?)^\1[^\n]*$/gm;

/** Words in markdown, with each line of fenced code counted as a few words. */
export function readingWords(md: string): number {
  let codeLines = 0;
  const prose = md.replace(FENCE, (_whole, _fence, body: string) => {
    codeLines += body.split('\n').filter((line) => line.trim() !== '').length;
    return ' ';
  });
  const words = prose.split(/\s+/).filter((word) => /[\p{L}\p{N}]/u.test(word)).length;
  return words + codeLines * WORDS_PER_CODE_LINE;
}

const codeWords = (code: string): number =>
  code.split('\n').filter((line) => line.trim() !== '').length * WORDS_PER_CODE_LINE;

function blockWords(block: LectureBlock): number {
  const rich = (value: Rich) => readingWords(value.md);
  switch (block.kind) {
    case 'explanation':
      return rich(block.body);
    case 'question':
    case 'bug':
      return (
        rich(block.kind === 'question' ? block.question : block.prompt) +
        rich(block.answer) +
        rich(block.why) +
        block.wrong.reduce((sum, wrong) => sum + rich(wrong.answer) + rich(wrong.why), 0)
      );
    case 'trace':
      return rich(block.prompt) + block.rows.length * block.columns.length;
    case 'completed':
      return (
        rich(block.prompt) + block.solution.reduce((sum, file) => sum + codeWords(file.code), 0)
      );
    case 'exercise':
      return (
        rich(block.prompt) +
        block.hints.reduce((sum, hint) => sum + rich(hint), 0) +
        block.solution.reduce((sum, file) => sum + codeWords(file.code), 0)
      );
    case 'model-answer':
      return rich(block.prompt) + rich(block.answer);
  }
}

export function buildLessonLecture(
  lesson: CompiledLesson,
  extras?: CompiledLectureExtras,
): LessonLecture {
  const solutions = extras?.solutions ?? {};
  const notes = extras?.notes;
  const blocks = lesson.steps.flatMap((step) => stepBlocks(step, solutions));
  const summary = notes?.summary;
  const remember = notes?.remember ?? lesson.recap ?? [];
  const deeper = notes?.sections ?? [];
  const pitfalls = notes?.pitfalls ?? [];
  const interview = notes?.interview ?? [];
  const verify = verifyGroups(notes?.verify ?? []);
  const terms = notes?.terms ?? [];
  const flashcards = lesson.recall.map(({ id, front, back }) => ({ id, front, back }));

  const words =
    readingWords(summary?.md ?? lesson.opening.text) +
    remember.reduce((sum, line) => sum + readingWords(line.md), 0) +
    blocks.reduce((sum, block) => sum + blockWords(block), 0) +
    deeper.reduce((sum, section) => sum + readingWords(section.body.md), 0) +
    (lesson.deepDive ? readingWords(lesson.deepDive.md) : 0) +
    pitfalls.reduce((sum, line) => sum + readingWords(line.md), 0) +
    verify.reduce(
      (sum, group) => sum + group.checks.reduce((n, check) => n + readingWords(check.md), 0),
      0,
    ) +
    interview.reduce(
      (sum, qa) => sum + readingWords(qa.question.md) + readingWords(qa.answer.md),
      0,
    ) +
    terms.reduce((sum, t) => sum + readingWords(`${t.term} ${t.say} ${t.means.md}`), 0) +
    flashcards.reduce(
      (sum, card) => sum + readingWords(card.front.md) + readingWords(card.back.md),
      0,
    );

  return {
    id: lesson.id,
    moduleId: lesson.moduleId,
    moduleSlug: lesson.moduleSlug,
    slug: lesson.slug,
    title: lesson.title,
    objective: lesson.objective,
    level: lesson.level,
    lessonMinutes: lesson.minutes,
    readingMinutes: Math.max(1, Math.round(words / WORDS_PER_MINUTE)),
    assessment: lesson.assessment === true,
    ...(summary ? { summary } : {}),
    opening: lesson.opening.text,
    remember,
    blocks,
    deeper,
    ...(lesson.deepDive ? { deepDive: lesson.deepDive } : {}),
    pitfalls,
    verify,
    interview,
    terms,
    flashcards,
    references: lesson.references,
    hasNotes: notes !== undefined,
  };
}

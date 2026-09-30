import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { allLessons, COURSE_PATH } from '../../src/core/content/catalog';
import type { LessonLocation, RawCatalog, RawModule } from '../../src/core/content/catalog';
import { BUNDLE_SCHEMA } from '../../src/core/content/compiled';
import type {
  CompiledCapstoneSolution,
  CompiledGuide,
  CompiledChoice,
  CompiledCode,
  CompiledCodeChallengeTwin,
  CompiledLectureExtras,
  CompiledLesson,
  CompiledNotes,
  CompiledNotesSection,
  CompiledPortableStep,
  CompiledSolutions,
  CompiledStep,
  Manifest,
  ManifestLesson,
  ManifestModule,
  ManifestPart,
  Rich,
} from '../../src/core/content/compiled';
import { partJourney } from '../../src/core/content/parts';
import type { Outline } from '../../src/core/content/outline';
import { lessonCodeFields, lessonTextFields } from '../../src/core/content/fields';
import { editableFields, languageSchema, NEEDS_TYPING } from '../../src/core/content/schema';
import type {
  Choice,
  CodeChallengeStep,
  Language,
  Part,
  PortableStep,
  Step,
} from '../../src/core/content/schema';
import { challengeVariants, languageLabel, twinSolutionKey } from '../../src/core/content/twin';
import { fencesOf } from '../../src/core/content/style';
import { typecheckOf } from '../../src/core/typecheck/verdict';
import type {
  CapstoneSolution,
  Guide,
  LessonNotes,
  NotesSection,
} from '../../src/core/content/notes';
import type { Renderer } from './render';

/*
 * The validated catalog in, the static bundle out. `compileCatalog` is a pure function of
 * its input and the renderer, so the same content always gives the same bytes. That makes
 * the hashed file names safe to cache for ever.
 */

export interface Bundle {
  manifest: Manifest;
  /** Path relative to the bundle root, to file contents. */
  files: Map<string, string>;
}

// ---------------------------------------------------------------------------
// Deterministic JSON
// ---------------------------------------------------------------------------

function sortKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeys);
  if (value === null || typeof value !== 'object') return value;
  return Object.fromEntries(
    Object.entries(value)
      .filter(([, inner]) => inner !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
      .map(([key, inner]) => [key, sortKeys(inner)]),
  );
}

/** JSON with sorted keys. Key order carries no meaning, so it must not change the hash. */
export const stableStringify = (value: unknown, indent?: number): string =>
  JSON.stringify(sortKeys(value), null, indent);

const hash12 = (text: string): string =>
  createHash('sha256').update(text).digest('hex').slice(0, 12);

// ---------------------------------------------------------------------------
// Steps
// ---------------------------------------------------------------------------

interface Context {
  render: Renderer;
  files: Readonly<Record<string, string>>;
}

const rich = (md: string, { render }: Context): Rich => ({ md, html: render.markdown(md) });

const compileChoice = (choice: Choice, ctx: Context): CompiledChoice => ({
  ...choice,
  text: { md: choice.text, html: ctx.render.inline(choice.text) },
  feedback: rich(choice.feedback, ctx),
});

const compileChoices = (choices: readonly Choice[], ctx: Context): CompiledChoice[] =>
  choices.map((choice) => compileChoice(choice, ctx));

const BLANK = /\{\{(\d+)\}\}/g;

/**
 * `{{1}}` is not valid code, and a highlighter would split it into several tokens. An
 * identifier survives as one token, so the blank is swapped for one before highlighting
 * and swapped back for an empty slot after.
 */
function templateHtml(template: string, language: Language, { render }: Context): string {
  const highlighted = render.code(template.replace(BLANK, '__BLANK_$1__'), language);
  return highlighted.replace(/__BLANK_(\d+)__/g, '<span data-blank="$1"></span>');
}

/** The validator has already reported a missing file, so the compiler never sees one. */
function fileOf(name: string, files: Context['files']): string {
  const source = files[name];
  if (source === undefined)
    throw new Error(`Missing challenge file "${name}". Run validate:content.`);
  return source;
}

/** The twin's files and runtime, resolved the way the main files are. */
function compileTwin(step: CodeChallengeStep, ctx: Context): CompiledCodeChallengeTwin | undefined {
  const twin = challengeVariants(step)[1];
  if (step.twin === undefined || twin === undefined) return undefined;
  const { language } = step.twin;
  const starterCode = fileOf(twin.starter, ctx.files);
  return {
    language,
    starterCode,
    starterHtml: ctx.render.code(starterCode, language),
    testsCode: fileOf(twin.tests, ctx.files),
    ...(typecheckOf(twin) ? { typecheck: true as const } : {}),
    ...(twin.packages === undefined ? {} : { packages: twin.packages }),
    ...(twin.editable === undefined ? {} : { editable: twin.editable }),
  };
}

function compilePortable(step: PortableStep, ctx: Context): CompiledPortableStep {
  const { render } = ctx;
  switch (step.type) {
    case 'prose':
      return { ...step, body: rich(step.body, ctx) };
    case 'predict-output':
      return {
        ...step,
        codeHtml: render.code(step.code, step.language),
        question: rich(step.question, ctx),
        choices: compileChoices(step.choices, ctx),
      };
    case 'multiple-choice':
      return {
        ...step,
        ...(step.code === undefined
          ? {}
          : { codeHtml: render.code(step.code, step.language ?? 'text') }),
        question: rich(step.question, ctx),
        choices: compileChoices(step.choices, ctx),
      };
    case 'trace-table':
      return {
        ...step,
        codeHtml: render.code(step.code, step.language),
        prompt: rich(step.prompt, ctx),
      };
    case 'fill-blank':
      return {
        ...step,
        prompt: rich(step.prompt, ctx),
        templateHtml: templateHtml(step.template, step.language, ctx),
      };
    case 'parsons': {
      // Taken out before the spread, so the authored shape cannot leak into the result type.
      const { distractors, ...rest } = step;
      return {
        ...rest,
        prompt: rich(step.prompt, ctx),
        blocks: step.blocks.map((block) => ({
          ...block,
          codeHtml: render.code(block.code, step.language),
        })),
        ...(distractors === undefined
          ? {}
          : {
              distractors: distractors.map((distractor) => ({
                ...distractor,
                codeHtml: render.code(distractor.code, step.language),
                feedback: rich(distractor.feedback, ctx),
              })),
            }),
      };
    }
    case 'bug-hunt':
    case 'ai-review':
      return {
        ...step,
        codeHtml: render.code(step.code, step.language),
        prompt: rich(step.prompt, ctx),
        reasons: compileChoices(step.reasons, ctx),
        ...(step.fix === undefined ? {} : { fixHtml: render.code(step.fix, step.language) }),
      };
    case 'code-challenge': {
      // Built field by field: the file names are an authoring detail, and the solution
      // must not reach the lesson file even as a name.
      const starterCode = fileOf(step.starter, ctx.files);
      const twin = compileTwin(step, ctx);
      return {
        type: step.type,
        id: step.id,
        concept: step.concept,
        difficulty: step.difficulty,
        language: step.language,
        prompt: rich(step.prompt, ctx),
        starterCode,
        starterHtml: render.code(starterCode, step.language),
        testsCode: fileOf(step.tests, ctx.files),
        ...(step.hidden === undefined ? {} : { hiddenCode: fileOf(step.hidden, ctx.files) }),
        ...(step.performance === undefined
          ? {}
          : { performanceCode: fileOf(step.performance, ctx.files) }),
        ...(step.timeLimitMs === undefined ? {} : { timeLimitMs: step.timeLimitMs }),
        // Resolved here, so the app and iOS read one flag and never repeat the default.
        ...(typecheckOf(step) ? { typecheck: true as const } : {}),
        ...(step.packages === undefined ? {} : { packages: step.packages }),
        ...(step.editable === undefined ? {} : { editable: step.editable }),
        hints: step.hints.map((hint) => rich(hint, ctx)),
        ...(twin === undefined ? {} : { twin }),
      };
    }
    case 'explain-back':
      return {
        ...step,
        prompt: rich(step.prompt, ctx),
        modelAnswer: rich(step.modelAnswer, ctx),
      };
  }
}

function compileStep(step: Step, ctx: Context): CompiledStep {
  switch (step.type) {
    case 'lab': {
      const { checkpoint, ...rest } = step;
      return {
        ...rest,
        intro: rich(step.intro, ctx),
        ...(checkpoint === undefined
          ? {}
          : {
              checkpoint: {
                ...checkpoint,
                question: rich(checkpoint.question, ctx),
                choices: compileChoices(checkpoint.choices, ctx),
              },
            }),
        fallback: compilePortable(step.fallback, ctx),
      };
    }
    case 'incident':
      return { ...step, fallback: compilePortable(step.fallback, ctx) };
    case 'playground': {
      const { hints, ...rest } = step;
      return {
        ...rest,
        prompt: rich(step.prompt, ctx),
        editable: editableFields(step),
        ...(hints === undefined ? {} : { hints: hints.map((hint) => rich(hint, ctx)) }),
      };
    }
    case 'sql': {
      const { hints, ...rest } = step;
      return {
        ...rest,
        prompt: rich(step.prompt, ctx),
        setup: step.setup ?? '',
        starter: step.starter ?? '',
        ...(hints === undefined ? {} : { hints: hints.map((hint) => rich(hint, ctx)) }),
      };
    }
    default:
      return compilePortable(step, ctx);
  }
}

// ---------------------------------------------------------------------------
// Lesson, solutions, manifest
// ---------------------------------------------------------------------------

export function compileLesson(location: LessonLocation, render: Renderer): CompiledLesson {
  const { module, lesson } = location;
  const ctx: Context = { render, files: lesson.files };
  const { steps, recap, recall, deepDive, ...meta } = lesson.data;
  return {
    ...meta,
    schema: BUNDLE_SCHEMA,
    moduleId: module.data.id,
    moduleSlug: module.slug,
    slug: lesson.slug,
    steps: steps.map((step) => compileStep(step, ctx)),
    ...(recap === undefined ? {} : { recap: recap.map((line) => rich(line, ctx)) }),
    recall: recall.map((card) => ({
      ...card,
      front: rich(card.front, ctx),
      back: rich(card.back, ctx),
    })),
    ...(deepDive === undefined ? {} : { deepDive: rich(deepDive, ctx) }),
  };
}

export function compileSolutions({ lesson }: LessonLocation): CompiledSolutions | undefined {
  const entries = lesson.data.steps.flatMap((step): [string, string][] => {
    if (step.type !== 'code-challenge') return [];
    const [main, twin] = challengeVariants(step).map((variant) =>
      fileOf(variant.solution, lesson.files),
    );
    return [
      [step.id, main ?? ''],
      ...(twin === undefined ? [] : [[twinSolutionKey(step.id), twin] as [string, string]]),
    ];
  });
  if (entries.length === 0) return undefined;
  return {
    schema: BUNDLE_SCHEMA,
    lessonId: lesson.data.id,
    solutions: Object.fromEntries(entries),
  };
}

// ---------------------------------------------------------------------------
// Lecture extras and capstone solutions
// ---------------------------------------------------------------------------

const inlineRich = (md: string, { render }: Context): Rich => ({ md, html: render.inline(md) });

const compileSection = (section: NotesSection, ctx: Context): CompiledNotesSection => ({
  title: inlineRich(section.title, ctx),
  body: rich(section.body, ctx),
});

function compileNotes(notes: LessonNotes, ctx: Context): CompiledNotes {
  return {
    summary: rich(notes.summary, ctx),
    remember: notes.remember.map((line) => rich(line, ctx)),
    sections: notes.sections.map((section) => compileSection(section, ctx)),
    ...(notes.pitfalls === undefined
      ? {}
      : { pitfalls: notes.pitfalls.map((line) => rich(line, ctx)) }),
    ...(notes.interview === undefined
      ? {}
      : {
          interview: notes.interview.map((qa) => ({
            question: inlineRich(qa.question, ctx),
            answer: rich(qa.answer, ctx),
          })),
        }),
    ...(notes.terms === undefined
      ? {}
      : {
          terms: notes.terms.map(({ term, say, means }) => ({
            term,
            say,
            means: inlineRich(means, ctx),
          })),
        }),
  };
}

const PLAYGROUND_FILES = [
  ['html', 'html', 'HTML'],
  ['css', 'css', 'CSS'],
  ['js', 'js', 'JavaScript'],
  ['jsx', 'jsx', 'React'],
] as const;

/**
 * Every solution a lecture prints, highlighted once here so no page needs a highlighter: a
 * challenge's reference file, a gap-fill with its gaps filled, Parsons blocks in order, a
 * playground's fixed files and a query that passes.
 */
function lectureSolutions(steps: readonly Step[], ctx: Context): Record<string, CompiledCode[]> {
  const code = (source: string, language: Language, label?: string): CompiledCode => ({
    ...(label === undefined ? {} : { label }),
    code: source,
    html: ctx.render.code(source, language),
    language,
  });
  const entries = steps.flatMap((step): [string, CompiledCode[]][] => {
    const portable = step.type === 'lab' || step.type === 'incident' ? step.fallback : step;
    if (portable.type === 'code-challenge') {
      const variants = challengeVariants(portable);
      // Labelled only beside a twin: a single solution needs no name.
      const files = variants.map((variant) =>
        code(
          fileOf(variant.solution, ctx.files),
          variant.language,
          variants.length > 1 ? languageLabel(variant.language) : undefined,
        ),
      );
      return [[portable.id, files]];
    }
    if (portable.type === 'fill-blank') {
      const answers = new Map(portable.blanks.map((blank) => [blank.key, blank.answer]));
      const filled = portable.template.replace(
        BLANK,
        (whole, key: string) => answers.get(key) ?? whole,
      );
      return [[portable.id, [code(filled, portable.language)]]];
    }
    if (portable.type === 'parsons') {
      const unit = ' '.repeat(portable.language === 'python' ? 4 : 2);
      const arranged = portable.blocks
        .map(({ code: lines, indent = 0 }) =>
          lines
            .split('\n')
            .map((line) => unit.repeat(indent) + line)
            .join('\n'),
        )
        .join('\n');
      return [[portable.id, [code(arranged, portable.language)]]];
    }
    if (step.type === 'playground' && step.solution) {
      const solution = step.solution;
      const files = PLAYGROUND_FILES.flatMap(([field, language, label]) => {
        const source = solution[field];
        return source === undefined ? [] : [code(source, language, label)];
      });
      return files.length > 0 ? [[step.id, files]] : [];
    }
    if (step.type === 'sql' && step.solution !== undefined) {
      return [[step.id, [code(step.solution, 'sql')]]];
    }
    return [];
  });
  return Object.fromEntries(entries);
}

export function compileLectureExtras(
  location: LessonLocation,
  render: Renderer,
): CompiledLectureExtras {
  const { lesson } = location;
  const ctx: Context = { render, files: lesson.files };
  return {
    schema: BUNDLE_SCHEMA,
    lessonId: lesson.data.id,
    ...(lesson.notes ? { notes: compileNotes(lesson.notes.data, ctx) } : {}),
    solutions: lectureSolutions(lesson.data.steps, ctx),
  };
}

export function compileCapstoneSolution(
  partId: string,
  solution: CapstoneSolution,
  render: Renderer,
): CompiledCapstoneSolution {
  const ctx: Context = { render, files: {} };
  return {
    schema: BUNDLE_SCHEMA,
    partId,
    summary: rich(solution.summary, ctx),
    remember: solution.remember.map((line) => rich(line, ctx)),
    sections: solution.sections.map((section) => compileSection(section, ctx)),
    checklist: solution.checklist.map((line) => inlineRich(line, ctx)),
  };
}

export function compileGuide(id: string, guide: Guide, render: Renderer): CompiledGuide {
  const ctx: Context = { render, files: {} };
  return {
    schema: BUNDLE_SCHEMA,
    id,
    title: guide.title,
    summary: rich(guide.summary, ctx),
    sections: guide.sections.map((section) => compileSection(section, ctx)),
  };
}

interface EmittedLesson {
  entry: ManifestLesson;
  hash: string;
  files: [string, string][];
}

function emitLesson(location: LessonLocation, render: Renderer): EmittedLesson {
  const { data } = location.lesson;
  const json = stableStringify(compileLesson(location, render));
  const hash = hash12(json);
  const file = `lessons/${data.id}.${hash}.json`;

  const lectureJson = stableStringify(compileLectureExtras(location, render));
  const lectureFile = `lectures/${data.id}.${hash12(lectureJson)}.json`;

  const solutions = compileSolutions(location);
  const solutionsJson = solutions === undefined ? undefined : stableStringify(solutions);
  const solutionsFile =
    solutionsJson === undefined ? undefined : `solutions/${data.id}.${hash12(solutionsJson)}.json`;

  const entry: ManifestLesson = {
    id: data.id,
    slug: location.lesson.slug,
    title: data.title,
    objective: data.objective,
    level: data.level,
    minutes: data.minutes,
    concepts: data.concepts,
    prerequisites: data.prerequisites,
    stepCount: data.steps.length,
    stepTypes: [...new Set(data.steps.map((step) => step.type))].sort(),
    needsTyping: data.steps.some((step) => NEEDS_TYPING.has(step.type)),
    ...(data.assessment === true ? { assessment: true as const } : {}),
    file,
    ...(solutionsFile === undefined ? {} : { solutionsFile }),
    lectureFile,
  };
  const files: [string, string][] = [
    [file, json],
    [lectureFile, lectureJson],
  ];
  if (solutionsFile !== undefined && solutionsJson !== undefined) {
    files.push([solutionsFile, solutionsJson]);
  }
  return { entry, hash, files };
}

const byOrder = <T extends { order: number }>(items: readonly T[]): T[] =>
  [...items].sort((a, b) => a.order - b.order);

function manifestModule(module: RawModule, lessons: ManifestLesson[]): ManifestModule {
  const { id, number, title, summary, why, youCanBuild, lab, concepts } = module.data;
  return {
    id,
    number,
    slug: module.slug,
    title,
    summary,
    why,
    youCanBuild,
    ...(lab === undefined ? {} : { lab }),
    concepts,
    lessons,
  };
}

/**
 * Each part with its published lessons in journey order. The outline knows where woven
 * lessons are taught; without one, a part holds its own modules' lessons in module order.
 */
function manifestParts(
  parts: readonly Part[],
  modules: readonly ManifestModule[],
  outline: Outline | undefined,
  solutionFiles: ReadonlyMap<string, string> = new Map(),
): ManifestPart[] {
  const published = new Map(modules.flatMap((m) => m.lessons.map((lesson) => [lesson.id, lesson])));
  const planned = outline
    ? partJourney(outline, parts).map(({ lessons }) => lessons.map(({ lesson }) => lesson.id))
    : parts.map((part) =>
        modules
          .filter((m) => part.modules.includes(m.id))
          .flatMap((m) => m.lessons.map((l) => l.id)),
      );
  return parts.map((part, i) => {
    const lessons = (planned[i] ?? []).filter((id) => published.has(id));
    const concepts = [...new Set(lessons.flatMap((id) => published.get(id)?.concepts ?? []))];
    const { id, title, summary, capstone } = part;
    const solutionFile = solutionFiles.get(id);
    return {
      id,
      title,
      summary,
      modules: [...part.modules],
      capstone: { ...capstone, ...(solutionFile === undefined ? {} : { solutionFile }) },
      lessons,
      concepts,
    };
  });
}

export function compileCatalog(catalog: RawCatalog, render: Renderer, outline?: Outline): Bundle {
  const files = new Map<string, string>();
  const hashes: string[] = [];

  const emitModule = (module: RawModule): ManifestModule => {
    const emitted = byOrder(module.lessons).map((lesson) => emitLesson({ module, lesson }, render));
    for (const lesson of emitted) {
      hashes.push(`${lesson.entry.id}:${lesson.hash}`);
      for (const [name, json] of lesson.files) files.set(name, json);
    }
    return manifestModule(
      module,
      emitted.map((lesson) => lesson.entry),
    );
  };

  const { course } = catalog;
  // The validator reports a missing course.yaml, and the build stops there before this runs.
  if (!course)
    throw new Error(`${COURSE_PATH} is missing or invalid. Run "pnpm validate:content".`);
  const modules = byOrder(course.modules).map(emitModule);

  const solutionFiles = new Map<string, string>();
  for (const [partId, { data }] of Object.entries(course.capstones ?? {})) {
    const json = stableStringify(compileCapstoneSolution(partId, data, render));
    const name = `capstones/${partId}.${hash12(json)}.json`;
    files.set(name, json);
    solutionFiles.set(partId, name);
  }

  const guides = Object.entries(course.guides ?? {}).map(([id, { data }]) => {
    const json = stableStringify(compileGuide(id, data, render));
    const file = `guides/${id}.${hash12(json)}.json`;
    files.set(file, json);
    return { id, title: data.title, file };
  });

  // Sorted, so moving a lesson between folders does not change the revision on its own.
  const contentRev = hash12([...hashes].sort().join('\n'));
  const manifest: Manifest = {
    schema: BUNDLE_SCHEMA,
    contentRev,
    course: { title: course.data.title, summary: course.data.summary },
    modules,
    parts: manifestParts(course.data.parts ?? [], modules, outline, solutionFiles),
    guides,
  };
  files.set('manifest.json', stableStringify(manifest));
  return { manifest, files };
}

/** Every language the renderer must load: code fields, plus fences inside markdown. */
export function languagesOf(catalog: RawCatalog): Language[] {
  const found = new Set<Language>();
  for (const { lesson } of allLessons(catalog)) {
    for (const field of lessonCodeFields(lesson.data)) found.add(field.language);
    for (const field of lessonTextFields(lesson.data)) {
      for (const fence of fencesOf(field.text)) {
        const language = languageSchema.safeParse(fence.language);
        if (language.success) found.add(language.data);
      }
    }
    for (const step of lesson.data.steps) {
      if (step.type === 'code-challenge') {
        for (const variant of challengeVariants(step)) found.add(variant.language);
      }
      if (step.type === 'sql') found.add('sql');
      if (step.type === 'playground') {
        for (const [field, language] of PLAYGROUND_FILES) {
          if (step.solution?.[field] !== undefined) found.add(language);
        }
      }
    }
    const notes = lesson.notes?.data;
    const notesText = notes
      ? [
          notes.summary,
          ...notes.sections.map((section) => section.body),
          ...(notes.pitfalls ?? []),
          ...(notes.interview ?? []).map((qa) => qa.answer),
        ]
      : [];
    addFences(found, notesText);
  }
  for (const { data } of Object.values(catalog.course?.guides ?? {})) {
    addFences(found, [data.summary, ...data.sections.map((section) => section.body)]);
  }
  for (const { data } of Object.values(catalog.course?.capstones ?? {})) {
    addFences(found, [data.summary, ...data.sections.map((section) => section.body)]);
  }
  return [...found].sort();
}

function addFences(found: Set<Language>, texts: readonly string[]): void {
  for (const text of texts) {
    for (const fence of fencesOf(text)) {
      const language = languageSchema.safeParse(fence.language);
      if (language.success) found.add(language.data);
    }
  }
}

// ---------------------------------------------------------------------------
// Writing
// ---------------------------------------------------------------------------

function filesUnder(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) =>
      path.relative(dir, path.join(entry.parentPath, entry.name)).split(path.sep).join('/'),
    );
}

/**
 * Writes the bundle and deletes whatever an earlier build left behind. A file whose
 * bytes are already right is left alone, so its mtime stays put and a CDN sync skips it.
 */
export function writeBundle(outDir: string, bundle: Bundle): void {
  for (const stale of filesUnder(outDir).filter((name) => !bundle.files.has(name))) {
    fs.rmSync(path.join(outDir, stale));
  }
  for (const [name, contents] of bundle.files) {
    const target = path.join(outDir, name);
    if (fs.existsSync(target) && fs.readFileSync(target, 'utf8') === contents) continue;
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, contents);
  }
}

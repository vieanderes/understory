import { mkdtempSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  compiledLectureExtrasSchema,
  compiledLessonSchema,
  compiledSolutionsSchema,
  manifestSchema,
} from '@/core/content/compiled-schema';
import type { CompiledLesson, Manifest } from '@/core/content/compiled';
import { compileCatalog, languagesOf, stableStringify, writeBundle } from '../../../../scripts/lib/compile';
import type { Bundle } from '../../../../scripts/lib/compile';
import { createRenderer } from '../../../../scripts/lib/render';
import type { Renderer } from '../../../../scripts/lib/render';
import { outlineSchema } from '@/core/content/outline';
import { CHALLENGE_FILES, lessonOf, stepOf, validCatalog } from '../../core/content/fixtures';

/** Marks what it was given, so a test can see which renderer a field went through. */
const fakeRenderer: Renderer = {
  markdown: (md) => `<block>${md}</block>`,
  inline: (md) => `<inline>${md}</inline>`,
  code: (code, language) => `<code-${language}>${code}</code-${language}>`,
};

const lessonFile = (bundle: Bundle): [string, CompiledLesson] => {
  const entry = [...bundle.files].find(([name]) => name.startsWith('lessons/'));
  if (!entry) throw new Error('the bundle has no lesson file');
  return [entry[0], JSON.parse(entry[1]) as CompiledLesson];
};

const manifestOf = (bundle: Bundle): Manifest =>
  JSON.parse(bundle.files.get('manifest.json') ?? '{}') as Manifest;

function stepIn<T extends CompiledLesson['steps'][number]['type']>(
  lesson: CompiledLesson,
  type: T,
): Extract<CompiledLesson['steps'][number], { type: T }> {
  const step = lesson.steps.find(
    (s): s is Extract<CompiledLesson['steps'][number], { type: T }> => s.type === type,
  );
  if (!step) throw new Error(`no ${type} step`);
  return step;
}

describe('stableStringify', () => {
  it('sorts object keys at every depth and keeps array order', () => {
    expect(stableStringify({ b: 1, a: { d: [3, 1, 2], c: null } })).toBe(
      '{"a":{"c":null,"d":[3,1,2]},"b":1}',
    );
  });

  it('drops undefined, as JSON does', () => {
    expect(stableStringify({ a: undefined, b: 1 })).toBe('{"b":1}');
  });
});

describe('compileCatalog', () => {
  const bundle = compileCatalog(validCatalog(), fakeRenderer);
  const [fileName, lesson] = lessonFile(bundle);
  const manifest = manifestOf(bundle);

  it('names the lesson file after the id and the hash of its own bytes', () => {
    expect(fileName).toMatch(/^lessons\/js\.coercion\.[0-9a-f]{12}\.json$/);
  });

  it('turns block markdown into Rich and choice text into inline Rich', () => {
    expect(stepIn(lesson, 'prose').body).toEqual({
      md: 'The quantity field holds text, not a number.',
      html: '<block>The quantity field holds text, not a number.</block>',
    });
    const choice = stepIn(lesson, 'predict-output').choices[0];
    expect(choice?.text.html).toBe('<inline>`"21"`</inline>');
    expect(choice?.feedback.html).toMatch(/^<block>/);
    expect(choice?.correct).toBe(true);
    expect(lesson.recall[0]?.front.html).toMatch(/^<block>/);
  });

  it('gives every code field a highlighted sibling', () => {
    expect(stepIn(lesson, 'predict-output').codeHtml).toMatch(/^<code-js>const quantity/);
    expect(stepIn(lesson, 'trace-table').codeHtml).toContain('<code-js>');
    expect(stepIn(lesson, 'bug-hunt').codeHtml).toContain('<code-js>');
    expect(stepIn(lesson, 'parsons').blocks[0]?.codeHtml).toBe('<code-js>const raw = "2";</code-js>');
    expect(stepIn(lesson, 'parsons').distractors?.[0]?.codeHtml).toContain('raw + 1');
  });

  it('omits codeHtml when a multiple-choice step has no code', () => {
    expect(stepIn(lesson, 'multiple-choice')).not.toHaveProperty('codeHtml');
  });

  it('marks blanks in the highlighted template', () => {
    const step = stepIn(lesson, 'fill-blank');
    expect(step.template).toContain('{{1}}');
    expect(step.templateHtml).toContain('<span data-blank="1"></span>(quantity)');
    expect(step.templateHtml).toContain('<span data-blank="2"></span>');
    expect(step.templateHtml).not.toContain('{{');
    expect(step.templateHtml).not.toContain('BLANK');
  });

  it('inlines the starter and the tests of a code challenge', () => {
    const step = stepIn(lesson, 'code-challenge');
    expect(step.starterCode).toBe(CHALLENGE_FILES['starter.ts']);
    expect(step.testsCode).toBe(CHALLENGE_FILES['tests.ts']);
    expect(step.starterHtml).toContain('<code-ts>');
    expect(step.hints).toHaveLength(3);
    expect(step).not.toHaveProperty('starter');
    expect(step).not.toHaveProperty('solution');
  });

  it('carries the editable region of a code challenge, and nothing when there is none', () => {
    expect(stepIn(lesson, 'code-challenge')).not.toHaveProperty('editable');
    const catalog = validCatalog();
    stepOf(lessonOf(catalog), 'code-challenge').editable = '2';
    const [, withRegion] = lessonFile(compileCatalog(catalog, fakeRenderer));
    expect(stepIn(withRegion, 'code-challenge').editable).toBe('2');
  });

  it('keeps the reference solution out of the lesson file', () => {
    const [, json] = [...bundle.files].find(([name]) => name.startsWith('lessons/')) ?? ['', ''];
    expect(json).not.toContain('return 3');
    // The tests may import "./solution", so only the key is ruled out, not the word.
    expect(json).not.toContain('"solution"');
  });

  it('ships the solution in its own file, keyed by step id', () => {
    const entry = [...bundle.files].find(([name]) => name.startsWith('solutions/'));
    expect(entry?.[0]).toMatch(/^solutions\/js\.coercion\.[0-9a-f]{12}\.json$/);
    const solutions = compiledSolutionsSchema.parse(JSON.parse(entry?.[1] ?? '{}'));
    expect(solutions).toEqual({
      schema: 1,
      lessonId: 'js.coercion',
      solutions: { 'write-total': CHALLENGE_FILES['solution.ts'] },
    });
  });

  describe('verify follow-ups, explain-back frames and before-you-ship checks', () => {
    const catalog = validCatalog();
    const raw = lessonOf(catalog);
    stepOf(raw, 'bug-hunt').verify = {
      question: 'Which input proves the fix?',
      choices: [
        { text: 'A string `"2"`', correct: true, feedback: 'It shows the join.' },
        { text: 'The number 2', feedback: 'Numbers add already.' },
      ],
    };
    Object.assign(stepOf(raw, 'explain-back'), { audience: 'reviewer', kind: 'decide' });
    raw.notes = {
      path: 'content/course/03-javascript/01-coercion/notes.yaml',
      data: {
        summary: 'Coercion turns one type into another.',
        remember: ['One.', 'Two.', 'Three.'],
        sections: [{ title: 'How', body: 'Like so.' }],
        verify: [
          { lens: 'tests', check: 'Feed a `"2"` and assert `3`.' },
          { lens: 'breaks', check: 'Form fields are strings.' },
        ],
      },
    };
    const compiled = compileCatalog(catalog, fakeRenderer);
    const [, framed] = lessonFile(compiled);

    it('renders the verify question as Rich and its choices like any choice', () => {
      const verify = stepIn(framed, 'bug-hunt').verify;
      expect(verify?.question.html).toBe('<block>Which input proves the fix?</block>');
      expect(verify?.choices[0]?.text.html).toBe('<inline>A string `"2"`</inline>');
      expect(verify?.choices[0]?.correct).toBe(true);
      expect(compiledLessonSchema.safeParse(framed).error?.issues).toBeUndefined();
    });

    it('carries the explain-back frame as written', () => {
      expect(stepIn(framed, 'explain-back')).toMatchObject({ audience: 'reviewer', kind: 'decide' });
      expect(stepIn(lesson, 'explain-back')).not.toHaveProperty('audience');
    });

    it('ships the before-you-ship checks in the lecture extras, inline', () => {
      const entry = [...compiled.files].find(([name]) => name.startsWith('lectures/'));
      const extras = compiledLectureExtrasSchema.parse(JSON.parse(entry?.[1] ?? '{}'));
      expect(extras.notes?.verify).toEqual([
        { lens: 'tests', check: { md: 'Feed a `"2"` and assert `3`.', html: '<inline>Feed a `"2"` and assert `3`.</inline>' } },
        { lens: 'breaks', check: { md: 'Form fields are strings.', html: '<inline>Form fields are strings.</inline>' } },
      ]);
    });
  });

  describe('a challenge with a twin', () => {
    const PY = {
      'starter.py': 'def total(xs):\n    pass\n',
      'solution.py': 'def total(xs):\n    return 3\n',
      'tests.py': 'def test_total():\n    assert total([1, 2]) == 3\n',
    };
    const catalog = validCatalog();
    const raw = lessonOf(catalog);
    stepOf(raw, 'code-challenge').twin = {
      language: 'python',
      starter: 'starter.py',
      solution: 'solution.py',
      tests: 'tests.py',
      editable: '2',
    };
    raw.files = { ...raw.files, ...PY };
    const twinned = compileCatalog(catalog, fakeRenderer);
    const [, twinLesson] = lessonFile(twinned);
    const fileStarting = (prefix: string): unknown =>
      JSON.parse([...twinned.files].find(([name]) => name.startsWith(prefix))?.[1] ?? '{}');

    it('carries the twin files and runtime, resolved like the main ones', () => {
      expect(stepIn(twinLesson, 'code-challenge').twin).toEqual({
        language: 'python',
        starterCode: PY['starter.py'],
        starterHtml: `<code-python>${PY['starter.py']}</code-python>`,
        testsCode: PY['tests.py'],
        editable: '2',
      });
      expect(compiledLessonSchema.safeParse(twinLesson).success).toBe(true);
    });

    it('keeps the twin solution out of the lesson and ships it under "<id>:twin"', () => {
      expect(JSON.stringify(twinLesson)).not.toContain('return 3');
      expect(compiledSolutionsSchema.parse(fileStarting('solutions/')).solutions).toEqual({
        'write-total': CHALLENGE_FILES['solution.ts'],
        'write-total:twin': PY['solution.py'],
      });
    });

    it('gives the lecture both solutions, each labelled with its language', () => {
      const extras = compiledLectureExtrasSchema.parse(fileStarting('lectures/'));
      expect(extras.solutions['write-total']?.map(({ label, language }) => [label, language])).toEqual([
        ['TypeScript', 'ts'],
        ['Python', 'python'],
      ]);
    });

    it('asks the highlighter for the twin language', () => {
      expect(languagesOf(catalog)).toContain('python');
    });

    it('resolves the type check of a TypeScript twin', () => {
      const ts = validCatalog();
      const lessonTs = lessonOf(ts);
      const step = stepOf(lessonTs, 'code-challenge');
      step.language = 'python';
      step.twin = { language: 'ts', starter: 'twin.starter.ts', solution: 'twin.solution.ts', tests: 'twin.tests.ts' };
      lessonTs.files = { ...lessonTs.files, 'twin.starter.ts': 'a', 'twin.solution.ts': 'b', 'twin.tests.ts': 'c' };
      const [, compiled] = lessonFile(compileCatalog(ts, fakeRenderer));
      expect(stepIn(compiled, 'code-challenge').twin?.typecheck).toBe(true);
    });
  });

  it('writes no solutions file for a lesson with no code challenge', () => {
    const catalog = validCatalog();
    const data = lessonOf(catalog).data;
    data.steps = data.steps.filter((step) => step.type !== 'code-challenge');
    const names = [...compileCatalog(catalog, fakeRenderer).files.keys()];
    expect(names.some((name) => name.startsWith('solutions/'))).toBe(false);
    expect(manifestOf(compileCatalog(catalog, fakeRenderer)).modules[0]?.lessons[0])
      .not.toHaveProperty('solutionsFile');
  });

  it('compiles the fallback of a lab like any other step', () => {
    const lab = stepIn(lesson, 'lab');
    expect(lab.intro.html).toMatch(/^<block>/);
    expect(lab.checkpoint?.question.html).toMatch(/^<block>/);
    expect(lab.fallback.type).toBe('multiple-choice');
    if (lab.fallback.type === 'multiple-choice') {
      expect(lab.fallback.question.html).toMatch(/^<block>/);
    }
  });

  it('records where the lesson lives', () => {
    expect(lesson).toMatchObject({
      schema: 1,
      moduleId: 'js',
      moduleSlug: 'javascript',
      slug: 'coercion',
    });
  });

  it('produces a lesson that matches the compiled contract', () => {
    expect(compiledLessonSchema.safeParse(lesson).error?.issues).toBeUndefined();
  });

  it('produces a manifest that matches the contract', () => {
    expect(manifestSchema.safeParse(manifest).error?.issues).toBeUndefined();
  });

  it('summarises each lesson in the manifest', () => {
    const entry = manifest.modules[0]?.lessons[0];
    expect(entry).toMatchObject({
      id: 'js.coercion',
      slug: 'coercion',
      level: 'essential',
      minutes: 12,
      concepts: ['js.coercion'],
      prerequisites: [],
      stepCount: 11,
      needsTyping: true,
      file: fileName,
    });
    expect(entry?.stepTypes).toEqual([...(entry?.stepTypes ?? [])].sort());
    expect(entry?.stepTypes).toContain('lab');
    expect(entry?.solutionsFile).toMatch(/^solutions\//);
  });

  it('leaves no track id on the lesson', () => {
    expect(lesson).not.toHaveProperty('trackId');
  });

  it('holds the one course and its modules at the top of the manifest', () => {
    expect(manifest.course).toEqual({ title: 'The course', summary: 'From a page to a system.' });
    expect(manifest.modules.map((m) => m.id)).toEqual(['js']);
    expect(manifest).not.toHaveProperty('tracks');
  });

  it('refuses a catalog with no course', () => {
    const catalog = validCatalog();
    delete catalog.course;
    expect(() => compileCatalog(catalog, fakeRenderer)).toThrowError(/course\.yaml/);
  });

  it('lists no parts for a course that has none', () => {
    expect(manifest.parts).toEqual([]);
  });

  describe('parts', () => {
    const capstone = { title: 'A cart', brief: 'Build a cart.' };
    const withParts = () => {
      const catalog = validCatalog();
      if (!catalog.course) throw new Error('fixture');
      catalog.course.data = {
        ...catalog.course.data,
        parts: [
          { id: 'first', title: 'First', summary: 'You can code.', modules: ['js'], capstone },
          { id: 'later', title: 'Later', summary: 'You can ship.', modules: ['go'], capstone },
        ],
      };
      return catalog;
    };
    const outline = outlineSchema.parse({
      modules: [
        {
          id: 'js',
          dir: '03-javascript',
          lessons: [
            { id: 'js.closures', dir: '01-closures', title: 'Closures', objective: 'Trace it.', level: 'essential', concepts: ['js.equality', 'js.coercion'] },
            { id: 'js.coercion', dir: '02-coercion', title: 'Coercion', objective: 'Predict it.', level: 'essential', concepts: ['js.coercion', 'js.equality'] },
          ],
        },
      ],
    });

    it('lists each part with its published lessons and their concepts in journey order', () => {
      const { parts } = manifestOf(compileCatalog(withParts(), fakeRenderer, outline));
      expect(parts[0]).toEqual({
        id: 'first',
        title: 'First',
        summary: 'You can code.',
        modules: ['js'],
        capstone,
        lessons: ['js.coercion'],
        concepts: ['js.coercion'],
      });
      expect(parts[1]?.lessons).toEqual([]);
    });

    it('falls back to module order when there is no outline', () => {
      const { parts } = manifestOf(compileCatalog(withParts(), fakeRenderer));
      expect(parts.map((p) => p.lessons)).toEqual([['js.coercion'], []]);
    });

    it('matches the manifest contract', () => {
      const bundle = compileCatalog(withParts(), fakeRenderer, outline);
      expect(manifestSchema.safeParse(manifestOf(bundle)).success).toBe(true);
    });
  });

  it('carries module why, number, slug and concepts in the manifest', () => {
    expect(manifest.modules[0]).toMatchObject({
      id: 'js',
      number: 3,
      slug: 'javascript',
      why: 'Every later chapter builds on it.',
    });
    expect(manifest.modules[0]?.concepts.map((c) => c.id)).toContain('js.equality');
  });

  it('derives contentRev from the lesson hashes', () => {
    expect(manifest.contentRev).toMatch(/^[0-9a-f]{12}$/);
    const changed = validCatalog();
    stepOf(lessonOf(changed), 'prose').body = 'A different sentence.';
    expect(manifestOf(compileCatalog(changed, fakeRenderer)).contentRev).not.toBe(
      manifest.contentRev,
    );
  });

  it('is deterministic: the same input gives byte-identical files', () => {
    const again = compileCatalog(validCatalog(), fakeRenderer);
    expect([...again.files]).toEqual([...bundle.files]);
  });

  it('does not depend on the key order of the input', () => {
    const catalog = validCatalog();
    const lessonData = lessonOf(catalog).data;
    const reversed = Object.fromEntries(Object.entries(lessonData).reverse());
    lessonOf(catalog).data = reversed as typeof lessonData;
    expect([...compileCatalog(catalog, fakeRenderer).files]).toEqual([...bundle.files]);
  });

  it('lists the languages the highlighter must load, fences included', () => {
    const catalog = validCatalog();
    stepOf(lessonOf(catalog), 'prose').body = 'Run this.\n\n```bash\nls\n```';
    expect(languagesOf(catalog)).toEqual(['bash', 'js', 'ts']);
  });
});

describe('writeBundle', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'understory-bundle-'));
  afterAll(() => rmSync(dir, { recursive: true, force: true }));

  const listing = () =>
    readdirSync(dir, { recursive: true, withFileTypes: true })
      .filter((entry) => entry.isFile())
      .map((entry) => path.relative(dir, path.join(entry.parentPath, entry.name)))
      .sort();

  it('writes every file of the bundle', () => {
    const bundle = compileCatalog(validCatalog(), fakeRenderer);
    writeBundle(dir, bundle);
    expect(listing()).toEqual([...bundle.files.keys()].sort());
    expect(readFileSync(path.join(dir, 'manifest.json'), 'utf8')).toBe(
      bundle.files.get('manifest.json'),
    );
  });

  it('removes files left by an earlier build', () => {
    mkdirSync(path.join(dir, 'lessons'), { recursive: true });
    writeFileSync(path.join(dir, 'lessons/js.old.000000000000.json'), '{}');
    const bundle = compileCatalog(validCatalog(), fakeRenderer);
    writeBundle(dir, bundle);
    expect(listing()).toEqual([...bundle.files.keys()].sort());
  });
});

describe('with the real renderer', () => {
  let renderer: Renderer;
  let bundle: Bundle;
  beforeAll(async () => {
    renderer = await createRenderer(languagesOf(validCatalog()));
    bundle = compileCatalog(validCatalog(), renderer);
  });

  it('emits no colour literals, only CSS variables', () => {
    for (const [name, json] of bundle.files) {
      expect(json, name).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
      expect(json, name).not.toMatch(/\b(?:rgb|rgba|hsl|hsla|oklch)\(/);
    }
    expect(lessonFile(bundle)[1].steps.some((s) => JSON.stringify(s).includes('var(--shiki-'))).toBe(
      true,
    );
  });

  it('replaces blanks after highlighting, so the markers survive tokenising', () => {
    const step = stepIn(lessonFile(bundle)[1], 'fill-blank');
    expect(step.templateHtml.match(/data-blank="\d"/g)).toEqual(['data-blank="1"', 'data-blank="2"']);
    expect(step.templateHtml).not.toContain('BLANK');
  });

  it('is deterministic across two full runs', () => {
    expect([...compileCatalog(validCatalog(), renderer).files]).toEqual([...bundle.files]);
  });
});

import { describe, expect, it } from 'vitest';
import { BUNDLE_SCHEMA } from '@/core/content/compiled';
import type { CompiledLesson, Manifest, Rich } from '@/core/content/compiled';
import {
  compiledLessonSchema,
  compiledStepSchema,
  manifestSchema,
} from '@/core/content/compiled-schema';

const rich = (md: string): Rich => ({ md, html: `<p>${md}</p>` });

const challenge = {
  type: 'code-challenge',
  id: 'write-total',
  concept: 'js.coercion',
  difficulty: 4,
  language: 'ts',
  prompt: rich('Write `cartTotal`.'),
  starterCode: 'export function cartTotal() {}',
  starterHtml: '<pre>export function cartTotal() {}</pre>',
  testsCode: "test('adds', () => {});",
  hints: [rich('One.'), rich('Two.'), rich('Three.')],
} as const;

const prose = (id: string) => ({ type: 'prose', id, body: rich('Text.') }) as const;

const lesson: CompiledLesson = {
  schema: BUNDLE_SCHEMA,
  id: 'js.coercion',
  moduleId: 'js',
  moduleSlug: 'javascript',
  slug: 'coercion',
  title: 'Values, types and coercion',
  objective: 'Predict the result of `+`.',
  level: 'essential',
  minutes: 12,
  concepts: ['js.coercion'],
  prerequisites: [],
  opening: { text: 'The cart shows 21.' },
  steps: [prose('a'), prose('b'), prose('c'), { ...challenge, hints: [...challenge.hints] }],
  recall: [1, 2, 3].map((n) => ({
    id: `card-${n}`,
    concept: 'js.coercion',
    front: rich('Front?'),
    back: rich('Back.'),
  })),
  references: [{ kind: 'spec', title: 'ECMAScript Language Specification', verified: false }],
};

describe('compiledLessonSchema', () => {
  it('accepts a compiled lesson', () => {
    expect(compiledLessonSchema.safeParse(lesson).error?.issues).toBeUndefined();
  });

  it('rejects a markdown field that was left as a string', () => {
    const raw = { ...lesson, steps: [{ type: 'prose', id: 'a', body: 'Text.' }, ...lesson.steps] };
    expect(compiledLessonSchema.safeParse(raw).success).toBe(false);
  });

  it('rejects a bundle from another schema version', () => {
    expect(compiledLessonSchema.safeParse({ ...lesson, schema: 2 }).success).toBe(false);
  });
});

describe('compiledStepSchema', () => {
  it('accepts a compiled code challenge', () => {
    expect(compiledStepSchema.safeParse(challenge).success).toBe(true);
  });

  it('has no place for a reference solution, not even its file name', () => {
    expect(compiledStepSchema.safeParse({ ...challenge, solution: 'solution.ts' }).success).toBe(
      false,
    );
    expect(compiledStepSchema.safeParse({ ...challenge, solutionCode: 'x' }).success).toBe(false);
  });
});

describe('manifestSchema', () => {
  const manifest: Manifest = {
    schema: BUNDLE_SCHEMA,
    contentRev: '0123456789ab',
    course: { title: 'The course', summary: 'Everything, in one place.' },
    modules: [],
    parts: [],
    guides: [],
  };

  it('needs the parts, and a part id that is one lowercase word', () => {
    const withoutParts: Partial<Manifest> = { ...manifest };
    delete withoutParts.parts;
    expect(manifestSchema.safeParse(withoutParts).success).toBe(false);
    const part = {
      id: 'first-code',
      title: 'First code',
      summary: 'You can code.',
      modules: ['basics'],
      capstone: { title: 'A page', brief: 'Build a page.' },
      lessons: [],
      concepts: [],
    };
    expect(manifestSchema.safeParse({ ...manifest, parts: [part] }).success).toBe(false);
    expect(manifestSchema.safeParse({ ...manifest, parts: [{ ...part, id: 'firstcode' }] }).success).toBe(true);
  });

  it('accepts an empty manifest', () => {
    expect(manifestSchema.safeParse(manifest).success).toBe(true);
  });

  it('holds one course, not a list of tracks', () => {
    const { schema, contentRev, course, modules } = manifest;
    const tracks = [{ id: 'web', ...course, modules }];
    expect(manifestSchema.safeParse({ schema, contentRev, tracks }).success).toBe(false);
    expect(manifestSchema.safeParse({ schema, contentRev, modules }).success).toBe(false);
  });

  it('needs a 12-character hex revision', () => {
    expect(manifestSchema.safeParse({ ...manifest, contentRev: 'latest' }).success).toBe(false);
  });
});

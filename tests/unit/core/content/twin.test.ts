import { describe, expect, it } from 'vitest';
import type { CompiledCodeChallengeStep } from '@/core/content/compiled';
import type { CodeChallengeStep } from '@/core/content/schema';
import {
  challengeLanguages,
  challengeVariants,
  chooseLanguage,
  inLanguage,
  languageLabel,
  twinSolutionKey,
} from '@/core/content/twin';

const rich = (md: string) => ({ md, html: `<p>${md}</p>` });

function compiled(over: Partial<CompiledCodeChallengeStep> = {}): CompiledCodeChallengeStep {
  return {
    type: 'code-challenge',
    id: 'write-total',
    concept: 'js.coercion',
    difficulty: 3,
    language: 'ts',
    prompt: rich('Write `total`.'),
    starterCode: 'export function total() {}',
    starterHtml: '<pre>ts</pre>',
    testsCode: "test('ts', () => {});",
    typecheck: true,
    editable: '1',
    hints: [rich('a'), rich('b'), rich('c')],
    twin: {
      language: 'python',
      starterCode: 'def total():\n    pass',
      starterHtml: '<pre>py</pre>',
      testsCode: 'def test_py(): pass',
      packages: ['numpy'],
    },
    ...over,
  };
}

function authored(over: Partial<CodeChallengeStep> = {}): CodeChallengeStep {
  return {
    type: 'code-challenge',
    id: 'write-total',
    concept: 'js.coercion',
    difficulty: 3,
    prompt: 'Write `total`.',
    language: 'ts',
    starter: 'starter.ts',
    solution: 'solution.ts',
    tests: 'tests.ts',
    hints: ['a', 'b', 'c'],
    ...over,
  };
}

describe('languageLabel', () => {
  it('names each challenge language the way the switch shows it', () => {
    expect(languageLabel('ts')).toBe('TypeScript');
    expect(languageLabel('js')).toBe('JavaScript');
    expect(languageLabel('python')).toBe('Python');
    expect(languageLabel('tsx')).toBe('React');
  });
});

describe('twinSolutionKey', () => {
  it('sits beside the step id, so the main solution keeps its own key', () => {
    expect(twinSolutionKey('write-total')).toBe('write-total:twin');
  });
});

describe('challengeLanguages', () => {
  it('lists the main language first, then the twin', () => {
    expect(challengeLanguages(compiled())).toEqual(['ts', 'python']);
    expect(challengeLanguages(compiled({ twin: undefined }))).toEqual(['ts']);
  });
});

describe('chooseLanguage', () => {
  it('takes the preference when the step offers it', () => {
    expect(chooseLanguage(compiled(), 'python')).toBe('python');
    expect(chooseLanguage(compiled(), 'ts')).toBe('ts');
  });

  it('falls back to the main language without a preference or a twin', () => {
    expect(chooseLanguage(compiled(), null)).toBe('ts');
    expect(chooseLanguage(compiled(), 'js')).toBe('ts');
    expect(chooseLanguage(compiled({ twin: undefined }), 'python')).toBe('ts');
  });
});

describe('inLanguage', () => {
  it('returns the step itself in its main language', () => {
    const step = compiled();
    expect(inLanguage(step, 'ts')).toBe(step);
  });

  it('swaps in the twin files and runtime, keeping the shared prompt, hints and id', () => {
    const step = compiled();
    const twin = inLanguage(step, 'python');
    expect(twin.language).toBe('python');
    expect(twin.starterCode).toBe('def total():\n    pass');
    expect(twin.starterHtml).toBe('<pre>py</pre>');
    expect(twin.testsCode).toBe('def test_py(): pass');
    expect(twin.packages).toEqual(['numpy']);
    // The main step's type check and locked lines belong to its own files.
    expect(twin.typecheck).toBeUndefined();
    expect(twin.editable).toBeUndefined();
    expect(twin.twin).toBeUndefined();
    expect(twin.id).toBe(step.id);
    expect(twin.prompt).toBe(step.prompt);
    expect(twin.hints).toBe(step.hints);
  });

  it('carries the twin type check and locked lines when it has them', () => {
    const step = compiled({
      language: 'python',
      typecheck: undefined,
      packages: ['numpy'],
      twin: {
        language: 'ts',
        starterCode: 'a',
        starterHtml: 'b',
        testsCode: 'c',
        typecheck: true,
        editable: '2-3',
      },
    });
    const twin = inLanguage(step, 'ts');
    expect(twin.typecheck).toBe(true);
    expect(twin.editable).toBe('2-3');
    expect(twin.packages).toBeUndefined();
  });

  it('ignores a language the step does not have', () => {
    const step = compiled({ twin: undefined });
    expect(inLanguage(step, 'python')).toBe(step);
  });
});

describe('challengeVariants', () => {
  it('is the step alone when it has no twin', () => {
    const step = authored();
    expect(challengeVariants(step)).toEqual([step]);
  });

  it('adds the twin as a step of its own, without the main-only settings', () => {
    const step = authored({
      typecheck: false,
      expectStarterTypeError: true,
      editable: '1',
      hidden: 'hidden.ts',
      twin: {
        language: 'python',
        starter: 'starter.py',
        solution: 'solution.py',
        tests: 'tests.py',
        packages: ['numpy'],
        editable: '2',
      },
    });
    const [main, twin] = challengeVariants(step);
    expect(main).toBe(step);
    expect(twin).toMatchObject({
      id: 'write-total',
      language: 'python',
      starter: 'starter.py',
      solution: 'solution.py',
      tests: 'tests.py',
      packages: ['numpy'],
      editable: '2',
    });
    for (const key of ['typecheck', 'expectStarterTypeError', 'hidden', 'twin'] as const) {
      expect(twin).not.toHaveProperty(key);
    }
  });
});

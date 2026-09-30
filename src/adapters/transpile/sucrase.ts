import type { ScriptLanguage, Transpiler } from '@/core/ports/code-runner';
import { TranspileError } from '@/core/running/transpile-error';

/**
 * Sucrase turns learner source into a plain script.
 *
 * - `typescript` removes types. Sucrase does not type-check, which is the point: it is
 *   small and fast enough to run on every keystroke-triggered run in the browser.
 * - `imports` rewrites ES module syntax to CommonJS. `export function add` stays a
 *   top-level `function add` and gains `exports.add = add`; `export default` becomes
 *   `exports.default`. The harness supplies `exports` and a `require` that hands the
 *   learner's exports to a relative import in the tests. A regular expression over
 *   `export` would also rewrite the word inside strings and templates; a parser does not.
 * - `jsx`, for `tsx` only, uses the automatic runtime: `<p />` becomes a call to `jsx`
 *   from 'react/jsx-runtime', which the React runtime of the sandbox provides, so a
 *   component file needs no `import React`. `production` picks `jsx` over `jsxDEV`: the
 *   development build of React still checks keys, and file names would be noise.
 * - ES transforms are off. The sandbox targets current browsers, and rewriting optional
 *   chaining or class fields would only move line and column positions around.
 *
 * Sucrase keeps every statement on its original line, so runtime line numbers still
 * point at what the learner typed.
 */

type SucraseTransform = (
  code: string,
  options: {
    transforms: ('typescript' | 'jsx' | 'imports')[];
    disableESTransforms: boolean;
    jsxRuntime?: 'automatic';
    production?: boolean;
  },
) => { code: string };

const TRANSFORMS: Record<ScriptLanguage, ('typescript' | 'jsx' | 'imports')[]> = {
  js: ['imports'],
  ts: ['typescript', 'imports'],
  tsx: ['typescript', 'jsx', 'imports'],
};

interface SucraseSyntaxError {
  message: string;
  loc?: { line?: unknown };
}

function isSyntaxError(value: unknown): value is SucraseSyntaxError {
  return typeof value === 'object' && value !== null && 'message' in value;
}

export function createSucraseTranspiler(transform: SucraseTransform): Transpiler {
  return {
    strip(src: string, lang: ScriptLanguage): string {
      try {
        return transform(src, {
          transforms: TRANSFORMS[lang],
          disableESTransforms: true,
          ...(lang === 'tsx' ? { jsxRuntime: 'automatic' as const, production: true } : {}),
        }).code;
      } catch (caught) {
        if (!isSyntaxError(caught)) throw new TranspileError(String(caught));
        const line = typeof caught.loc?.line === 'number' ? caught.loc.line : undefined;
        // Sucrase appends "(line:column)" to the text. The line travels as a field.
        const message = String(caught.message).replace(/\s*\(\d+:\d+\)$/, '');
        throw new TranspileError(message, line);
      }
    },
  };
}

let loading: Promise<Transpiler> | undefined;

/**
 * Loads sucrase on first use. The dynamic import keeps its parser (about 250 KB of
 * source) out of the main bundle: only a learner who runs code pays for it.
 */
export function loadTranspiler(): Promise<Transpiler> {
  loading ??= import('sucrase').then(
    (sucrase) => createSucraseTranspiler(sucrase.transform),
    (reason: unknown) => {
      // A failed chunk load (offline, deploy in progress) must be retryable.
      loading = undefined;
      throw reason;
    },
  );
  return loading;
}

import { fetchPythonAssets, fetchPythonPackages } from '@/adapters/pyodide/assets';
import { IframeRunner } from '@/adapters/sandbox/iframe-runner';
import { loadTranspiler } from '@/adapters/transpile/sucrase';
import type { CodeRunner, RunProgress } from '@/core/ports/code-runner';

/** A runner that owns something outside React (here: a hidden iframe) and can let it go. */
export interface DisposableRunner extends CodeRunner {
  dispose(): void;
}

/**
 * The browser sandbox, wired. It lives in its own module so that a code step can import
 * it on the first run: the runner, its protocol schemas and, behind `loadTranspiler`,
 * sucrase are paid for by learners who run code and by nobody else. Pyodide, about 5 MB
 * compressed, is fetched on the first Python run only, and numpy, pandas or pydantic on
 * the first run that imports them.
 */
export function createSandboxRunner(
  options: { onProgress?: (progress: RunProgress) => void } = {},
): DisposableRunner {
  return new IframeRunner({
    loadTranspiler,
    loadPythonAssets: () => fetchPythonAssets(),
    loadPythonPackages: (names, have) => fetchPythonPackages(names, have),
    ...(options.onProgress ? { onProgress: options.onProgress } : {}),
  });
}

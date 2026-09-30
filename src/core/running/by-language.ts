import type { CodeRunner, RunRequest, RunResult, RunSignal } from '../ports/code-runner';

/**
 * One runner in front of two: JavaScript and TypeScript to one, Python to the other.
 * The Python side may be a factory, so that nobody starts Pyodide for a catalogue, a
 * test file or a page that has no Python in it.
 */
export function byLanguage(runners: {
  script: CodeRunner;
  python: CodeRunner | (() => CodeRunner);
}): CodeRunner {
  let python: CodeRunner | null = null;
  const pythonRunner = (): CodeRunner =>
    (python ??= typeof runners.python === 'function' ? runners.python() : runners.python);
  return {
    run(req: RunRequest, signal?: RunSignal): Promise<RunResult> {
      return req.language === 'python'
        ? pythonRunner().run(req, signal)
        : runners.script.run(req, signal);
    },
  };
}

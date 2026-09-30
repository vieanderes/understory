/**
 * The body of the worker thread, as CommonJS source for `new Worker(source, { eval: true })`.
 * A string, not a file, so the runner works the same under tsx, vitest and plain Node
 * without a build step or a path that moves.
 *
 * It mirrors the browser worker: fresh global, harness first, then `__load`, then `__run`.
 * The `vm` context is a convenience for a clean global, not a security boundary: a
 * script can climb out of it through any host function it is handed. The CI gate runs
 * reviewed lesson content, never learner input, and docs/SANDBOX.md says so.
 */
export const NODE_WORKER_SOURCE = String.raw`
'use strict';
const { parentPort, workerData } = require('node:worker_threads');
const vm = require('node:vm');

const post = (message) => parentPort.postMessage(message);

// V8 reports the place of a syntax error only when it compiles a named script, and the
// harness uses eval. Compiling first (without running) recovers the line for authors.
function syntaxErrorOf(source, filename) {
  try {
    new vm.Script('"use strict";' + source, { filename });
    return null;
  } catch (thrown) {
    const stack = thrown && typeof thrown.stack === 'string' ? thrown.stack : '';
    const match = new RegExp(filename.replace('.', '\\.') + ':(\\d+)').exec(stack);
    return {
      name: String((thrown && thrown.name) || 'SyntaxError'),
      message: String((thrown && thrown.message) || thrown),
      line: match ? Number(match[1]) : undefined,
    };
  }
}

function main() {
  const { harness, code, tests, runtime } = workerData;

  // A test that awaits a promise nobody settles leaves the event loop empty, and Node
  // would end the thread: "exited" here, "timeout" in a browser. Holding the loop open
  // makes both runtimes say timeout. The parent terminates the thread either way.
  setInterval(() => {}, 2147483647);

  const codeError = syntaxErrorOf(code, 'learner.js');
  if (codeError) {
    const error = { name: codeError.name, message: codeError.message };
    if (codeError.line !== undefined) error.line = codeError.line;
    return post({ type: 'done', report: { status: 'error', tests: [], logs: [], error } });
  }
  const testsError = syntaxErrorOf(tests, 'tests.js');
  if (testsError) {
    const at = testsError.line === undefined ? '' : ' (tests, line ' + testsError.line + ')';
    const error = { name: testsError.name, message: testsError.message + at };
    return post({ type: 'done', report: { status: 'error', tests: [], logs: [], error } });
  }

  // What a Web Worker would also offer and lessons may rely on. Nothing from Node.
  const context = vm.createContext({
    setTimeout,
    clearTimeout,
    setInterval,
    clearInterval,
    queueMicrotask,
    structuredClone,
    AbortController,
    AbortSignal,
    TextEncoder,
    TextDecoder,
    __hostLog: (line) => post({ type: 'log', line: String(line) }),
  });
  // The React runtime of a tsx run, as a global script before the harness: the same
  // order and the same mode as the browser worker's indirect eval.
  if (typeof runtime === 'string') {
    vm.runInContext(runtime, context, { filename: 'react-runtime.v1.js' });
  }
  vm.runInContext(harness, context, { filename: 'harness.v1.js' });
  context.__load(code, tests, { separateScopes: typeof runtime === 'string' });
  context.__run().then(
    (report) => post({ type: 'done', report: JSON.parse(JSON.stringify(report)) }),
    (reason) => post({ type: 'crash', message: String(reason) }),
  );
}

try {
  main();
} catch (thrown) {
  post({ type: 'crash', message: String(thrown) });
}
`;

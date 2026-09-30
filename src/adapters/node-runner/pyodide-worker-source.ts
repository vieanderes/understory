/**
 * The body of the Python worker thread, as CommonJS source for
 * `new Worker(source, { eval: true })`. A string for the same reason as worker-source.ts.
 *
 * Unlike the JavaScript worker it lives across runs: starting Pyodide takes a second or
 * more, a run a few milliseconds. The parent sends one `{ runId, code, tests, packages }`
 * at a time and kills the thread when a run overstays; the next thread starts fresh.
 *
 * Packages load from `packageDir`, where the gate has put the pinned wheels
 * (src/adapters/pyodide/wheels.ts), and are imported once before `started`, so neither
 * the download nor the first import (pandas takes seconds) counts against a run's budget.
 * Runs go through `run_async`, so a test may be an `async def`: Pyodide's event loop in
 * Node runs on Node's own timers.
 *
 * As with the JavaScript runner, this is not a security boundary. The gate runs reviewed
 * lesson content only (docs/SANDBOX.md).
 */
export const NODE_PYODIDE_WORKER_SOURCE = String.raw`
'use strict';
const { parentPort, workerData } = require('node:worker_threads');

const post = (message) => parentPort.postMessage(message);
const text = (thrown) => String(thrown && thrown.message ? thrown.message : thrown).slice(0, 2000);

async function main() {
  const { loadPyodide } = require(workerData.pyodidePath);
  const pyodide = await loadPyodide({
    packageCacheDir: workerData.packageDir,
    stdout: () => {},
    stderr: () => {},
  });
  const scope = pyodide.globals.get('dict')();
  pyodide.runPython(workerData.harness, { globals: scope });
  const runAsync = scope.get('run_async');
  const installed = new Set();
  const quiet = { messageCallback: () => {}, errorCallback: () => {} };

  async function prepare(packages) {
    const missing = packages.filter((name) => !installed.has(name));
    if (missing.length === 0) return;
    await pyodide.loadPackage(missing, quiet);
    for (const name of missing) {
      pyodide.runPython('import ' + name);
      installed.add(name);
    }
  }

  async function serve(message) {
    const runId = message.runId;
    const log = (line) => post({ type: 'log', runId, line: String(line) });
    try {
      await prepare(Array.isArray(message.packages) ? message.packages : []);
    } catch (thrown) {
      const report = { status: 'error', tests: [], logs: [], error: { name: 'SandboxError', message: 'A package could not be loaded: ' + text(thrown) } };
      post({ type: 'done', runId, report, fatal: false });
      return;
    }
    post({ type: 'started', runId });
    let report;
    let fatal = false;
    try {
      report = JSON.parse(await runAsync(message.code, message.tests, log));
    } catch (thrown) {
      // The harness catches everything the code raises. Reaching here means the
      // interpreter itself failed, and it is not trusted with another run.
      fatal = true;
      report = { status: 'error', tests: [], logs: [], error: { name: 'PythonError', message: text(thrown) } };
    }
    post({ type: 'done', runId, report, fatal });
  }

  parentPort.on('message', (message) => {
    void serve(message);
  });
  post({ type: 'ready' });
}

main().catch((thrown) => {
  post({ type: 'boot-error', message: text(thrown) });
});
`;

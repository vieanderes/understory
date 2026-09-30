/**
 * Builds the source of the Web Worker that runs Python: Pyodide plus the Python harness.
 *
 * Unlike the JavaScript worker (worker-source.ts) it lives across runs, because starting
 * Pyodide takes a second or more and a run a few milliseconds. The frame kills it when a
 * run overstays and starts a new one.
 *
 * It cannot fetch Pyodide: it inherits the frame's `default-src 'none'`. The frame posts
 * the files, which the parent fetched on the app origin (src/adapters/pyodide/assets.ts),
 * and the worker starts Pyodide from them:
 *
 *  - the loader and the runtime are evaluated with indirect eval ('unsafe-eval' is already
 *    the point of the frame). Both assign to globalThis, and the loader skips fetching
 *    the runtime when `_createPyodideModule` already exists;
 *  - for the other three files (lock file, standard library, wasm binary) the loader calls
 *    `fetch`. Until the start is done, `fetch` is a function that answers those three
 *    names from memory and refuses everything else. Then it is blocked with the rest of
 *    the network APIs, before any learner code runs;
 *  - package wheels (numpy, pandas, pydantic) arrive later, in a `packages` message, when
 *    a run first needs them. Pyodide's `loadPackage` fetches them by name, so the blocked
 *    `fetch` still answers exactly those names from memory and throws for anything else.
 *    It can reach nothing the worker was not handed. A run's packages are loaded and
 *    imported before the worker says `started`, so the first import of pandas, which
 *    takes seconds, never counts against the run's budget.
 *
 * Runs go through the harness's `run_async`, which Pyodide turns into a promise on its
 * event loop (the webloop, on the worker's timers), so a test may be an `async def`.
 *
 * So the CSP is unchanged: nothing here needs `connect-src`, and WebAssembly compiles
 * under the 'unsafe-eval' the frame already has.
 */
import { BLOCKED_CALLABLES, BLOCKED_NAVIGATOR, BLOCKED_VALUES } from './worker-source';

const BODY = String.raw`
  var scope = self;
  var post = scope.postMessage.bind(scope);
  var listen = scope.addEventListener.bind(scope);
  var ResponseClass = scope.Response;
  var decoder = new TextDecoder();
  var send = function (message) {
    message.nonce = NONCE;
    post(message);
  };

  // Never fetched: the name only has to parse as a URL, so the loader can join paths.
  var INDEX_URL = 'https://pyodide.invalid/';
  var SERVED = {
    'pyodide-lock.json': ['lock', 'application/json'],
    'python_stdlib.zip': ['stdlib', 'application/zip'],
    'pyodide.asm.wasm': ['wasm', 'application/wasm']
  };

  function replace(owner, name, replacement) {
    for (var o = owner; o; o = Object.getPrototypeOf(o)) {
      if (!Object.prototype.hasOwnProperty.call(o, name)) continue;
      try {
        Object.defineProperty(o, name, { value: replacement, writable: false, configurable: false, enumerable: false });
      } catch (ignored) {
        try { o[name] = replacement; } catch (alsoIgnored) {}
      }
    }
  }
  function blocked(name) {
    return function () {
      throw new Error(name + ' is not available in the sandbox');
    };
  }
  function lockDown() {
    BLOCKED_CALLABLES.forEach(function (name) {
      if (name in scope) replace(scope, name, name === 'fetch' ? servePackages : blocked(name));
    });
    BLOCKED_VALUES.forEach(function (name) {
      if (name in scope) replace(scope, name, undefined);
    });
    if (typeof navigator === 'object' && navigator) {
      BLOCKED_NAVIGATOR.forEach(function (name) {
        if (name in navigator) replace(navigator, name, undefined);
      });
    }
    replace(scope, 'postMessage', function () {});
  }

  function text(error) {
    return String(error && error.message ? error.message : error).slice(0, 2000);
  }

  var pyodide = null;
  var runHarness = null;
  var booting = false;
  // Wheels by file name, and the packages this interpreter has already imported.
  var wheels = Object.create(null);
  var installed = Object.create(null);
  var quiet = { messageCallback: function () {}, errorCallback: function () {} };

  function wheelResponse(url) {
    var name = url.slice(url.lastIndexOf('/') + 1);
    if (!Object.prototype.hasOwnProperty.call(wheels, name)) return null;
    return new ResponseClass(wheels[name], { headers: { 'Content-Type': 'application/zip' } });
  }
  // What fetch is once the interpreter has started: wheels from memory, nothing else.
  function servePackages(input) {
    var response = wheelResponse(String(input && input.url ? input.url : input));
    if (response === null) throw new TypeError('fetch is not available in the sandbox');
    return Promise.resolve(response);
  }

  function boot(files) {
    (0, eval)(decoder.decode(files.loader));
    (0, eval)(decoder.decode(files.runtime));
    scope.fetch = function (input) {
      var url = String(input && input.url ? input.url : input);
      var entry = SERVED[url.slice(url.lastIndexOf('/') + 1)];
      if (!entry) return Promise.reject(new TypeError('fetch is not available in the sandbox'));
      return Promise.resolve(new ResponseClass(files[entry[0]], { headers: { 'Content-Type': entry[1] } }));
    };
    return scope.loadPyodide({ indexURL: INDEX_URL, stdout: function () {}, stderr: function () {} }).then(function (started) {
      pyodide = started;
      var globals = pyodide.globals.get('dict')();
      pyodide.runPython(HARNESS, { globals: globals });
      runHarness = globals.get('run_async');
      lockDown();
      send({ type: 'ready' });
    });
  }

  function prepare(packages) {
    var missing = packages.filter(function (name) { return !installed[name]; });
    if (missing.length === 0) return Promise.resolve();
    return Promise.resolve(pyodide.loadPackage(missing, quiet)).then(function () {
      missing.forEach(function (name) {
        // The frame checked the names against the three the runners ship.
        pyodide.runPython('import ' + name);
        installed[name] = true;
      });
    });
  }

  function run(message) {
    var runId = String(message.runId);
    var log = function (line) {
      send({ type: 'log', runId: runId, line: String(line).slice(0, 4000) });
    };
    var packages = Array.isArray(message.packages) ? message.packages.map(String) : [];
    var finish = function (report, fatal) {
      send({ type: 'done', runId: runId, report: report, fatal: fatal });
    };
    var failed = function (name, error) {
      return { status: 'error', tests: [], logs: [], error: { name: name, message: text(error) } };
    };
    prepare(packages).then(function () {
      send({ type: 'started', runId: runId });
      var pending;
      try {
        pending = runHarness(String(message.code), String(message.tests), log);
      } catch (error) {
        finish(failed('PythonError', error), true);
        return;
      }
      return Promise.resolve(pending).then(function (json) {
        finish(JSON.parse(json), false);
      }, function (error) {
        // The harness catches everything the code raises. This is the interpreter itself
        // failing, and it is not trusted with another run.
        finish(failed('PythonError', error), true);
      });
    }, function (error) {
      finish(failed('SandboxError', 'A package could not be loaded: ' + text(error)), false);
    });
  }

  listen('message', function (event) {
    var message = event.data;
    if (!message || typeof message !== 'object') return;
    if (message.type === 'boot' && !booting) {
      booting = true;
      // Inside a promise, so a loader that throws while it is evaluated is reported too.
      Promise.resolve(message.files).then(boot).catch(function (error) {
        send({ type: 'boot-error', message: text(error) });
      });
      return;
    }
    if (message.type === 'packages' && message.files && typeof message.files === 'object') {
      Object.keys(message.files).forEach(function (name) {
        wheels[name] = message.files[name];
      });
      return;
    }
    if (message.type === 'run' && runHarness !== null) run(message);
  });
`;

export interface PythonWorkerSourceParts {
  harness: string;
  nonce: string;
}

export function buildPythonWorkerSource(parts: PythonWorkerSourceParts): string {
  const constants = [
    `var NONCE = ${JSON.stringify(parts.nonce)};`,
    `var HARNESS = ${JSON.stringify(parts.harness)};`,
    `var BLOCKED_CALLABLES = ${JSON.stringify(BLOCKED_CALLABLES)};`,
    `var BLOCKED_VALUES = ${JSON.stringify(BLOCKED_VALUES)};`,
    `var BLOCKED_NAVIGATOR = ${JSON.stringify(BLOCKED_NAVIGATOR)};`,
  ].join('\n');
  return `(function () {\n'use strict';\n${constants}\n${BODY}\n})();\n`;
}

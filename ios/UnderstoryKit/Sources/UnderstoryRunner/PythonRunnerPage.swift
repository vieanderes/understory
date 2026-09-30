import Foundation

/// The documents the hidden web view of `PythonRunner` loads, all served by
/// `RunnerSchemeHandler` from `understory-runner://runner/`.
///
/// The shape is the browser's (src/adapters/sandbox/frame/python-worker-source.ts and
/// python-host.ts): a page that owns a warm Pyodide worker and hands it one run at a
/// time, and a worker that starts Pyodide from files posted to it, answers the loader's
/// three `fetch` calls from memory and then blocks the network APIs before any learner
/// code runs. Package wheels reach the worker the same way, when a run first needs them,
/// and the blocked `fetch` answers exactly those names from memory. A run's budget starts
/// when the worker says `started`, after its packages are imported. A run that overstays
/// terminates the worker, and the page starts a new one.
enum PythonRunnerPage {
  static let scheme = "understory-runner"
  static let origin = "understory-runner://runner/"

  /// Nothing but this origin, and no inline script. The worker has its own, stricter
  /// policy (`workerPolicy`).
  static let pagePolicy =
    "default-src 'none'; script-src 'self'; connect-src 'self'; worker-src 'self'"

  /// The worker loads nothing at all: its files arrive by message. Evaluating the loader
  /// needs 'unsafe-eval', compiling the interpreter 'wasm-unsafe-eval'.
  static let workerPolicy = "default-src 'none'; script-src 'unsafe-eval' 'wasm-unsafe-eval'"

  static let html = """
    <!doctype html>
    <html lang="en">
    <meta charset="utf-8">
    <title>Python runner</title>
    <script src="host.js"></script>
    </html>
    """

  /// The page. Two entry points for the host, called with `callAsyncJavaScript`:
  /// `understoryBoot()` and `understoryRun(runId, code, tests, timeoutMs, packages, wheels)`,
  /// which resolves with a JSON string
  /// `{ kind: 'report' | 'timeout' | 'crash', report?, logs, message? }`. `wheels` are the
  /// file names the packages need, from the pinned manifest.
  static let hostScript = #"""
    'use strict';
    (function () {
      var ORIGIN = 'understory-runner://runner/';
      var FILES = {
        loader: 'pyodide.js',
        runtime: 'pyodide.asm.js',
        wasm: 'pyodide.asm.wasm',
        stdlib: 'python_stdlib.zip',
        lock: 'pyodide-lock.json'
      };
      var MAX_LOG_LINES = 200;
      var files = null;
      var harness = null;
      // Wheels by file name, kept for the page's life and handed to every worker it starts.
      var wheels = {};
      var worker = null;
      var ready = null;
      var onRunMessage = null;

      function fetchFile(path, as) {
        return fetch(ORIGIN + path).then(function (response) {
          if (!response.ok) throw new Error('Python could not be loaded (' + path + ', ' + response.status + ').');
          return as === 'text' ? response.text() : response.arrayBuffer();
        });
      }

      function loadFiles() {
        if (files !== null) return Promise.resolve();
        var keys = Object.keys(FILES);
        return Promise.all(keys.map(function (key) { return fetchFile('pyodide/' + FILES[key]); }))
          .then(function (buffers) {
            var loaded = {};
            keys.forEach(function (key, index) { loaded[key] = buffers[index]; });
            return fetchFile('python-harness.v1.py', 'text').then(function (text) {
              harness = text;
              files = loaded;
            });
          });
      }

      function discard() {
        if (worker !== null) worker.terminate();
        worker = null;
        ready = null;
        onRunMessage = null;
      }

      function start() {
        var own = new Worker(ORIGIN + 'python-worker.js');
        worker = own;
        ready = loadFiles().then(function () {
          return new Promise(function (resolve, reject) {
            own.onmessage = function (event) {
              var message = event.data;
              if (!message || typeof message !== 'object') return;
              if (message.type === 'ready') resolve();
              else if (message.type === 'boot-error') reject(new Error(String(message.message)));
              else if (onRunMessage !== null) onRunMessage(message);
            };
            own.onerror = function (event) {
              var text = (event && event.message) || 'The Python worker stopped.';
              reject(new Error(text));
              if (onRunMessage !== null) onRunMessage({ type: 'crash', message: text });
            };
            // Copied, not transferred: the page keeps them for the next worker.
            own.postMessage({ type: 'boot', files: files, harness: harness });
            if (Object.keys(wheels).length > 0) own.postMessage({ type: 'packages', files: wheels });
          });
        });
        // A start that failed is forgotten, so the next run tries again.
        ready.catch(function () { if (worker === own) discard(); });
        return ready;
      }

      function whenReady() {
        return ready !== null ? ready : start();
      }

      window.understoryBoot = function () {
        return whenReady().then(function () { return true; });
      };

      function loadWheels(names) {
        var missing = names.filter(function (name) { return !Object.prototype.hasOwnProperty.call(wheels, name); });
        if (missing.length === 0) return Promise.resolve();
        return Promise.all(missing.map(function (name) { return fetchFile('pyodide/' + name); }))
          .then(function (buffers) {
            var fresh = {};
            missing.forEach(function (name, index) {
              wheels[name] = buffers[index];
              fresh[name] = buffers[index];
            });
            if (worker !== null) worker.postMessage({ type: 'packages', files: fresh });
          });
      }

      window.understoryRun = function (runId, code, tests, timeoutMs, packages, wheelNames) {
        return whenReady().then(function () {
          return loadWheels(wheelNames || []);
        }).then(function () {
          var own = worker;
          return new Promise(function (resolve) {
            var logs = [];
            var settled = false;
            var timer = 0;
            function settle(outcome) {
              if (settled) return;
              settled = true;
              clearTimeout(timer);
              onRunMessage = null;
              outcome.logs = logs;
              resolve(JSON.stringify(outcome));
            }
            onRunMessage = function (message) {
              if (message.type === 'crash') {
                discard();
                settle({ kind: 'crash', message: String(message.message) });
                return;
              }
              if (message.runId !== runId) return;
              if (message.type === 'started') {
                // The budget starts once the packages are imported and the code is about to
                // run, as in the frame: a slow first import of pandas is not the learner's.
                timer = setTimeout(function () {
                  // Python cannot be interrupted, so the worker goes and a new one starts
                  // now, which the next run finds half warm.
                  discard();
                  start();
                  settle({ kind: 'timeout' });
                }, timeoutMs);
                return;
              }
              if (message.type === 'log') {
                if (logs.length <= MAX_LOG_LINES) logs.push(String(message.line).slice(0, 4000));
                return;
              }
              if (message.type === 'done') {
                // An interpreter that failed itself is not trusted with another run.
                if (message.fatal === true) { discard(); start(); }
                settle({ kind: 'report', report: JSON.stringify(message.report) });
              }
            };
            own.postMessage({ type: 'run', runId: runId, code: code, tests: tests, packages: packages || [] });
          });
        });
      };
    })();
    """#

  /// The worker: python-worker-source.ts's body, with the files and the harness arriving
  /// in the boot message instead of being baked into a blob. Runs go through the harness's
  /// `run_async`, so a test may be an `async def`.
  static let workerScript = #"""
    'use strict';
    (function () {
      var scope = self;
      var post = scope.postMessage.bind(scope);
      var listen = scope.addEventListener.bind(scope);
      var ResponseClass = scope.Response;
      var decoder = new TextDecoder();

      var BLOCKED_CALLABLES = ['fetch', 'XMLHttpRequest', 'WebSocket', 'WebSocketStream', 'WebTransport',
        'EventSource', 'importScripts', 'Worker', 'SharedWorker', 'BroadcastChannel'];
      var BLOCKED_VALUES = ['indexedDB', 'caches', 'cookieStore'];
      var BLOCKED_NAVIGATOR = ['sendBeacon', 'storage', 'serviceWorker', 'locks'];

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
        return function () { throw new Error(name + ' is not available in the sandbox'); };
      }
      function lockDown() {
        BLOCKED_CALLABLES.forEach(function (name) {
          if (name in scope) replace(scope, name, name === 'fetch' ? servePackages : blocked(name));
        });
        BLOCKED_VALUES.forEach(function (name) { if (name in scope) replace(scope, name, undefined); });
        if (typeof navigator === 'object' && navigator) {
          BLOCKED_NAVIGATOR.forEach(function (name) { if (name in navigator) replace(navigator, name, undefined); });
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

      // What fetch is once the interpreter has started: wheels from memory, nothing else.
      function servePackages(input) {
        var url = String(input && input.url ? input.url : input);
        var name = url.slice(url.lastIndexOf('/') + 1);
        if (!Object.prototype.hasOwnProperty.call(wheels, name)) {
          throw new TypeError('fetch is not available in the sandbox');
        }
        return Promise.resolve(new ResponseClass(wheels[name], { headers: { 'Content-Type': 'application/zip' } }));
      }

      function boot(message) {
        var files = message.files;
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
          pyodide.runPython(String(message.harness), { globals: globals });
          runHarness = globals.get('run_async');
          lockDown();
          post({ type: 'ready' });
        });
      }

      function prepare(packages) {
        var missing = packages.filter(function (name) { return !installed[name]; });
        if (missing.length === 0) return Promise.resolve();
        return Promise.resolve(pyodide.loadPackage(missing, quiet)).then(function () {
          missing.forEach(function (name) {
            // The host checked the names against the three the app ships.
            pyodide.runPython('import ' + name);
            installed[name] = true;
          });
        });
      }

      function run(message) {
        var runId = String(message.runId);
        var log = function (line) {
          post({ type: 'log', runId: runId, line: String(line).slice(0, 4000) });
        };
        var packages = Array.isArray(message.packages) ? message.packages.map(String) : [];
        var finish = function (report, fatal) {
          post({ type: 'done', runId: runId, report: report, fatal: fatal });
        };
        var failed = function (name, error) {
          return { status: 'error', tests: [], logs: [], error: { name: name, message: text(error) } };
        };
        prepare(packages).then(function () {
          post({ type: 'started', runId: runId });
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
            // The harness catches everything the code raises. This is the interpreter
            // itself failing, and it is not trusted with another run.
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
          Promise.resolve(message).then(boot).catch(function (error) {
            post({ type: 'boot-error', message: text(error) });
          });
          return;
        }
        if (message.type === 'packages' && message.files && typeof message.files === 'object') {
          Object.keys(message.files).forEach(function (name) { wheels[name] = message.files[name]; });
          return;
        }
        if (message.type === 'run' && runHarness !== null) run(message);
      });
    })();
    """#
}

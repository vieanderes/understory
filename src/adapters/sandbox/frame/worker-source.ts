/**
 * Builds the source of the Web Worker that runs one learner submission.
 *
 * Layout: one outer function holds the secrets (the nonce and the only reference to
 * `postMessage`), blocks the network and storage APIs, evaluates the React runtime when
 * the run has one and then the harness, then
 * loads and runs the submission. Learner code is evaluated by the harness through
 * indirect eval, which runs in the global scope and so cannot see this closure.
 */

/**
 * Defence in depth only. The wall is the frame's CSP (`default-src 'none'`, so no
 * connect-src) and its opaque origin (so no storage). These stubs turn a silent CSP
 * block into a readable error and cover a browser that gets one of those two wrong.
 */
export const BLOCKED_CALLABLES = [
  'fetch',
  'XMLHttpRequest',
  'WebSocket',
  'WebSocketStream',
  'WebTransport',
  'EventSource',
  'importScripts',
  'Worker',
  'SharedWorker',
  'BroadcastChannel',
] as const;

export const BLOCKED_VALUES = ['indexedDB', 'caches', 'cookieStore'] as const;

export const BLOCKED_NAVIGATOR = ['sendBeacon', 'storage', 'serviceWorker', 'locks'] as const;

const PRELUDE = String.raw`
  var scope = self;
  var post = scope.postMessage.bind(scope);
  var send = function (message) {
    message.nonce = NONCE;
    post(message);
  };
  // First, so the frame can revoke the blob URL while learner code is still to come.
  send({ type: 'started' });

  // Replaces the property wherever it lives on the prototype chain, so the original
  // cannot be fetched back from WorkerGlobalScope.prototype.
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
  BLOCKED_CALLABLES.forEach(function (name) {
    if (name in scope) replace(scope, name, blocked(name));
  });
  BLOCKED_VALUES.forEach(function (name) {
    if (name in scope) replace(scope, name, undefined);
  });
  if (typeof navigator === 'object' && navigator) {
    BLOCKED_NAVIGATOR.forEach(function (name) {
      if (name in navigator) replace(navigator, name, undefined);
    });
  }
  // The closure keeps the only way to talk to the frame. A forged "done" would need it.
  replace(scope, 'postMessage', function () {});

  var finished = false;
  function finish(report) {
    if (finished) return;
    finished = true;
    send({ type: 'done', report: report });
  }
  function crash(name, message) {
    finish({ status: 'error', tests: [], logs: [], error: { name: String(name).slice(0, 200), message: String(message).slice(0, 2000) } });
  }
  // Node ends a worker thread on an unhandled rejection. Doing the same here keeps the
  // CI gate and the browser in agreement about such code.
  scope.addEventListener('unhandledrejection', function (event) {
    var reason = event && event.reason;
    crash('UnhandledRejection', reason && reason.message ? reason.message : String(reason));
  });

  scope.__hostLog = function (line) {
    send({ type: 'log', line: String(line).slice(0, 4000) });
  };
`;

// The React runtime of a tsx run. Indirect eval runs it as a plain script in the global
// scope, the way the Node gate runs it with vm.runInContext, so both see the same code
// in the same mode.
const RUNTIME_LOADER = String.raw`
  if (RUNTIME !== null) (0, eval)(RUNTIME + '\n//# sourceURL=react-runtime.v1.js');
`;

const POSTLUDE = String.raw`
  var load = scope.__load;
  var run = scope.__run;
  delete scope.__load;
  delete scope.__run;
  load(CODE, TESTS, { separateScopes: RUNTIME !== null });
  run().then(finish, function (reason) {
    crash('HarnessError', reason);
  });
`;

export interface WorkerSourceParts {
  harness: string;
  /** Plain JavaScript: already transpiled by the parent. */
  code: string;
  tests: string;
  nonce: string;
  /** The React runtime for a tsx run. Also puts code and tests in separate scopes. */
  runtime?: string;
}

export function buildWorkerSource(parts: WorkerSourceParts): string {
  // JSON.stringify yields a valid JavaScript literal for any string (ES2019 onwards),
  // so learner text is data here and can never close a quote and become bootstrap code.
  const constants = [
    `var NONCE = ${JSON.stringify(parts.nonce)};`,
    `var CODE = ${JSON.stringify(parts.code)};`,
    `var TESTS = ${JSON.stringify(parts.tests)};`,
    `var RUNTIME = ${parts.runtime === undefined ? 'null' : JSON.stringify(parts.runtime)};`,
    `var BLOCKED_CALLABLES = ${JSON.stringify(BLOCKED_CALLABLES)};`,
    `var BLOCKED_VALUES = ${JSON.stringify(BLOCKED_VALUES)};`,
    `var BLOCKED_NAVIGATOR = ${JSON.stringify(BLOCKED_NAVIGATOR)};`,
  ].join('\n');
  return `(function () {\n'use strict';\n${constants}\n${PRELUDE}\n${RUNTIME_LOADER}\n${parts.harness}\n${POSTLUDE}\n})();\n`;
}

/**
 * The test harness, version 1, as source text.
 *
 * It is a string because three runtimes evaluate the very same bytes: a Web Worker in
 * the sandbox frame, a `node:vm` context in the CI gate and, later, JavaScriptCore on
 * iOS (public/sandbox/harness.v1.js is this string written to disk). It may use nothing
 * beyond ES2020 built-ins: no DOM, no Node, no timers, no `console` of the host.
 *
 * Host contract:
 *  1. Optionally define these globals first. The harness takes each and removes it, so
 *     learner code cannot find it:
 *     - `__hostLog = (line) => ...`, a sink for console output as it happens,
 *     - `__hostModules = { name: exports }`, what a package import resolves to,
 *     - `__hostMatchers = { name: (actual, ...args) => ({ pass, message, negatedMessage }) }`,
 *       extra matchers for `expect` (a built-in matcher of the same name wins),
 *     - `__hostAfterEach = () => ...`, run after every test; a throw fails that test.
 *     The React runtime of tsx runs sets the last three (docs/SANDBOX.md).
 *  2. Evaluate this script. It defines `test`, `it`, `describe`, `expect`, `console`,
 *     `printed`, `exports`, `module`, `require`, `__load` and `__run`.
 *  3. Call `__load(code, tests, options?)`. Both are plain JavaScript. They are evaluated
 *     as ONE strict script through indirect eval, so tests can call the learner's
 *     top-level functions, and a syntax or load error is caught instead of killing the
 *     host. With `{ separateScopes: true }` each gets its own function scope in that
 *     script, and they meet only through exports and `require('./...')`.
 *     (A host without eval may append code and tests to this script instead.)
 *  4. Await `__run()`. It resolves, never rejects, with
 *     `{ status: 'passed' | 'failed' | 'error', tests, logs, error? }`.
 *
 * Learner code shares a scope with the tests, so it can cheat: shadow `expect`, or
 * register its own passing tests. That is accepted. Grading is local and only the
 * learner loses. The harness guards the host, not the mark.
 *
 * Written with String.raw so regular expressions keep their backslashes. The text must
 * therefore contain no backtick and no dollar-brace.
 */
export const HARNESS_VERSION = 1;

export const HARNESS_V1: string = String.raw`/* Understory test harness v1. Generated from src/core/running/harness.ts. */
(function (g) {
  'use strict';

  // Kept in step with src/core/running/limits.ts by a unit test.
  var MAX_LOG_LINES = 200;
  var MAX_LOG_BYTES = 65536;
  var MAX_LOG_LINE_LENGTH = 4000;
  var MAX_TESTS = 200;
  var MAX_NAME_LENGTH = 200;
  var MAX_MESSAGE_LENGTH = 2000;
  var TRUNCATION_NOTICE = '[Output truncated: more than 200 lines or 64 KB]';
  var SOURCE_NAME = 'learner.js';

  // Host hooks are taken once and removed, so learner code cannot find or replace them.
  function take(name) {
    var value = g[name];
    try {
      delete g[name];
    } catch (ignored) {
      g[name] = undefined;
    }
    return value;
  }
  var hostLog = take('__hostLog');
  if (typeof hostLog !== 'function') hostLog = null;
  var hostModules = take('__hostModules');
  if (hostModules === null || typeof hostModules !== 'object') hostModules = {};
  var hostMatchers = take('__hostMatchers');
  if (hostMatchers === null || typeof hostMatchers !== 'object') hostMatchers = {};
  var hostAfterEach = take('__hostAfterEach');
  if (typeof hostAfterEach !== 'function') hostAfterEach = null;

  var toStringTag = Object.prototype.toString;
  var hasOwn = Object.prototype.hasOwnProperty;

  function tagOf(value) {
    return toStringTag.call(value).slice(8, -1);
  }

  function clip(text, max) {
    return text.length > max ? text.slice(0, max - 3) + '...' : text;
  }

  // ---- Formatting: how values appear in failure messages and in the console ----------

  function formatKey(key) {
    return /^[A-Za-z_$][\w$]*$/.test(key) ? key : JSON.stringify(key);
  }

  function formatList(items, open, close) {
    return items.length === 0 ? open + close : open + items.join(', ') + close;
  }

  function formatInner(value, depth, seen) {
    var type = typeof value;
    if (type === 'string') return JSON.stringify(value);
    if (type === 'number') return Object.is(value, -0) ? '-0' : String(value);
    if (type === 'bigint') return String(value) + 'n';
    if (type === 'function') return '[Function ' + (value.name || 'anonymous') + ']';
    if (value === null || type !== 'object') return String(value);

    if (seen.indexOf(value) !== -1) return '[Circular]';
    var tag = tagOf(value);
    if (tag === 'Date') return isNaN(value.getTime()) ? 'Date(Invalid)' : 'Date(' + value.toISOString() + ')';
    if (tag === 'RegExp') return String(value);
    if (value instanceof Error) return (value.name || 'Error') + ': ' + value.message;
    if (depth >= 5) return tag === 'Array' ? '[Array]' : '[' + tag + ']';

    var next = seen.concat([value]);
    var items = [];
    var limit = 50;
    if (Array.isArray(value) || ArrayBuffer.isView(value)) {
      for (var i = 0; i < value.length && i < limit; i++) items.push(formatInner(value[i], depth + 1, next));
      if (value.length > limit) items.push('... ' + (value.length - limit) + ' more');
      return (tag === 'Array' ? '' : tag + ' ') + formatList(items, '[', ']');
    }
    if (tag === 'Map') {
      value.forEach(function (v, k) {
        if (items.length < limit) items.push(formatInner(k, depth + 1, next) + ' => ' + formatInner(v, depth + 1, next));
      });
      if (value.size > limit) items.push('... ' + (value.size - limit) + ' more');
      return 'Map ' + formatList(items, '{', '}');
    }
    if (tag === 'Set') {
      value.forEach(function (v) {
        if (items.length < limit) items.push(formatInner(v, depth + 1, next));
      });
      if (value.size > limit) items.push('... ' + (value.size - limit) + ' more');
      return 'Set ' + formatList(items, '{', '}');
    }
    var keys = Object.keys(value);
    for (var k = 0; k < keys.length && k < limit; k++) {
      items.push(formatKey(keys[k]) + ': ' + formatInner(value[keys[k]], depth + 1, next));
    }
    if (keys.length > limit) items.push('... ' + (keys.length - limit) + ' more');
    var proto = Object.getPrototypeOf(value);
    var ctor = proto && hasOwn.call(proto, 'constructor') && typeof proto.constructor === 'function' ? proto.constructor.name : '';
    return (ctor && ctor !== 'Object' ? ctor + ' ' : '') + formatList(items, '{', '}');
  }

  function format(value) {
    // A getter or a Proxy in learner data may throw. A message must still come out.
    try {
      return clip(formatInner(value, 0, []), MAX_MESSAGE_LENGTH / 4);
    } catch (ignored) {
      return '[Unformattable value]';
    }
  }

  // ---- Deep equality -----------------------------------------------------------------

  function equalsInner(a, b, stackA, stackB) {
    if (Object.is(a, b)) return true;
    if (a === null || b === null || typeof a !== 'object' || typeof b !== 'object') return false;
    var tag = tagOf(a);
    if (tag !== tagOf(b)) return false;
    if (tag === 'Date') return Object.is(a.getTime(), b.getTime());
    if (tag === 'RegExp') return a.source === b.source && a.flags === b.flags;
    if (a instanceof Error && b instanceof Error) return a.name === b.name && a.message === b.message;
    if (Object.getPrototypeOf(a) !== Object.getPrototypeOf(b)) return false;

    // Cycles: a pair already under comparison is assumed equal; a real difference
    // elsewhere still fails the whole comparison.
    for (var s = 0; s < stackA.length; s++) {
      if (stackA[s] === a) return stackB[s] === b;
    }
    stackA.push(a);
    stackB.push(b);
    var result = equalsByKind(a, b, tag, stackA, stackB);
    stackA.pop();
    stackB.pop();
    return result;
  }

  function equalsByKind(a, b, tag, stackA, stackB) {
    var i;
    if (Array.isArray(a) || ArrayBuffer.isView(a)) {
      if (a.length !== b.length) return false;
      for (i = 0; i < a.length; i++) {
        if (!equalsInner(a[i], b[i], stackA, stackB)) return false;
      }
      return true;
    }
    if (tag === 'Set' || tag === 'Map') {
      if (a.size !== b.size) return false;
      var entriesB = Array.from(b.entries());
      var ok = true;
      a.forEach(function (valueA, keyA) {
        if (!ok) return;
        // Order does not matter, and keys may be objects, so search for a partner.
        var at = -1;
        for (var j = 0; j < entriesB.length; j++) {
          if (equalsInner(keyA, entriesB[j][0], stackA, stackB) && equalsInner(valueA, entriesB[j][1], stackA, stackB)) {
            at = j;
            break;
          }
        }
        if (at === -1) ok = false;
        else entriesB.splice(at, 1);
      });
      return ok;
    }
    // Like Jest's toEqual, a key holding undefined equals a missing key.
    var defined = function (object) {
      return Object.keys(object).filter(function (key) {
        return object[key] !== undefined;
      });
    };
    var keysA = defined(a);
    var keysB = defined(b);
    if (keysA.length !== keysB.length) return false;
    for (i = 0; i < keysA.length; i++) {
      if (!hasOwn.call(b, keysA[i])) return false;
      if (!equalsInner(a[keysA[i]], b[keysA[i]], stackA, stackB)) return false;
    }
    return true;
  }

  function equals(a, b) {
    return equalsInner(a, b, [], []);
  }

  // ---- expect ------------------------------------------------------------------------

  function fail(message) {
    var error = new Error(clip(message, MAX_MESSAGE_LENGTH));
    error.name = 'AssertionError';
    error.__assertion = true;
    throw error;
  }

  function describeThrown(thrown) {
    return thrown instanceof Error ? (thrown.name || 'Error') + ': ' + thrown.message : format(thrown);
  }

  function lengthOf(value) {
    return value !== null && value !== undefined && typeof value.length === 'number' ? value.length : undefined;
  }

  function contains(container, item) {
    if (typeof container === 'string') return container.indexOf(String(item)) !== -1;
    if (container === null || container === undefined) return false;
    if (typeof container.has === 'function' && tagOf(container) === 'Set') return container.has(item);
    if (typeof container[Symbol.iterator] !== 'function') return false;
    return Array.from(container).some(function (entry) {
      return Object.is(entry, item) || entry === item;
    });
  }

  function matchers(actual, negated) {
    // Every matcher states both outcomes, so ".not" reads as well as the plain form.
    function check(pass, message, negatedMessage) {
      if (negated ? pass : !pass) fail(negated ? negatedMessage : message);
    }
    function needNumber(name, expected) {
      var numeric = function (v) {
        return typeof v === 'number' || typeof v === 'bigint';
      };
      if (!numeric(actual) || !numeric(expected)) {
        fail(name + ' compares numbers, received ' + format(actual) + ' and ' + format(expected));
      }
    }

    return {
      toBe: function (expected) {
        var hint = !Object.is(actual, expected) && equals(actual, expected) ? ' (equal content, but not the same object: use toEqual)' : '';
        check(Object.is(actual, expected), 'Expected ' + format(expected) + ', received ' + format(actual) + hint, 'Expected anything but ' + format(expected));
      },
      toEqual: function (expected) {
        check(equals(actual, expected), 'Expected ' + format(expected) + ', received ' + format(actual), 'Expected a value not equal to ' + format(expected));
      },
      toBeTruthy: function () {
        check(Boolean(actual), 'Expected a truthy value, received ' + format(actual), 'Expected a falsy value, received ' + format(actual));
      },
      toBeFalsy: function () {
        check(!actual, 'Expected a falsy value, received ' + format(actual), 'Expected a truthy value, received ' + format(actual));
      },
      toBeNull: function () {
        check(actual === null, 'Expected null, received ' + format(actual), 'Expected anything but null');
      },
      toBeUndefined: function () {
        check(actual === undefined, 'Expected undefined, received ' + format(actual), 'Expected anything but undefined');
      },
      toBeDefined: function () {
        check(actual !== undefined, 'Expected a defined value, received undefined', 'Expected undefined, received ' + format(actual));
      },
      toBeInstanceOf: function (expected) {
        if (typeof expected !== 'function') fail('toBeInstanceOf needs a class, received ' + format(expected));
        var name = expected.name || 'the class';
        check(actual instanceof expected, 'Expected an instance of ' + name + ', received ' + format(actual), 'Expected a value that is not an instance of ' + name);
      },
      toContain: function (item) {
        check(contains(actual, item), 'Expected ' + format(actual) + ' to contain ' + format(item), 'Expected ' + format(actual) + ' not to contain ' + format(item));
      },
      toMatch: function (pattern) {
        if (typeof actual !== 'string') fail('toMatch needs a string, received ' + format(actual));
        var pass = tagOf(pattern) === 'RegExp' ? pattern.test(actual) : actual.indexOf(String(pattern)) !== -1;
        check(pass, 'Expected ' + format(actual) + ' to match ' + format(pattern), 'Expected ' + format(actual) + ' not to match ' + format(pattern));
      },
      toHaveLength: function (expected) {
        var length = lengthOf(actual);
        if (length === undefined) fail('toHaveLength needs a value with a length, received ' + format(actual));
        check(length === expected, 'Expected length ' + format(expected) + ', received length ' + length + ' for ' + format(actual), 'Expected a length other than ' + format(expected));
      },
      toBeCloseTo: function (expected, digits) {
        var precision = typeof digits === 'number' ? digits : 2;
        if (typeof actual !== 'number' || typeof expected !== 'number') {
          fail('toBeCloseTo compares numbers, received ' + format(actual) + ' and ' + format(expected));
        }
        // Infinity minus Infinity is NaN, so identical values pass before the subtraction.
        var pass = actual === expected || Math.abs(expected - actual) < Math.pow(10, -precision) / 2;
        check(pass, 'Expected ' + format(expected) + ' to ' + precision + ' decimal places, received ' + format(actual), 'Expected a value not close to ' + format(expected) + ', received ' + format(actual));
      },
      toBeGreaterThan: function (expected) {
        needNumber('toBeGreaterThan', expected);
        check(actual > expected, 'Expected a value greater than ' + format(expected) + ', received ' + format(actual), 'Expected a value not greater than ' + format(expected) + ', received ' + format(actual));
      },
      toBeGreaterThanOrEqual: function (expected) {
        needNumber('toBeGreaterThanOrEqual', expected);
        check(actual >= expected, 'Expected a value of at least ' + format(expected) + ', received ' + format(actual), 'Expected a value below ' + format(expected) + ', received ' + format(actual));
      },
      toBeLessThan: function (expected) {
        needNumber('toBeLessThan', expected);
        check(actual < expected, 'Expected a value less than ' + format(expected) + ', received ' + format(actual), 'Expected a value not less than ' + format(expected) + ', received ' + format(actual));
      },
      toBeLessThanOrEqual: function (expected) {
        needNumber('toBeLessThanOrEqual', expected);
        check(actual <= expected, 'Expected a value of at most ' + format(expected) + ', received ' + format(actual), 'Expected a value above ' + format(expected) + ', received ' + format(actual));
      },
      toThrow: function (expected) {
        if (typeof actual !== 'function') {
          fail('toThrow needs a function. Wrap the call: expect(() => run()).toThrow()');
        }
        var threw = false;
        var thrown;
        var returned;
        try {
          returned = actual();
        } catch (caught) {
          threw = true;
          thrown = caught;
        }
        if (expected === undefined) {
          check(threw, 'Expected the function to throw, but it returned ' + format(returned), 'Expected the function not to throw, but it threw ' + describeThrown(thrown));
          return;
        }
        var wanted;
        var matches;
        if (typeof expected === 'function') {
          wanted = 'a ' + (expected.name || 'matching error');
          matches = threw && thrown instanceof expected;
        } else {
          var text = thrown instanceof Error ? thrown.message : String(thrown);
          wanted = 'an error matching ' + format(expected);
          matches = threw && (tagOf(expected) === 'RegExp' ? expected.test(text) : text.indexOf(String(expected)) !== -1);
        }
        var got = threw ? 'it threw ' + describeThrown(thrown) : 'it returned ' + format(returned);
        check(matches, 'Expected the function to throw ' + wanted + ', but ' + got, 'Expected the function not to throw ' + wanted + ', but ' + got);
      }
    };
  }

  // A host matcher returns { pass, message, negatedMessage } and the harness decides.
  function hostMatcher(fn, actual, negated) {
    return function () {
      var args = [actual];
      for (var i = 0; i < arguments.length; i++) args.push(arguments[i]);
      var result = fn.apply(null, args);
      if (negated ? result.pass : !result.pass) fail(String(negated ? result.negatedMessage : result.message));
    };
  }

  function withHostMatchers(api, actual, negated) {
    Object.keys(hostMatchers).forEach(function (name) {
      if (typeof hostMatchers[name] === 'function' && !hasOwn.call(api, name)) {
        api[name] = hostMatcher(hostMatchers[name], actual, negated);
      }
    });
    return api;
  }

  function expect(actual) {
    var api = withHostMatchers(matchers(actual, false), actual, false);
    api.not = withHostMatchers(matchers(actual, true), actual, true);
    return api;
  }

  // ---- console capture ---------------------------------------------------------------

  var logs = [];
  var logBytes = 0;
  var logsTruncated = false;

  function emit(line) {
    logs.push(line);
    if (hostLog) {
      try {
        hostLog(line);
      } catch (ignored) {
        // A broken host sink must not fail the learner's test.
      }
    }
  }

  // console.log('%s items', n) substitutes, as browsers and Node do. React's warnings
  // arrive in this form.
  function substitute(args) {
    var list = Array.prototype.slice.call(args);
    if (typeof list[0] !== 'string' || list[0].indexOf('%') === -1) return list;
    var rest = list.slice(1);
    var text = list[0].replace(/%([sdifoOc%])/g, function (whole, kind) {
      if (kind === '%') return '%';
      if (rest.length === 0) return whole;
      var value = rest.shift();
      if (kind === 'c') return '';
      if (kind === 's') return typeof value === 'string' ? value : format(value);
      if (kind === 'd' || kind === 'i') return typeof value === 'number' ? String(Math.trunc(value)) : 'NaN';
      if (kind === 'f') return String(Number(value));
      return format(value);
    });
    return [text].concat(rest);
  }

  function record(prefix, rawArgs) {
    if (logsTruncated) return;
    var args = substitute(rawArgs);
    var parts = [];
    for (var i = 0; i < args.length; i++) parts.push(typeof args[i] === 'string' ? args[i] : format(args[i]));
    var lines = (prefix + parts.join(' ')).split('\n');
    for (var l = 0; l < lines.length; l++) {
      var line = clip(lines[l], MAX_LOG_LINE_LENGTH);
      if (logs.length >= MAX_LOG_LINES || logBytes + line.length + 1 > MAX_LOG_BYTES) {
        logsTruncated = true;
        emit(TRUNCATION_NOTICE);
        return;
      }
      logBytes += line.length + 1;
      emit(line);
    }
  }

  function logger(prefix) {
    return function () {
      record(prefix, arguments);
    };
  }

  var noop = function () {};
  var capturedConsole = {
    log: logger(''),
    info: logger(''),
    debug: logger(''),
    warn: logger('warn: '),
    error: logger('error: '),
    // Present so that pasted code does not crash; they record nothing.
    table: logger(''),
    dir: logger(''),
    trace: noop,
    group: noop,
    groupCollapsed: noop,
    groupEnd: noop,
    time: noop,
    timeEnd: noop,
    timeLog: noop,
    count: noop,
    countReset: noop,
    // Libraries probe the host console once at load and call these later: React's
    // development build does so with timeStamp for its performance tracks.
    timeStamp: noop,
    profile: noop,
    profileEnd: noop,
    assert: function (condition) {
      if (!condition) record('error: ', ['Assertion failed'].concat(Array.prototype.slice.call(arguments, 1)));
    }
  };

  // ---- Test registry -----------------------------------------------------------------

  var registered = [];
  var groups = [];
  var started = false;
  var loadError = null;

  function test(name, fn) {
    if (started) throw new Error('test() cannot be called inside a test');
    if (registered.length >= MAX_TESTS) return;
    registered.push({ name: clip(groups.concat([String(name)]).join(' > '), MAX_NAME_LENGTH), fn: fn });
  }

  function describe(name, fn) {
    groups.push(String(name));
    try {
      fn();
    } finally {
      groups.pop();
    }
  }

  function lineOf(error) {
    if (error === null || typeof error !== 'object') return undefined;
    var stack = typeof error.stack === 'string' ? error.stack : '';
    // V8 and SpiderMonkey name the sourceURL in a frame as "learner.js:LINE:COL".
    var match = /learner\.js:(\d+)/.exec(stack);
    if (match) return Number(match[1]);
    // JavaScriptCore ignores sourceURL for eval code: such frames read "name@" with no
    // URL, and the place is on the error itself. Trust "line" only when the innermost
    // frame is one of those. For a syntax error it is "eval@[native code]", and "line"
    // then points into whoever called eval, which would mislead.
    if (typeof error.line === 'number') {
      if (error.sourceURL === SOURCE_NAME || /@$/.test(stack.split('\n')[0])) return error.line;
    }
    if (typeof error.lineNumber === 'number' && error.fileName === SOURCE_NAME) return error.lineNumber;
    return undefined;
  }

  function describeLoadError(thrown, codeLineCount) {
    var isError = thrown instanceof Error || (thrown !== null && typeof thrown === 'object' && typeof thrown.message === 'string');
    var result = {
      name: clip(isError && thrown.name ? String(thrown.name) : 'Error', MAX_NAME_LENGTH),
      message: isError ? String(thrown.message) : 'Thrown: ' + format(thrown)
    };
    var line = lineOf(thrown);
    if (line !== undefined && line >= 1) {
      if (line <= codeLineCount) result.line = line;
      else result.message += ' (tests, line ' + (line - codeLineCount) + ')';
    }
    result.message = clip(result.message, MAX_MESSAGE_LENGTH);
    return result;
  }

  function load(code, tests, options) {
    code = String(code);
    // With separate scopes, code and tests are two modules that meet only through
    // imports and exports. Transpiled imports declare helper names such as "_react" in
    // both, and in one shared scope the second declaration would replace the first.
    var separate = options !== null && typeof options === 'object' && options.separateScopes === true;
    var open = separate ? '(function () {' : '';
    var between = separate ? '\n})();(function () {' : '\n;';
    var close = separate ? '\n})();' : '';
    // The directive shares line 1 with the code, and the tests start on a fresh line,
    // so a line in a stack trace is a line of the learner's code without arithmetic.
    var source = '"use strict";' + open + code + between + String(tests) + close + '\n//# sourceURL=' + SOURCE_NAME;
    try {
      (0, eval)(source);
    } catch (thrown) {
      loadError = describeLoadError(thrown, code.split('\n').length);
    }
  }

  function failureMessage(thrown) {
    if (thrown !== null && typeof thrown === 'object' && thrown.__assertion === true) return String(thrown.message);
    if (isErrorLike(thrown)) return clip((thrown.name || 'Error') + ': ' + thrown.message, MAX_MESSAGE_LENGTH);
    return clip('Thrown: ' + format(thrown), MAX_MESSAGE_LENGTH);
  }

  // An error made in another realm (a host hook) fails instanceof but is still an error.
  function isErrorLike(thrown) {
    if (thrown instanceof Error) return true;
    return thrown !== null && typeof thrown === 'object' && tagOf(thrown) === 'Error' && typeof thrown.message === 'string';
  }

  function runOne(entry) {
    return new Promise(function (resolve) {
      var pass = function () {
        resolve({ name: entry.name, passed: true });
      };
      var failWith = function (thrown) {
        resolve({ name: entry.name, passed: false, message: failureMessage(thrown) });
      };
      if (typeof entry.fn !== 'function') {
        failWith(new Error('test() needs a function as its second argument'));
        return;
      }
      try {
        var outcome = entry.fn();
        if (outcome !== null && outcome !== undefined && typeof outcome.then === 'function') outcome.then(pass, failWith);
        else pass();
      } catch (thrown) {
        failWith(thrown);
      }
    }).then(afterEach);
  }

  // The host tidies up after every test (a React run unmounts and empties the page). A
  // failure there fails the test that left the mess.
  function afterEach(result) {
    if (!hostAfterEach) return result;
    try {
      hostAfterEach();
    } catch (thrown) {
      if (result.passed) return { name: result.name, passed: false, message: failureMessage(thrown) };
    }
    return result;
  }

  function run() {
    started = true;
    var results = [];
    var chain = Promise.resolve();
    if (!loadError) {
      registered.forEach(function (entry) {
        chain = chain.then(function () {
          return runOne(entry).then(function (result) {
            results.push(result);
          });
        });
      });
    }
    return chain.then(function () {
      if (loadError) return { status: 'error', tests: [], logs: logs.slice(), error: loadError };
      if (results.length === 0) {
        return { status: 'error', tests: [], logs: logs.slice(), error: { name: 'NoTests', message: 'No tests were registered.' } };
      }
      var allPassed = results.every(function (result) {
        return result.passed;
      });
      return { status: allPassed ? 'passed' : 'failed', tests: results, logs: logs.slice() };
    });
  }

  // ---- Module shims ------------------------------------------------------------------
  // The transpiler rewrites "export" to assignments on "exports" and "import" to
  // "require". A relative import in the tests therefore yields the learner's exports.

  var moduleExports = {};

  function require(specifier) {
    var name = String(specifier);
    if (/^\.{1,2}\//.test(name)) return moduleExports;
    if (hasOwn.call(hostModules, name)) return hostModules[name];
    throw new Error('Imports are not available here: "' + specifier + '"');
  }

  g.test = test;
  g.it = test;
  g.describe = describe;
  g.expect = expect;
  g.console = capturedConsole;
  // A copy, so a test can read what the learner printed without changing the log.
  g.printed = function () {
    return logs.slice();
  };
  g.exports = moduleExports;
  g.module = { exports: moduleExports };
  g.require = require;
  g.__load = load;
  g.__run = run;
})(typeof globalThis !== 'undefined' ? globalThis : this);
`;

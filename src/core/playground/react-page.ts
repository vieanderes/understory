import type { Transpiler } from '@/core/ports/code-runner';
import { TranspileError } from '@/core/running/transpile-error';
import { ACTION_SOURCE } from './actions';
import { MODULE_GLOBAL, REACT_ROOT_ID, REACT_RUNTIME_GLOBAL } from './names';
import { LINE_PLACEHOLDER, NAVIGATION_GUARD, PROBE_SOURCE } from './probe';
import { PLAYGROUND_MESSAGE_SOURCE } from './protocol';

/*
 * A React playground: the learner edits a component file and the preview renders it
 * with a real React 19 in the frame.
 *
 * The parent transpiles the file (sucrase, the same transform as tsx challenges) and
 * puts three things in the page, all inline, because the frame may not fetch anything:
 * the React runtime (public/sandbox/react-playground.v1.js, fetched by the parent), the
 * learner's module wrapped in a function, and the script below, which mounts the default
 * export into `#root` and runs the checks.
 *
 * Every check looks at a fresh render. A check with actions mounts the component anew,
 * clicks and types as it says, lets React render after each step, and only then gathers
 * its facts. So a check never depends on what the learner clicked in the preview, or on
 * the order of the checks, and the gate's jsdom gets the same answer as the browser.
 */

export { MODULE_GLOBAL, REACT_ROOT_ID, REACT_RUNTIME_GLOBAL };

/** The learner's file, ready for the page, or why it could not be. */
export type ComponentModule =
  { readonly code: string } | { readonly error: string; readonly line?: number };

/** Transpiles a component file the way a tsx challenge is: types off, JSX to calls, modules to CommonJS. */
export function compileComponent(transpiler: Transpiler, source: string): ComponentModule {
  try {
    return { code: transpiler.strip(source, 'tsx') };
  } catch (caught) {
    if (caught instanceof TranspileError) {
      return caught.line === undefined
        ? { error: caught.message }
        : { error: caught.message, line: caught.line };
    }
    return { error: caught instanceof Error ? caught.message : String(caught) };
  }
}

/** The error a module that did not compile shows, with the learner's line when known. */
export function compileErrorText(module: ComponentModule): string | null {
  if (!('error' in module)) return null;
  return `SyntaxError: ${module.error}${module.line === undefined ? '' : ` (line ${module.line})`}`;
}

/**
 * The module script's opening, which shares the first line with the learner's code so
 * every line of the file keeps its number in the page.
 */
export const MODULE_PREFIX = `window.${MODULE_GLOBAL} = function (exports, require, module) {`;

/**
 * The script that mounts the component and reports to the parent. Without a nonce it
 * reports nothing: a preview nobody checks, such as the solution's.
 *
 * `checksJson` is already escaped for a script element. `LINE_PLACEHOLDER` becomes the
 * line of the page where the learner's file starts, and `lineCount` is its length, so a
 * stack frame inside the file names the learner's line.
 */
export function reactFrameScript(
  nonce: string | null,
  checksJson: string,
  lineCount: number,
  compileError: string | null,
): string {
  return String.raw`(function () {
  'use strict';
  var probe = ${PROBE_SOURCE};
  var act = ${ACTION_SOURCE};
  var checks = ${checksJson};
  var nonce = ${JSON.stringify(nonce)};
  var compileError = ${JSON.stringify(compileError).replace(/</g, '\\u003c')};
  var firstLine = parseInt(${LINE_PLACEHOLDER}, 10);
  var lineCount = ${String(lineCount)};
  var target = window.parent;
  var errors = [];
  var warnings = [];
  var facts = [];
  var finished = false;
  var timer = 0;
  var root = null;
  var App = null;
  var kit = null;

  function learnerLine(line) {
    return line >= firstLine && line < firstLine + lineCount ? line - firstLine + 1 : 0;
  }
  function lineInStack(stack) {
    var frames = String(stack || '').split('\n');
    for (var i = 0; i < frames.length; i += 1) {
      var match = /:(\d+):\d+\)?\s*$/.exec(frames[i]);
      var line = match ? learnerLine(parseInt(match[1], 10)) : 0;
      if (line > 0) return line;
    }
    return 0;
  }
  function note(list, text) {
    text = String(text).slice(0, 400);
    if (list.length < 5 && list.indexOf(text) === -1) list.push(text);
  }
  function noteError(error, line) {
    var name = error && error.name ? String(error.name) : 'Error';
    var message = error && error.message !== undefined ? String(error.message) : String(error);
    var at = line || lineInStack(error && error.stack);
    note(errors, name + ': ' + message + (at > 0 ? ' (line ' + at + ')' : ''));
    later();
  }

  // React's development build warns through the console, a missing key above all.
  function format(args) {
    var rest = Array.prototype.slice.call(args, 1);
    var text = String(args[0]).replace(/%[sdifoOc]/g, function (token) {
      if (rest.length === 0) return token;
      var value = rest.shift();
      return token === '%c' ? '' : String(value);
    });
    if (rest.length > 0) text += ' ' + rest.map(String).join(' ');
    return text.split(/\n\s+at /)[0].replace(/\s+/g, ' ').trim();
  }
  ['error', 'warn'].forEach(function (level) {
    var original = console[level];
    console[level] = function () {
      note(warnings, format(arguments));
      later();
      return original.apply(console, arguments);
    };
  });

  window.addEventListener('error', function (event) {
    noteError(event.error || { name: 'Error', message: event.message }, learnerLine(event.lineno));
  });
  ${NAVIGATION_GUARD}

  function requireModule(name) {
    if (name === 'react') return kit.React;
    if (name === 'react/jsx-runtime' || name === 'react/jsx-dev-runtime') return kit.jsxRuntime;
    if (name === 'react-dom') return kit.ReactDOM;
    if (name === 'react-dom/client') return kit.ReactDOMClient;
    throw new Error('Only React can be imported here, not "' + name + '".');
  }

  function load() {
    if (compileError !== null) {
      note(errors, compileError);
      return null;
    }
    kit = window.${REACT_RUNTIME_GLOBAL};
    if (!kit) {
      note(errors, 'Error: React did not load. Reload the page to try again.');
      return null;
    }
    var factory = window.${MODULE_GLOBAL};
    // A file that does not parse has already reported its error.
    if (typeof factory !== 'function') return null;
    var module = { exports: {} };
    try {
      factory(module.exports, requireModule, module);
    } catch (error) {
      noteError(error, 0);
      return null;
    }
    var exported = module.exports.default || module.exports.App;
    var renderable = typeof exported === 'function' ||
      (exported !== null && typeof exported === 'object' && exported.$$typeof !== undefined);
    if (!renderable) {
      note(errors, 'Error: Nothing to render. The file needs export default function App().');
      return null;
    }
    return exported;
  }

  function mount(container) {
    if (root !== null) {
      try {
        root.unmount();
      } catch (error) {
        noteError(error, 0);
      }
    }
    root = kit.ReactDOMClient.createRoot(container, {
      onUncaughtError: function (error, info) {
        noteError(error, lineInStack(error && error.stack) || lineInStack(info && info.componentStack));
      },
      onRecoverableError: function (error) {
        noteError(error, 0);
      }
    });
    try {
      kit.ReactDOM.flushSync(function () {
        root.render(kit.React.createElement(App));
      });
    } catch (error) {
      noteError(error, 0);
    }
  }

  // Long enough for React to commit a discrete update and run the effects it schedules.
  function settle() {
    return new Promise(function (resolve) {
      setTimeout(function () {
        setTimeout(resolve, 0);
      }, 0);
    });
  }

  function factsOf(check) {
    return probe(document, window, [check], errors).facts[0];
  }

  async function perform(check) {
    for (var a = 0; a < check.actions.length; a += 1) {
      var action = check.actions[a];
      // Typing goes one character at a time, with a render after each, as from a keyboard.
      var steps = action.click !== undefined
        ? [action]
        : action.type.split('').map(function (ch) { return { type: ch, into: action.into }; });
      for (var s = 0; s < steps.length; s += 1) {
        var missed = null;
        try {
          missed = act(document, window, steps[s]);
        } catch (error) {
          noteError(error, 0);
        }
        if (missed) return missed;
        await settle();
      }
    }
    return null;
  }

  async function run() {
    var container = document.getElementById(${JSON.stringify(REACT_ROOT_ID)});
    App = load();
    var i;
    if (App === null || container === null) {
      for (i = 0; i < checks.length; i += 1) facts[i] = factsOf(checks[i]);
      return;
    }
    var acting = checks.some(function (check) { return check.actions !== undefined; });
    // The learner sees only the last render; the ones the checks act on stay transparent.
    var veil = null;
    if (acting) {
      veil = document.createElement('style');
      veil.setAttribute('data-understory', '');
      veil.textContent = '#' + ${JSON.stringify(REACT_ROOT_ID)} + '{opacity:0!important}';
      document.head.appendChild(veil);
    }
    mount(container);
    await settle();
    for (i = 0; i < checks.length; i += 1) {
      if (checks[i].actions === undefined) facts[i] = factsOf(checks[i]);
    }
    for (i = 0; i < checks.length; i += 1) {
      if (checks[i].actions === undefined) continue;
      mount(container);
      await settle();
      var missed = await perform(checks[i]);
      var found = factsOf(checks[i]);
      if (missed) found.missed = missed;
      facts[i] = found;
    }
    if (veil !== null) {
      mount(container);
      await settle();
      veil.remove();
    }
  }

  function send() {
    timer = 0;
    if (nonce === null) return;
    var report;
    try {
      report = probe(document, window, [], errors);
    } catch (e) {
      return;
    }
    report.facts = facts;
    report.warnings = warnings.slice();
    target.postMessage({ source: ${JSON.stringify(PLAYGROUND_MESSAGE_SOURCE)}, nonce: nonce, report: report }, '*');
  }
  function later() {
    if (!finished) return;
    if (timer) clearTimeout(timer);
    timer = setTimeout(send, 120);
  }

  window.addEventListener('load', function () {
    run().then(function () {
      finished = true;
      send();
      new MutationObserver(later).observe(document.documentElement, {
        subtree: true,
        childList: true,
        attributes: true,
        characterData: true
      });
    });
  });
})();`;
}

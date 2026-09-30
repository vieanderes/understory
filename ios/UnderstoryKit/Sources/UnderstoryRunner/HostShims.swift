import Foundation
import JavaScriptCore

/// What a Web Worker gives a script and a bare `JSContext` does not, as far as the lessons
/// and the React runtime need it. The Node gate hands its `vm` context the same list
/// (src/adapters/node-runner/worker-source.ts): `setTimeout`, `clearTimeout`,
/// `setInterval`, `clearInterval` and `queueMicrotask`. `structuredClone` is the one it has
/// and this does not; no lesson uses it.
///
/// Timers are real: the runner's event loop sleeps until the next one is due and calls it
/// as a fresh outermost call, so promise jobs drain between callbacks as in a browser.
/// React's scheduler finds no `MessageChannel` or `setImmediate` here and falls back to
/// `setTimeout`, which is a branch it ships for exactly this case.
///
/// Not mirrored: the browser worker and the Node gate end a run on an unhandled rejection
/// outside any test. JavaScriptCore reports those only through a private hook
/// (`JSGlobalContextSetUnhandledRejectionCallback`), so here such a run goes on to its
/// report. A rejection inside a test fails that test on every runtime.
///
/// Used on one thread only: the run's.
final class HostShims {
  struct Timer {
    var id: Int
    var due: UInt64
    var order: Int
  }

  private var timers: [Timer] = []
  private var order = 0
  private var fireFunction: JSValue?

  private static let source = """
    (function (g, schedule, cancel) {
      'use strict';
      var timers = new Map();
      var nextId = 1;
      function add(fn, delay, args, repeat) {
        var id = nextId++;
        var ms = Math.max(0, Number(delay) || 0);
        timers.set(id, { fn: fn, args: args, repeat: repeat, ms: ms });
        schedule(id, ms);
        return id;
      }
      function clear(id) {
        id = Number(id);
        if (timers.delete(id)) cancel(id);
      }
      function define(name, value) {
        Object.defineProperty(g, name, { value: value, writable: true, configurable: true, enumerable: false });
      }
      define('setTimeout', function setTimeout(fn, delay) {
        return add(fn, delay, Array.prototype.slice.call(arguments, 2), false);
      });
      define('setInterval', function setInterval(fn, delay) {
        return add(fn, delay, Array.prototype.slice.call(arguments, 2), true);
      });
      define('clearTimeout', function clearTimeout(id) { clear(id); });
      define('clearInterval', function clearInterval(id) { clear(id); });
      define('queueMicrotask', function queueMicrotask(fn) {
        if (typeof fn !== 'function') throw new TypeError('queueMicrotask needs a function');
        Promise.resolve().then(function () { fn(); });
      });
      return function fire(id) {
        var timer = timers.get(id);
        if (!timer) return;
        if (timer.repeat) schedule(id, timer.ms);
        else timers.delete(id);
        if (typeof timer.fn === 'function') timer.fn.apply(undefined, timer.args);
        else (0, eval)(String(timer.fn));
      };
    })
    """

  init(context: JSContext) {
    let schedule: @convention(block) (Int, Double) -> Void = { [unowned self] id, ms in
      let delay = UInt64(max(0, ms.isFinite ? ms : 0) * 1_000_000)
      order += 1
      timers.append(Timer(id: id, due: DispatchTime.now().uptimeNanoseconds + delay, order: order))
    }
    let cancel: @convention(block) (Int) -> Void = { [unowned self] id in
      timers.removeAll { $0.id == id }
    }
    // Handed in as arguments, never as globals, so learner code cannot reach them.
    let install = context.evaluateScript(Self.source, withSourceURL: URL(string: "host-shims.js"))
    fireFunction = install?.call(withArguments: [
      context.globalObject as Any, JSValue(object: schedule, in: context) as Any,
      JSValue(object: cancel, in: context) as Any,
    ])
  }

  /// The timer due first, ties in the order they were set, as browsers run them.
  func nextTimer() -> Timer? {
    timers.min { ($0.due, $0.order) < ($1.due, $1.order) }
  }

  func fire(_ timer: Timer) {
    timers.removeAll { $0.id == timer.id && $0.order == timer.order }
    fireFunction?.call(withArguments: [timer.id])
  }
}

import Foundation
import JavaScriptCore
import UnderstoryKit

/// Runs a learner's code and a lesson's tests on JavaScriptCore with the same harness the
/// browser loads (`public/sandbox/harness.v1.js`, kept in step by `Scripts/sync-resources.sh`).
/// The harness is DOM-free on purpose, so the verdict here is the verdict on the web
/// (docs/SANDBOX.md).
///
/// `js`, `ts` and `tsx`. A tsx run evaluates the web's React runtime
/// (`react-runtime.v1.js`) before the harness and loads code and tests in separate scopes,
/// in the order the browser worker and the Node gate use. `python` is `PythonRunner`'s.
///
/// JavaScriptCore is an engine, not a browser, so the runner adds what a Web Worker has and
/// the lessons use (`HostShims`): timers on an event loop this runner drives, and
/// `queueMicrotask`. docs/SANDBOX.md, "React challenges", lists them.
///
/// Threading: every run gets a fresh `JSVirtualMachine` on its own `Thread`, so learner
/// code never runs on a cooperative-pool thread and never shares a heap with another run.
/// What the host cannot do is interrupt a loop that never ends. See `ExecutionTimeLimit`
/// and docs/ios/PLAN.md, decision D9, for what that costs.
public struct JavaScriptRunner: CodeRunner {
  public enum LoadError: Error, CustomStringConvertible {
    case harnessMissing
    case reactRuntimeMissing

    public var description: String {
      switch self {
      case .harnessMissing:
        "harness.v1.js is not in the bundle. Run ios/UnderstoryKit/Scripts/sync-resources.sh."
      case .reactRuntimeMissing:
        "react-runtime.v1.js is not in the bundle. Run ios/UnderstoryKit/Scripts/sync-resources.sh."
      }
    }
  }

  public let harnessSource: String
  public let harnessVersion = 1
  private let transpiler: any Transpiler
  private let reactRuntime: @Sendable () throws -> String

  /// Loads the harness copied into the package's resources. With no transpiler given,
  /// TypeScript and tsx go through the bundled Sucrase, as on the web.
  public init(transpiler: (any Transpiler)? = nil) throws {
    guard let source = Self.resource("harness.v1", "js") else { throw LoadError.harnessMissing }
    self.harnessSource = source
    self.transpiler = try transpiler ?? SucraseTranspiler.shared()
    self.reactRuntime = Self.bundledReactRuntime
  }

  /// For tests that want to point at the web repo's copies directly.
  public init(
    harnessSource: String, transpiler: any Transpiler = PassthroughTranspiler(),
    reactRuntime: String? = nil
  ) {
    self.harnessSource = harnessSource
    self.transpiler = transpiler
    if let reactRuntime {
      self.reactRuntime = { reactRuntime }
    } else {
      self.reactRuntime = Self.bundledReactRuntime
    }
  }

  static func resource(_ name: String, _ ext: String) -> String? {
    guard let url = Bundle.module.url(forResource: name, withExtension: ext) else { return nil }
    return try? String(contentsOf: url, encoding: .utf8)
  }

  /// Read once, on the first tsx run: a megabyte that most runs never need.
  private static let cachedReactRuntime: String? = resource("react-runtime.v1", "js")

  private static let bundledReactRuntime: @Sendable () throws -> String = {
    guard let text = cachedReactRuntime else { throw LoadError.reactRuntimeMissing }
    return text
  }

  // MARK: - Running

  /// How a run ended, beyond what the shared `RunResult` shape can say. Used by the
  /// tests to tell the JavaScriptCore watchdog apart from the host-side deadline, which
  /// look the same to a learner and very different to this package.
  public struct Diagnostics: Sendable, Hashable {
    /// The JavaScriptCore watchdog terminated the run.
    public var stoppedByWatchdog = false
    /// The host gave up waiting. The thread may still be spinning.
    public var hostDeadlineFired = false
    /// Whether the watchdog was armed for this run at all.
    public var watchdogArmed = false
  }

  /// Resolves for every outcome, including a crash and a timeout. It never throws: a run
  /// that cannot start comes back as `.error`, exactly as `prepareRun` does on the web.
  public func run(_ request: RunRequest) async -> RunResult {
    await runWithDiagnostics(request).result
  }

  public func runWithDiagnostics(_ request: RunRequest) async
    -> (result: RunResult, diagnostics: Diagnostics)
  {
    let started = DispatchTime.now()
    func elapsedMs() -> Int {
      Int((DispatchTime.now().uptimeNanoseconds - started.uptimeNanoseconds) / 1_000_000)
    }
    func refuse(_ error: RunError) -> (RunResult, Diagnostics) {
      (RunResult(status: .error, error: error, durationMs: elapsedMs()), Diagnostics())
    }

    if let invalid = RunRequestCheck.validate(request, harnessVersion: harnessVersion) {
      return refuse(invalid)
    }
    if request.language == .python {
      return refuse(
        RunError(name: "RunnerError", message: "Python runs in PythonRunner, not JavaScriptCore."))
    }

    let prepared: (code: String, tests: String)
    do {
      prepared = (
        try strip(request.code, request.language, where: .code),
        try strip(request.tests, request.language, where: .tests)
      )
    } catch let error as SyntaxFailure {
      return refuse(error.runError)
    } catch {
      return refuse(RunError(name: "SyntaxError", message: "\(error)"))
    }

    var runtime: String?
    if request.language == .tsx {
      do {
        runtime = try reactRuntime()
      } catch {
        return refuse(RunError(name: "RunnerError", message: "No React runtime: \(error)"))
      }
    }

    let box = ResultBox()
    let timeoutMs = request.timeoutMs
    let sources = Sources(
      harness: harnessSource, runtime: runtime, code: prepared.code, tests: prepared.tests)

    let thread = Thread {
      Self.evaluate(sources, timeoutMs: timeoutMs, box: box)
    }
    thread.name = "understory.run.\(request.runId)"
    // Learner code is arbitrary, so it gets room and no share of the app's stack.
    thread.stackSize = 4 << 20
    thread.start()

    // The host-side deadline. A run that overruns is reported as a timeout even when the
    // thread it left behind is still spinning (ExecutionTimeLimit explains why).
    let deadline = UInt64(timeoutMs + Limits.watchdogGraceMs) * 1_000_000
    let watchdog = Task {
      try? await Task.sleep(nanoseconds: deadline)
      box.timeOut(afterMs: timeoutMs)
    }
    defer { watchdog.cancel() }

    var result = await box.wait()
    result.durationMs = elapsedMs()
    return (result, box.diagnostics)
  }

  private enum Place { case code, tests }

  private struct SyntaxFailure: Error {
    var runError: RunError
  }

  /// The mapping of `syntaxError` in src/core/running/prepare.ts: `line` always means a
  /// line of the learner's code, so a line in the tests goes into the text.
  private func strip(_ source: String, _ language: RunnerLanguage, where place: Place) throws
    -> String
  {
    do {
      return try transpiler.strip(source, language: language)
    } catch let error as TranspileError {
      switch place {
      case .code:
        throw SyntaxFailure(
          runError: RunError(name: "SyntaxError", message: error.message, line: error.line))
      case .tests:
        let at = error.line.map { " (tests, line \($0))" } ?? ""
        throw SyntaxFailure(runError: RunError(name: "SyntaxError", message: error.message + at))
      }
    }
  }

  // MARK: - The JavaScriptCore side

  private struct Sources: Sendable {
    var harness: String
    var runtime: String?
    var code: String
    var tests: String
  }

  /// Builds a context, loads the shims, the runtime and the harness, loads the learner's
  /// sources, runs the tests and drives the timers until a report arrives. Runs entirely
  /// on the caller's thread.
  private static func evaluate(_ sources: Sources, timeoutMs: Int, box: ResultBox) {
    let logs = box
    let started = DispatchTime.now().uptimeNanoseconds
    let budgetNs = UInt64(timeoutMs) * 1_000_000
    func finish(_ result: RunResult, stoppedByWatchdog: Bool = false) {
      box.finish(result, stoppedByWatchdog: stoppedByWatchdog)
    }
    let machine = JSVirtualMachine()!
    let context = JSContext(virtualMachine: machine)!

    var thrown: RunError?
    context.exceptionHandler = { _, value in
      guard thrown == nil else { return }
      thrown = RunError(
        name: (value?.forProperty("name")?.toString()).flatMap { $0 == "undefined" ? nil : $0 }
          ?? "Error",
        message: value?.toString() ?? "The run failed with no message.")
    }

    // Streamed so that output survives a run that ends in a timeout, as the frame does on
    // the web. The harness deletes the hook before any learner code can see it.
    let hostLog: @convention(block) (String) -> Void = { line in logs.append(log: line) }
    context.setObject(hostLog, forKeyedSubscript: "__hostLog" as NSString)

    let limit = ExecutionTimeLimit(context: context, seconds: Double(timeoutMs) / 1_000)
    box.noteWatchdogArmed(limit.isArmed)
    defer { limit.clear() }

    func stoppedByWatchdog() -> Bool {
      guard limit.didFire || thrown?.name == "TerminatedExecutionError" else { return false }
      finish(timeoutResult(timeoutMs: timeoutMs, logs: logs.logs), stoppedByWatchdog: true)
      return true
    }

    let shims = HostShims(context: context)
    if let thrown {
      finish(RunResult(status: .error, logs: logs.logs, error: thrown))
      return
    }

    // The React runtime of a tsx run, as a global script before the harness: the order
    // and mode of the browser worker's indirect eval and the Node gate's vm.runInContext.
    if let runtime = sources.runtime {
      context.evaluateScript(runtime, withSourceURL: URL(string: "react-runtime.v1.js"))
      if stoppedByWatchdog() { return }
      if let failure = thrown {
        finish(
          RunResult(
            status: .error, logs: logs.logs,
            error: RunError(name: "RunnerError", message: "No React runtime: \(failure.message)")))
        return
      }
    }

    context.evaluateScript(sources.harness, withSourceURL: URL(string: "harness.v1.js"))
    if let thrown {
      finish(RunResult(status: .error, logs: logs.logs, error: thrown))
      return
    }
    guard context.objectForKeyedSubscript("__run")?.isUndefined == false else {
      finish(
        RunResult(
          status: .error, logs: logs.logs,
          error: RunError(name: "HarnessMissing", message: "harness.v1.js did not define __run.")))
      return
    }

    // `__load` and `__run` are driven from one script, because JavaScriptCore drains the
    // promise job queue when the outermost JS frame returns: doing it in two native calls
    // would leave the chain half-run.
    context.setObject(sources.code, forKeyedSubscript: "__code" as NSString)
    context.setObject(sources.tests, forKeyedSubscript: "__tests" as NSString)
    context.setObject(sources.runtime != nil, forKeyedSubscript: "__separate" as NSString)
    let driver = """
      (function () {
        var code = __code, tests = __tests, separate = __separate === true;
        var load = __load, run = __run, done = __hostDone;
        ['__code', '__tests', '__separate', '__load', '__run', '__hostDone'].forEach(function (name) {
          delete globalThis[name];
        });
        load(code, tests, { separateScopes: separate });
        run().then(
          function (report) { done(JSON.stringify(report)); },
          function (thrown) {
            done(JSON.stringify({
              status: 'error', tests: [], logs: [],
              error: { name: 'HarnessError', message: String(thrown && thrown.message || thrown) }
            }));
          }
        );
      })();
      """

    let done = Mailbox()
    let hostDone: @convention(block) (String) -> Void = { json in done.deliver(json) }
    context.setObject(hostDone, forKeyedSubscript: "__hostDone" as NSString)
    context.evaluateScript(driver, withSourceURL: URL(string: "driver.js"))

    // The event loop. Every timer callback is a new outermost call, so JavaScriptCore
    // drains the promise jobs it queued before control comes back here.
    while true {
      if stoppedByWatchdog() { return }
      if let json = done.value {
        finish(report(fromJSON: json, logs: logs.logs))
        return
      }
      if let failure = thrown {
        // An error nothing caught, outside any test: the worker's `error` event on the
        // web, the thread's in the Node gate. Both end the run with it.
        finish(RunResult(status: .error, logs: logs.logs, error: failure))
        return
      }
      let elapsed = DispatchTime.now().uptimeNanoseconds - started
      guard elapsed < budgetNs, let timer = shims.nextTimer() else {
        // Out of time, or waiting on a promise nothing will ever settle. The browser and
        // the Node gate both call that a timeout; here it is known at once.
        finish(timeoutResult(timeoutMs: timeoutMs, logs: logs.logs))
        return
      }
      let now = DispatchTime.now().uptimeNanoseconds
      if timer.due > now {
        let wait = min(timer.due - now, budgetNs - elapsed)
        Thread.sleep(forTimeInterval: Double(wait) / 1_000_000_000)
        continue
      }
      // The watchdog's clock restarts on every entry into the VM, so each callback gets
      // only what is left of the run's budget.
      limit.rearm(seconds: Double(budgetNs - elapsed) / 1_000_000_000)
      shims.fire(timer)
    }
  }

  static func timeoutResult(timeoutMs: Int, logs: [String]) -> RunResult {
    RunResult(
      status: .timeout, logs: logs,
      error: RunError(
        name: "Timeout",
        message: "The run did not finish within \(timeoutMs) ms. Look for a loop that never ends.")
    )
  }

  /// Turns the harness report into a `RunResult`, applying the same caps the web protocol
  /// applies before it trusts a frame (src/core/running/protocol.ts).
  static func report(fromJSON json: String, logs streamed: [String]) -> RunResult {
    struct HarnessReport: Decodable {
      var status: String
      var tests: [TestResult]
      var logs: [String]
      var error: RunError?
    }
    guard let data = json.data(using: .utf8),
      let report = try? JSONDecoder().decode(HarnessReport.self, from: data),
      let status = RunStatus(rawValue: report.status), status != .timeout
    else {
      return RunResult(
        status: .error, logs: streamed,
        error: RunError(
          name: "BadReport", message: "The harness returned a report this build cannot read."))
    }
    return RunResult(
      status: status,
      tests: Array(report.tests.prefix(Limits.maxTests)).map {
        TestResult(
          name: String($0.name.prefix(Limits.maxTestNameLength)), passed: $0.passed,
          message: $0.message.map { String($0.prefix(Limits.maxMessageLength)) })
      },
      logs: Array(report.logs.prefix(Limits.maxLogLines + 1)),
      error: report.error.map {
        RunError(
          name: String($0.name.prefix(Limits.maxTestNameLength)),
          message: String($0.message.prefix(Limits.maxMessageLength)), line: $0.line)
      })
  }
}

extension Limits {
  /// Grace the host gives the run beyond `timeoutMs` before it gives up on it, matching
  /// `LIMITS.watchdogGraceMs` on the web.
  public static let watchdogGraceMs = 1_500
}

/// The request checks of `prepareRun` (src/core/running/prepare.ts), shared by both runners.
enum RunRequestCheck {
  static func validate(_ request: RunRequest, harnessVersion: Int) -> RunError? {
    func invalid(_ what: String) -> RunError {
      RunError(name: "InvalidRequest", message: "Invalid run request (\(what))")
    }
    if request.runId.isEmpty || request.runId.count > Limits.maxRunIdLength {
      return invalid("runId")
    }
    if request.code.utf8.count > Limits.maxSourceBytes { return invalid("code: too long") }
    if request.tests.utf8.count > Limits.maxSourceBytes { return invalid("tests: too long") }
    if request.timeoutMs < Limits.minTimeoutMs || request.timeoutMs > Limits.maxTimeoutMs {
      return invalid("timeoutMs")
    }
    if request.harnessVersion != harnessVersion { return invalid("harnessVersion") }
    if let packages = request.packages,
      packages.count > PythonPackages.supported.count
        || !packages.allSatisfy(PythonPackages.isSupported)
    {
      return invalid("packages")
    }
    return nil
  }
}

// MARK: - Plumbing

/// Collects streamed log lines and the single final result, across the run thread, the
/// watchdog and the awaiting task.
private final class ResultBox: @unchecked Sendable {
  private let lock = NSLock()
  private var lines: [String] = []
  private var result: RunResult?
  private var waiters: [CheckedContinuation<RunResult, Never>] = []
  private var notes = JavaScriptRunner.Diagnostics()

  var diagnostics: JavaScriptRunner.Diagnostics {
    lock.lock()
    defer { lock.unlock() }
    return notes
  }

  func noteWatchdogArmed(_ armed: Bool) {
    lock.lock()
    defer { lock.unlock() }
    notes.watchdogArmed = armed
  }

  var logs: [String] {
    lock.lock()
    defer { lock.unlock() }
    return lines
  }

  func append(log line: String) {
    lock.lock()
    defer { lock.unlock() }
    guard lines.count <= Limits.maxLogLines else { return }
    lines.append(String(line.prefix(Limits.maxLogLineLength)))
  }

  func finish(_ value: RunResult, stoppedByWatchdog: Bool = false) {
    settle(value) { $0.stoppedByWatchdog = stoppedByWatchdog }
  }

  func timeOut(afterMs timeoutMs: Int) {
    settle(JavaScriptRunner.timeoutResult(timeoutMs: timeoutMs, logs: logs)) {
      $0.hostDeadlineFired = true
    }
  }

  private func settle(_ value: RunResult, _ note: (inout JavaScriptRunner.Diagnostics) -> Void) {
    lock.lock()
    if result != nil {
      lock.unlock()
      return
    }
    note(&notes)
    result = value
    let pending = waiters
    waiters = []
    lock.unlock()
    for waiter in pending { waiter.resume(returning: value) }
  }

  func wait() async -> RunResult {
    await withCheckedContinuation { (continuation: CheckedContinuation<RunResult, Never>) in
      lock.lock()
      if let result {
        lock.unlock()
        continuation.resume(returning: result)
        return
      }
      waiters.append(continuation)
      lock.unlock()
    }
  }
}

/// One string, handed from a JavaScript callback back to the thread that called into it.
private final class Mailbox: @unchecked Sendable {
  private let lock = NSLock()
  private var stored: String?

  var value: String? {
    lock.lock()
    defer { lock.unlock() }
    return stored
  }

  func deliver(_ text: String) {
    lock.lock()
    defer { lock.unlock() }
    if stored == nil { stored = text }
  }
}

import Foundation
import Testing

@testable import UnderstoryRunner

/// The harness on JavaScriptCore. The same harness string the browser loads, so a verdict
/// here should be the verdict on the web (docs/SANDBOX.md).
extension RunnerSuite {
@Suite struct JavaScriptRunnerTests {
  static let repoRoot: URL = URL(fileURLWithPath: #filePath)
    .deletingLastPathComponent()  // UnderstoryRunnerTests
    .deletingLastPathComponent()  // Tests
    .deletingLastPathComponent()  // UnderstoryKit
    .deletingLastPathComponent()  // ios
    .deletingLastPathComponent()  // repo root

  static func runner() throws -> JavaScriptRunner { try JavaScriptRunner() }

  static func request(
    code: String, tests: String, language: RunnerLanguage = .js, timeoutMs: Int = 5_000
  ) -> RunRequest {
    RunRequest(
      runId: "test-\(UUID().uuidString.prefix(8))", language: language, code: code, tests: tests,
      timeoutMs: timeoutMs)
  }

  // MARK: The embedded harness

  @Test("the embedded harness is the one the web serves")
  func harnessIsInStep() throws {
    let embedded = try Self.runner().harnessSource
    let web = Self.repoRoot.appending(path: "public/sandbox/harness.v1.js")
    try #require(
      FileManager.default.fileExists(atPath: web.path),
      "public/sandbox/harness.v1.js is not in this checkout.")
    let served = try String(contentsOf: web, encoding: .utf8)
    #expect(
      embedded == served,
      "The embedded harness is stale. Run ios/UnderstoryKit/Scripts/sync-resources.sh")
  }

  @Test("the limits in the harness string are the limits in Swift")
  func limitsAgree() throws {
    let harness = try Self.runner().harnessSource
    #expect(harness.contains("var MAX_LOG_LINES = \(Limits.maxLogLines);"))
    #expect(harness.contains("var MAX_LOG_BYTES = \(Limits.maxLogBytes);"))
    #expect(harness.contains("var MAX_LOG_LINE_LENGTH = \(Limits.maxLogLineLength);"))
    #expect(harness.contains("var MAX_TESTS = \(Limits.maxTests);"))
    #expect(harness.contains("var MAX_NAME_LENGTH = \(Limits.maxTestNameLength);"))
    #expect(harness.contains("var MAX_MESSAGE_LENGTH = \(Limits.maxMessageLength);"))
    #expect(harness.contains(Limits.logTruncationNotice))
  }

  // MARK: Verdicts

  @Test("a passing solution passes")
  func passes() async throws {
    let result = await (try Self.runner()).run(
      Self.request(
        code: "function total(a, b) { return a + b; }",
        tests: """
          test('adds two numbers', function () { expect(total(2, 3)).toBe(5); });
          test('adds zero', function () { expect(total(0, 0)).toBe(0); });
          """))
    #expect(result.status == .passed)
    #expect(result.tests.count == 2)
    #expect(result.tests.allSatisfy { $0.passed })
    #expect(result.tests.map(\.name) == ["adds two numbers", "adds zero"])
    #expect(result.error == nil)
    #expect(result.durationMs != nil)
  }

  @Test("a failing assertion comes back as failed, with the harness's message")
  func fails() async throws {
    let result = await (try Self.runner()).run(
      Self.request(
        code: "function total(a, b) { return a - b; }",
        tests: "test('adds', function () { expect(total(2, 3)).toBe(5); });"))
    #expect(result.status == .failed)
    #expect(result.tests.count == 1)
    #expect(result.tests[0].passed == false)
    let message = try #require(result.tests[0].message)
    #expect(message.contains("5"))
    #expect(message.contains("-1"))
  }

  @Test("a throw inside a test fails only that test")
  func throwsInTest() async throws {
    let result = await (try Self.runner()).run(
      Self.request(
        code: "function boom() { throw new TypeError('no'); }",
        tests: """
          test('one', function () { expect(1).toBe(1); });
          test('two', function () { boom(); });
          """))
    #expect(result.status == .failed)
    #expect(result.tests.count == 2)
    #expect(result.tests[0].passed)
    #expect(result.tests[1].passed == false)
    #expect(result.tests[1].message?.contains("TypeError: no") == true)
  }

  @Test("a syntax error in the learner's code is an error with a line number")
  func syntaxError() async throws {
    let result = await (try Self.runner()).run(
      Self.request(
        code: "function total(a, b) { return a + ; }",
        tests: "test('adds', function () { expect(total(1, 1)).toBe(2); });"))
    #expect(result.status == .error)
    #expect(result.tests.isEmpty)
    let error = try #require(result.error)
    #expect(error.name == "SyntaxError")
  }

  @Test("a run that registers no test is an error, not a pass")
  func noTests() async throws {
    let result = await (try Self.runner()).run(Self.request(code: "var x = 1;", tests: "var y = 2;"))
    #expect(result.status == .error)
    #expect(result.error?.name == "NoTests")
  }

  @Test("console output is captured and streamed")
  func logs() async throws {
    let result = await (try Self.runner()).run(
      Self.request(
        code: "console.log('from the code', { a: 1 });",
        tests: "test('t', function () { console.log('from the test'); expect(1).toBe(1); });"))
    #expect(result.status == .passed)
    #expect(result.logs.count == 2)
    #expect(result.logs[0].contains("from the code"))
    #expect(result.logs[0].contains("{a: 1}"))
    #expect(result.logs[1].contains("from the test"))
  }

  @Test("a flood of output is truncated rather than sent whole")
  func logFlood() async throws {
    let result = await (try Self.runner()).run(
      Self.request(
        code: "for (var i = 0; i < 1000; i++) console.log('line ' + i);",
        tests: "test('t', function () { expect(1).toBe(1); });"))
    #expect(result.status == .passed)
    #expect(result.logs.count <= Limits.maxLogLines + 1)
    #expect(result.logs.last == Limits.logTruncationNotice)
  }

  @Test("the learner's code and the tests share one scope, and imports resolve to it")
  func moduleShim() async throws {
    let result = await (try Self.runner()).run(
      Self.request(
        code: "function double(n) { return n * 2; }\nexports.double = double;",
        tests: """
          var mod = require('./solution');
          test('exports', function () { expect(mod.double(4)).toBe(8); });
          """))
    #expect(result.status == .passed)
  }

  @Test("a bare import is refused with a message a learner can act on")
  func importsRefused() async throws {
    let result = await (try Self.runner()).run(
      Self.request(code: "var fs = require('fs');", tests: "test('t', function () {});"))
    #expect(result.status == .error)
    #expect(result.error?.message.contains("Imports are not available here") == true)
  }

  @Test("no host globals leak into the sandbox")
  func noHostGlobals() async throws {
    let result = await (try Self.runner()).run(
      Self.request(
        code: "",
        tests: """
          test('no dom', function () { expect(typeof globalThis.document).toBe('undefined'); });
          test('no host log', function () { expect(typeof globalThis.__hostLog).toBe('undefined'); });
          test('no host done', function () { expect(typeof globalThis.__hostDone).toBe('undefined'); });
          test('no loader', function () { expect(typeof globalThis.__load).toBe('undefined'); });
          """))
    #expect(result.status == .passed, "leaked globals: \(result.tests.filter { !$0.passed })")
  }

  @Test("timers run in order, as a Web Worker's do")
  func timers() async throws {
    let result = await (try Self.runner()).run(
      Self.request(
        code: """
          function later(ms, value) {
            return new Promise(function (resolve) { setTimeout(resolve, ms, value); });
          }
          """,
        tests: """
          test('awaits a timer', function () {
            return later(20, 'done').then(function (value) { expect(value).toBe('done'); });
          });
          test('orders timers by due time, then by the order they were set', function () {
            var seen = [];
            setTimeout(function () { seen.push('b'); }, 10);
            setTimeout(function () { seen.push('a'); }, 0);
            setTimeout(function () { seen.push('c'); }, 10);
            var cancelled = setTimeout(function () { seen.push('never'); }, 5);
            clearTimeout(cancelled);
            queueMicrotask(function () { seen.push('micro'); });
            return later(30).then(function () { expect(seen).toEqual(['micro', 'a', 'b', 'c']); });
          });
          test('an interval repeats until cleared', function () {
            var count = 0;
            var id = setInterval(function () { count += 1; if (count === 3) clearInterval(id); }, 1);
            return later(40).then(function () { expect(count).toBe(3); });
          });
          """))
    #expect(result.status == .passed, "\(result.tests.filter { !$0.passed })")
  }

  @Test("a test waiting on a promise nothing settles is a timeout, as on the web")
  func neverSettles() async throws {
    let result = await (try Self.runner()).run(
      Self.request(
        code: "", tests: "test('waits', function () { return new Promise(function () {}); });",
        timeoutMs: 500))
    #expect(result.status == .timeout)
  }

  @Test("a timer that outlives the budget is a timeout")
  func slowTimer() async throws {
    let result = await (try Self.runner()).run(
      Self.request(
        code: "",
        tests: """
          test('waits', function () {
            return new Promise(function (resolve) { setTimeout(resolve, 5000); });
          });
          """, timeoutMs: 300))
    #expect(result.status == .timeout)
    #expect((result.durationMs ?? 0) < 3_000)
  }

  @Test("a loop that never ends inside a timer callback is stopped", .timeLimit(.minutes(1)))
  func endlessLoopInTimer() async throws {
    try #require(ExecutionTimeLimit.isEnabled, "the JavaScriptCore watchdog is off")
    let (result, diagnostics) = await (try Self.runner()).runWithDiagnostics(
      Self.request(
        code: "",
        tests: """
          test('spins later', function () {
            return new Promise(function (resolve) {
              setTimeout(function () { while (true) {} }, 10);
            });
          });
          """, timeoutMs: 500))
    #expect(result.status == .timeout)
    #expect(diagnostics.stoppedByWatchdog)
  }

  @Test("an async test is awaited")
  func asyncTest() async throws {
    let result = await (try Self.runner()).run(
      Self.request(
        code: "function later(n) { return Promise.resolve(n * 2); }",
        tests: """
          test('resolves', function () {
            return later(3).then(function (n) { expect(n).toBe(6); });
          });
          """))
    #expect(result.status == .passed)
  }

  // MARK: Requests the runner refuses

  @Test("TypeScript is stripped by the bundled Sucrase and runs")
  func typescript() async throws {
    let result = await (try Self.runner()).run(
      Self.request(
        code: """
          interface Pair { a: number; b: number }
          export const total = ({ a, b }: Pair): number => a + b;
          """,
        tests: """
          import { total } from './solution';
          test('adds', () => { expect(total({ a: 1, b: 1 } as const)).toBe(2); });
          """, language: .ts))
    #expect(result.status == .passed, "\(result)")
  }

  @Test("a TypeScript syntax error names the learner's line, and a test file's in the text")
  func typescriptSyntaxError() async throws {
    let runner = try Self.runner()
    let inCode = await runner.run(
      Self.request(
        code: "const a: number = 1;\nconst b: = 2;",
        tests: "test('t', () => {});", language: .ts))
    #expect(inCode.status == .error)
    #expect(inCode.error?.name == "SyntaxError")
    #expect(inCode.error?.line == 2)

    let inTests = await runner.run(
      Self.request(code: "", tests: "\n\ntest('t', () => {", language: .ts))
    #expect(inTests.error?.name == "SyntaxError")
    #expect(inTests.error?.line == nil)
    #expect(inTests.error?.message.contains("(tests, line") == true)
  }

  @Test("the bundled Sucrase is the version the web installs")
  func sucraseVersion() throws {
    let package = Self.repoRoot.appending(path: "node_modules/sucrase/package.json")
    try #require(
      FileManager.default.fileExists(atPath: package.path), "run pnpm install at the repo root")
    struct Package: Decodable { var version: String }
    let installed = try JSONDecoder().decode(Package.self, from: Data(contentsOf: package))
    #expect(try SucraseTranspiler.shared().version == installed.version)
  }

  @Test("a runner without a transpiler refuses TypeScript rather than mis-run it")
  func passthroughRefusesTypescript() async throws {
    let runner = JavaScriptRunner(
      harnessSource: try Self.runner().harnessSource, transpiler: PassthroughTranspiler())
    let result = await runner.run(
      Self.request(
        code: "const total = (a: number, b: number): number => a + b;",
        tests: "test('t', function () { expect(total(1, 1)).toBe(2); });", language: .ts))
    #expect(result.status == .error)
    #expect(result.error?.name == "SyntaxError")
  }

  @Test("Python is not JavaScriptCore's to run")
  func pythonRefused() async throws {
    let result = await (try Self.runner()).run(
      Self.request(code: "x = 1", tests: "", language: .python))
    #expect(result.status == .error)
    #expect(result.error?.name == "RunnerError")
  }

  @Test("a request outside the limits is refused before anything runs")
  func invalidRequests() async throws {
    let runner = try Self.runner()
    let tooShort = await runner.run(
      Self.request(code: "", tests: "test('t', function () {});", timeoutMs: 1))
    #expect(tooShort.status == .error && tooShort.error?.name == "InvalidRequest")

    let noRunId = await runner.run(
      RunRequest(runId: "", language: .js, code: "", tests: "", timeoutMs: 1_000))
    #expect(noRunId.error?.name == "InvalidRequest")

    let tooBig = await runner.run(
      Self.request(
        code: String(repeating: "x", count: Limits.maxSourceBytes + 1), tests: ""))
    #expect(tooBig.error?.name == "InvalidRequest")

    let wrongHarness = await runner.run(
      RunRequest(
        runId: "r", language: .js, code: "", tests: "", timeoutMs: 1_000, harnessVersion: 2))
    #expect(wrongHarness.error?.name == "InvalidRequest")
  }

  // MARK: The time limit

  /// What JavaScriptCore gives a host, checked rather than assumed. Reported in
  /// docs/ios/PLAN.md decision D8 and docs/ios/CONTRACT.md.
  @Test("the execution time limit is private API, and this build records what it found")
  func timeLimitAvailability() {
    // The symbols are exported by the JavaScriptCore binary on macOS and iOS but declared
    // in no public header of either SDK (Xcode 26.2). If this ever stops resolving, the
    // runner falls back to a host-side deadline and cannot stop a loop at all.
    #expect(
      ExecutionTimeLimit.isSupported,
      """
      JSContextGroupSetExecutionTimeLimit did not resolve through dlsym. A loop that never \
      ends can then only be reported, not stopped. See docs/ios/PLAN.md D8.
      """)
  }

  @Test("a loop that never ends is stopped and reported as a timeout", .timeLimit(.minutes(1)))
  func endlessLoop() async throws {
    try #require(
      ExecutionTimeLimit.isEnabled,
      """
      The JavaScriptCore watchdog is off, so this test would leave a thread spinning for \
      the rest of the process. Unset UNDERSTORY_JSC_TIME_LIMIT to run it.
      """)
    let (result, diagnostics) = await (try Self.runner()).runWithDiagnostics(
      Self.request(
        code: "while (true) {}", tests: "test('t', function () { expect(1).toBe(1); });",
        timeoutMs: 500))

    #expect(result.status == .timeout)
    #expect(result.error?.name == "Timeout")
    #expect(result.error?.message.contains("500 ms") == true)
    // The two ways a run can time out look the same to a learner and are very different
    // here: the watchdog stopped the loop, the host deadline would only have stopped
    // waiting for it. Asserted on the cause rather than on the clock, because the whole
    // suite runs in parallel and a wall-clock bound is flaky under load.
    #expect(diagnostics.watchdogArmed)
    #expect(
      diagnostics.stoppedByWatchdog,
      "the host deadline fired, so the loop was abandoned and is still spinning")
    #expect(!diagnostics.hostDeadlineFired)
  }

  @Test("a loop inside one test stops the whole run", .timeLimit(.minutes(1)))
  func endlessLoopInsideATest() async throws {
    try #require(ExecutionTimeLimit.isEnabled, "the JavaScriptCore watchdog is off")
    let (result, diagnostics) = await (try Self.runner()).runWithDiagnostics(
      Self.request(
        code: "",
        tests: """
          test('spins', function () { while (true) {} });
          """, timeoutMs: 500))
    #expect(result.status == .timeout)
    #expect(diagnostics.stoppedByWatchdog)
  }

  @Test("output made before a timeout survives it", .timeLimit(.minutes(1)))
  func logsSurviveTimeout() async throws {
    try #require(ExecutionTimeLimit.isEnabled, "the JavaScriptCore watchdog is off")
    let (result, diagnostics) = await (try Self.runner()).runWithDiagnostics(
      Self.request(
        code: "console.log('before the spin');\nwhile (true) {}",
        tests: "test('t', function () {});", timeoutMs: 500))
    #expect(result.status == .timeout)
    #expect(diagnostics.stoppedByWatchdog)
    #expect(result.logs.contains { $0.contains("before the spin") })
  }

  @Test("each run gets its own heap, so one run cannot see another's globals")
  func runsAreIsolated() async throws {
    let runner = try Self.runner()
    let first = await runner.run(
      Self.request(
        code: "globalThis.leaked = 'yes';",
        tests: "test('t', function () { expect(globalThis.leaked).toBe('yes'); });"))
    #expect(first.status == .passed)

    let second = await runner.run(
      Self.request(
        code: "",
        tests: "test('t', function () { expect(typeof globalThis.leaked).toBe('undefined'); });"))
    #expect(second.status == .passed)
  }

  @Test("runs in parallel do not interfere")
  func parallelRuns() async throws {
    let runner = try Self.runner()
    let results = await withTaskGroup(of: RunResult.self) { group in
      for n in 1...6 {
        group.addTask {
          await runner.run(
            Self.request(
              code: "function n() { return \(n); }",
              tests: "test('t', function () { expect(n()).toBe(\(n)); });"))
        }
      }
      var all: [RunResult] = []
      for await result in group { all.append(result) }
      return all
    }
    #expect(results.count == 6)
    #expect(results.allSatisfy { $0.status == .passed })
  }
}
}  // extension RunnerSuite

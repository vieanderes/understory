import Foundation

/// The code-runner contract, field for field as src/core/ports/code-runner.ts declares it.
/// One request shape and one result shape serve the browser sandbox, the Node CI gate and
/// JavaScriptCore here, so a verdict means the same thing on every runtime.

public enum RunnerLanguage: String, Codable, Sendable, CaseIterable {
  case js, ts, tsx, python
}

public struct RunRequest: Codable, Hashable, Sendable {
  /// Chosen by the caller. Every message of the run echoes it.
  public var runId: String
  public var language: RunnerLanguage
  /// Learner code, as typed. Treated as hostile.
  public var code: String
  /// Test source in the same language. Shares one scope with the learner code, except in
  /// a tsx run, where the two are modules that meet through imports.
  public var tests: String
  /// Budget for the whole run: load, every test and all awaited work.
  public var timeoutMs: Int
  public var harnessVersion: Int
  /// Python only: packages to load before the run, beside those the code and tests
  /// import (`PythonPackages`). A lesson names them, so a learner who has not typed the
  /// import yet still gets them.
  public var packages: [String]?

  public init(
    runId: String, language: RunnerLanguage, code: String, tests: String, timeoutMs: Int,
    harnessVersion: Int = 1, packages: [String]? = nil
  ) {
    self.runId = runId
    self.language = language
    self.code = code
    self.tests = tests
    self.timeoutMs = timeoutMs
    self.harnessVersion = harnessVersion
    self.packages = packages
  }
}

public struct RunError: Codable, Hashable, Sendable {
  public var name: String
  public var message: String
  /// 1-based line in the learner's code, when the failure points at one.
  public var line: Int?

  public init(name: String, message: String, line: Int? = nil) {
    self.name = name
    self.message = message
    self.line = line
  }
}

public struct TestResult: Codable, Hashable, Sendable {
  public var name: String
  public var passed: Bool
  public var message: String?

  public init(name: String, passed: Bool, message: String? = nil) {
    self.name = name
    self.passed = passed
    self.message = message
  }
}

public enum RunStatus: String, Codable, Sendable {
  case passed, failed, timeout, error
}

public struct RunResult: Codable, Hashable, Sendable {
  public var status: RunStatus
  public var tests: [TestResult]
  public var logs: [String]
  public var error: RunError?
  /// Always set by the runners. Optional so that grading fixtures need not invent one.
  public var durationMs: Int?

  public init(
    status: RunStatus, tests: [TestResult] = [], logs: [String] = [], error: RunError? = nil,
    durationMs: Int? = nil
  ) {
    self.status = status
    self.tests = tests
    self.logs = logs
    self.error = error
    self.durationMs = durationMs
  }

  public var passed: Bool { status == .passed }
}

/// Every bound on a run, mirroring src/core/running/limits.ts. `Limits` is checked by a
/// test against the numbers baked into the harness string.
public enum Limits {
  public static let maxSourceBytes = 256 * 1024
  public static let minTimeoutMs = 100
  public static let maxTimeoutMs = 30_000
  public static let maxLogLines = 200
  public static let maxLogBytes = 64 * 1024
  public static let maxLogLineLength = 4_000
  public static let maxTests = 200
  public static let maxTestNameLength = 200
  public static let maxMessageLength = 2_000
  public static let maxRunIdLength = 64
  public static let logTruncationNotice = "[Output truncated: more than 200 lines or 64 KB]"
}

/// Strips TypeScript to plain JavaScript and rewrites `import`/`export` so the source runs
/// as a script. `SucraseTranspiler` runs the same Sucrase the web uses; see there.
public protocol Transpiler: Sendable {
  func strip(_ source: String, language: RunnerLanguage) throws -> String
}

public struct TranspileError: Error, Sendable {
  public var message: String
  public var line: Int?
  public init(message: String, line: Int? = nil) {
    self.message = message
    self.line = line
  }
}

/// Hands JavaScript through untouched and refuses everything else. For tests that must
/// not depend on the bundled Sucrase.
public struct PassthroughTranspiler: Transpiler {
  public init() {}

  public func strip(_ source: String, language: RunnerLanguage) throws -> String {
    guard language == .js else {
      throw TranspileError(message: "This runner has no transpiler for \(language.rawValue).")
    }
    return source
  }
}

/// Anything that turns a request into a verdict. `JavaScriptRunner`, `PythonRunner` and
/// `CodeRunnerByLanguage` all are.
public protocol CodeRunner: Sendable {
  func run(_ request: RunRequest) async -> RunResult
}

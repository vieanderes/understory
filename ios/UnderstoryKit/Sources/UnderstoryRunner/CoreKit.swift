import Foundation
import JavaScriptCore
import UnderstoryKit

/// The web's own page builder, check judge and SQL verdict, on JavaScriptCore.
///
/// `core-kit.v1.js` is src/core bundled by `Scripts/build-resources.ts`:
/// `buildPlaygroundDocument`, `parsePlaygroundMessage`, `evaluateChecks` with
/// `gradePlayground`, and `sqlVerdict` with `gradeSql`. Running those rather than a Swift
/// copy means the page the phone shows is byte for byte the browser's, and a check or a
/// query passes on the phone exactly when it passes on the web and in the content gate.
/// It is work the app controls on data it controls (docs/ios/PLAN.md, D9): learner code
/// never runs here, it only travels through as text.
///
/// JSON in, JSON out. Thread-safe: one lock around the one context.
public final class CoreKit: @unchecked Sendable {
  public enum Failure: Error, CustomStringConvertible, Equatable {
    case bundleMissing
    case bundleBroken(String)
    case call(String)

    public var description: String {
      switch self {
      case .bundleMissing:
        "core-kit.v1.js is not in the bundle. Run ios/UnderstoryKit/Scripts/sync-resources.sh."
      case .bundleBroken(let why): "core-kit.v1.js did not load: \(why)"
      case .call(let why): why
      }
    }
  }

  /// One per process: the bundle is about 200 KB to parse.
  public static func shared() throws -> CoreKit { try sharedResult.get() }
  private static let sharedResult = Result { try CoreKit() }

  private let lock = NSLock()
  private let context: JSContext
  private let api: JSValue
  private var thrown: String?

  public convenience init() throws {
    guard let source = JavaScriptRunner.resource("core-kit.v1", "js") else {
      throw Failure.bundleMissing
    }
    try self.init(source: source)
  }

  init(source: String) throws {
    context = JSContext()!
    var loadError: String?
    context.exceptionHandler = { _, value in loadError = value?.toString() }
    context.evaluateScript(source, withSourceURL: URL(string: "core-kit.v1.js"))
    guard loadError == nil, let api = context.objectForKeyedSubscript("__understoryCore"),
      api.isObject
    else { throw Failure.bundleBroken(loadError ?? "no __understoryCore") }
    self.api = api
    context.exceptionHandler = { [unowned self] _, value in
      self.thrown = value?.forProperty("message")?.toString() ?? value?.toString()
    }
  }

  private static let encoder = JSONEncoder()
  private static let decoder = JSONDecoder()

  private func call<Input: Encodable, Output: Decodable>(
    _ name: String, _ input: Input, as: Output.Type
  ) throws -> Output {
    let text = String(decoding: try Self.encoder.encode(input), as: UTF8.self)
    return try Self.decoder.decode(Output.self, from: Data(try call(name, json: text).utf8))
  }

  private func call(_ name: String, json text: String) throws -> String {
    lock.lock()
    defer { lock.unlock() }
    thrown = nil
    let value = api.forProperty(name)?.call(withArguments: [text])
    if let thrown { throw Failure.call(thrown) }
    guard let value, value.isString, let output = value.toString() else {
      throw Failure.call("\(name) returned nothing.")
    }
    return output
  }

  // MARK: Playground

  /// What the probe needs: the nonce the page reports under, and the checks.
  public struct Probe: Encodable, Sendable {
    public var nonce: String
    public var checks: [PlaygroundStep.Check]

    public init(nonce: String, checks: [PlaygroundStep.Check]) {
      self.nonce = nonce
      self.checks = checks
    }
  }

  /// For a page with `jsx`: the React runtime's text and the compiled component.
  public struct React: Encodable, Sendable {
    public var runtime: String
    public var component: ComponentModule

    public init(runtime: String, component: ComponentModule) {
      self.runtime = runtime
      self.component = component
    }
  }

  /// `buildPlaygroundDocument(files, { probe, react })`.
  public func page(_ files: PlaygroundFiles, probe: Probe? = nil, react: React? = nil) throws
    -> String
  {
    struct Options: Encodable {
      var probe: Probe?
      var react: React?
    }
    struct Input: Encodable {
      var files: PlaygroundFiles
      var options: Options
    }
    return try call(
      "page", Input(files: files, options: Options(probe: probe, react: react)), as: String.self)
  }

  /// The page's message, parsed with the web's schema: the report when the message is
  /// one and carries this nonce, nil for anything else. Never throws.
  public func report(fromMessage json: String, nonce: String) -> ProbeReport? {
    struct Message: Decodable {
      var nonce: String
      var report: ProbeReport
    }
    guard let output = try? call("message", json: json),
      let parsed = (try? Self.decoder.decode(Message?.self, from: Data(output.utf8))) ?? nil,
      parsed.nonce == nonce
    else { return nil }
    return parsed.report
  }

  /// `evaluateChecks` and `gradePlayground`: the checklist and the grade.
  public func judge(_ checks: [PlaygroundStep.Check], facts: [CheckFacts]) throws
    -> PlaygroundVerdict
  {
    struct Input: Encodable {
      var checks: [PlaygroundStep.Check]
      var facts: [CheckFacts]
    }
    return try call("checks", Input(checks: checks, facts: facts), as: PlaygroundVerdict.self)
  }

  // MARK: SQL

  /// `sqlVerdict` and `gradeSql`. The grade is nil for `unavailable`, which the web does
  /// not record either.
  public func judge(learner: SqlRunReport, expected: SqlRunReport, checks: SqlStep.Checks?)
    throws -> SqlJudgement
  {
    struct Checks: Encodable {
      var ordered: Bool?
      var query: String?
    }
    struct Input: Encodable {
      var learner: SqlRunReport
      var expected: SqlRunReport
      var checks: Checks
    }
    struct Output: Decodable {
      var verdict: SqlVerdict
      var grade: StepGrade
    }
    let output = try call(
      "sql",
      Input(
        learner: learner, expected: expected,
        checks: Checks(ordered: checks?.ordered, query: checks?.query)),
      as: Output.self)
    if case .unavailable = output.verdict { return SqlJudgement(verdict: output.verdict) }
    return SqlJudgement(verdict: output.verdict, grade: output.grade)
  }
}

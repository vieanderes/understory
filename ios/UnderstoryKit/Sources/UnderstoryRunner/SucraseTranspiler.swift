import Foundation
import JavaScriptCore

/// The web's transpiler on JavaScriptCore: the installed `sucrase` package, bundled into
/// `sucrase.v1.js` by `Scripts/build-resources.ts`, called with the options of
/// src/adapters/transpile/sucrase.ts. Same parser, same options, same output, so a line
/// number or a syntax error on the phone is the one the browser shows.
///
/// Why on device and not precompiled (docs/ios/PLAN.md, D8): starter code and tests could
/// be precompiled at content build, but what a learner types cannot. Sucrase is work the
/// app controls, on a trusted input shape, so it runs in a plain `JSContext` that lives as
/// long as the transpiler.
///
/// Thread-safe: one lock around the one context.
public final class SucraseTranspiler: Transpiler, @unchecked Sendable {
  public enum LoadError: Error, CustomStringConvertible {
    case bundleMissing
    case bundleBroken(String)

    public var description: String {
      switch self {
      case .bundleMissing:
        "sucrase.v1.js is not in the bundle. Run ios/UnderstoryKit/Scripts/sync-resources.sh."
      case .bundleBroken(let why): "sucrase.v1.js did not load: \(why)"
      }
    }
  }

  /// One per process: parsing the bundle costs tens of milliseconds, a transform far less.
  public static func shared() throws -> SucraseTranspiler {
    try sharedResult.get()
  }

  private static let sharedResult = Result { try SucraseTranspiler() }

  private let lock = NSLock()
  private let context: JSContext
  private let transform: JSValue
  private var thrown: JSValue?

  /// The version of the bundled sucrase, from the bundle itself.
  public let version: String

  public convenience init() throws {
    guard let url = Bundle.module.url(forResource: "sucrase.v1", withExtension: "js"),
      let source = try? String(contentsOf: url, encoding: .utf8)
    else { throw LoadError.bundleMissing }
    try self.init(source: source)
  }

  public init(source: String) throws {
    context = JSContext()!
    var loadError: String?
    context.exceptionHandler = { _, value in loadError = value?.toString() }
    context.evaluateScript(source, withSourceURL: URL(string: "sucrase.v1.js"))
    guard loadError == nil,
      let api = context.objectForKeyedSubscript("__sucrase"), api.isObject,
      let transform = api.forProperty("transform"), transform.isObject
    else { throw LoadError.bundleBroken(loadError ?? "no __sucrase.transform") }
    self.transform = transform
    self.version = api.forProperty("version")?.toString() ?? "unknown"
    context.exceptionHandler = { [unowned self] _, value in self.thrown = value }
  }

  public func strip(_ source: String, language: RunnerLanguage) throws -> String {
    let transforms: [String]
    switch language {
    case .js: transforms = ["imports"]
    case .ts: transforms = ["typescript", "imports"]
    case .tsx: transforms = ["typescript", "jsx", "imports"]
    case .python:
      throw TranspileError(message: "Python is not transpiled. It runs in PythonRunner.")
    }
    var options: [String: Any] = ["transforms": transforms, "disableESTransforms": true]
    if language == .tsx {
      options["jsxRuntime"] = "automatic"
      options["production"] = true
    }

    lock.lock()
    defer { lock.unlock() }
    thrown = nil
    let output = transform.call(withArguments: [source, options])
    if let thrown {
      self.thrown = nil
      throw Self.transpileError(from: thrown)
    }
    guard let code = output?.forProperty("code"), code.isString, let text = code.toString() else {
      throw TranspileError(message: "Sucrase returned no code.")
    }
    return text
  }

  private static func transpileError(from value: JSValue) -> TranspileError {
    let raw = value.forProperty("message").flatMap { $0.isUndefined ? nil : $0.toString() }
      ?? value.toString() ?? "The code could not be read."
    // Sucrase appends "(line:column)" to the text. The line travels as a field, as on the web.
    let message = raw.replacingOccurrences(
      of: #"\s*\(\d+:\d+\)$"#, with: "", options: .regularExpression)
    let line = value.forProperty("loc")?.forProperty("line")
    let lineNumber = (line?.isNumber ?? false) ? Int(line!.toInt32()) : nil
    return TranspileError(message: message, line: lineNumber)
  }
}

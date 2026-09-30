import Foundation
import UnderstoryKit

/// The shapes a playground page and its judge exchange, field for field as
/// src/core/playground/protocol.ts and checks.ts declare them. The page's facts come
/// back from the web view; `CoreKit` judges them with the web's own functions.

/// The four editable fields of a playground, as `PlaygroundSources` on the web.
public struct PlaygroundFiles: Codable, Hashable, Sendable {
  public var html: String?
  public var css: String?
  public var js: String?
  /// A React component file. The page then needs the React runtime and a transpile.
  public var jsx: String?

  public init(html: String? = nil, css: String? = nil, js: String? = nil, jsx: String? = nil) {
    self.html = html
    self.css = css
    self.js = js
    self.jsx = jsx
  }

  /// The step's starter files.
  public init(starterOf step: PlaygroundStep) {
    self.init(html: step.html, css: step.css, js: step.js, jsx: step.jsx)
  }

  /// The solution's files over the starter's, as `mergeSources` does on the web.
  public init?(solutionOf step: PlaygroundStep) {
    guard let solution = step.solution else { return nil }
    self.init(
      html: solution.html ?? step.html, css: solution.css ?? step.css,
      js: solution.js ?? step.js, jsx: solution.jsx ?? step.jsx)
  }
}

/// The learner's component, ready for the page, or why it could not be
/// (`ComponentModule` in src/core/playground/react-page.ts).
public enum ComponentModule: Codable, Hashable, Sendable {
  case code(String)
  case error(String, line: Int?)

  private enum Keys: String, CodingKey { case code, error, line }

  /// `compileComponent` on the web: the tsx transform of a tsx challenge.
  public static func compile(_ source: String, with transpiler: any Transpiler) -> ComponentModule {
    do {
      return .code(try transpiler.strip(source, language: .tsx))
    } catch let error as TranspileError {
      return .error(error.message, line: error.line)
    } catch {
      return .error("\(error)", line: nil)
    }
  }

  public init(from decoder: any Decoder) throws {
    let container = try decoder.container(keyedBy: Keys.self)
    if let code = try container.decodeIfPresent(String.self, forKey: .code) {
      self = .code(code)
    } else {
      self = .error(
        try container.decode(String.self, forKey: .error),
        line: try container.decodeIfPresent(Int.self, forKey: .line))
    }
  }

  public func encode(to encoder: any Encoder) throws {
    var container = encoder.container(keyedBy: Keys.self)
    switch self {
    case .code(let code): try container.encode(code, forKey: .code)
    case .error(let message, let line):
      try container.encode(message, forKey: .error)
      try container.encodeIfPresent(line, forKey: .line)
    }
  }
}

/// What the probe found for one check.
public struct CheckFacts: Codable, Hashable, Sendable {
  public struct Missed: Codable, Hashable, Sendable {
    public var action: String
    public var selector: String
    public var invalid: Bool?
    public var notField: Bool?
  }

  public var count: Int
  public var invalid: Bool?
  public var text: String?
  /// Absent when the check did not ask; `.some(nil)` when the element has no such
  /// attribute. The web tells the two apart, so this does too.
  public var attribute: String??
  public var style: String?
  public var missed: Missed?

  public init(count: Int, text: String? = nil, attribute: String?? = nil, style: String? = nil) {
    self.count = count
    self.text = text
    self.attribute = attribute
    self.style = style
  }

  private enum Keys: String, CodingKey { case count, invalid, text, attribute, style, missed }

  public init(from decoder: any Decoder) throws {
    let container = try decoder.container(keyedBy: Keys.self)
    count = try container.decode(Int.self, forKey: .count)
    invalid = try container.decodeIfPresent(Bool.self, forKey: .invalid)
    text = try container.decodeIfPresent(String.self, forKey: .text)
    if container.contains(.attribute) {
      attribute = .some(
        try container.decodeNil(forKey: .attribute)
          ? nil : try container.decode(String.self, forKey: .attribute))
    }
    style = try container.decodeIfPresent(String.self, forKey: .style)
    missed = try container.decodeIfPresent(Missed.self, forKey: .missed)
  }

  public func encode(to encoder: any Encoder) throws {
    var container = encoder.container(keyedBy: Keys.self)
    try container.encode(count, forKey: .count)
    try container.encodeIfPresent(invalid, forKey: .invalid)
    try container.encodeIfPresent(text, forKey: .text)
    if let attribute {
      if let value = attribute {
        try container.encode(value, forKey: .attribute)
      } else {
        try container.encodeNil(forKey: .attribute)
      }
    }
    try container.encodeIfPresent(style, forKey: .style)
    try container.encodeIfPresent(missed, forKey: .missed)
  }
}

/// One row of the element tree the playground shows beside the page.
public struct TreeRow: Codable, Hashable, Sendable {
  public struct Attribute: Codable, Hashable, Sendable {
    public var name: String
    public var value: String
  }

  public var depth: Int
  /// `element`, `text` or `comment`.
  public var kind: String
  public var tag: String?
  public var attrs: [Attribute]?
  public var text: String?
}

/// What the page reported: the facts for each check, the tree, script errors with the
/// learner's line, and React's warnings.
public struct ProbeReport: Codable, Hashable, Sendable {
  public var facts: [CheckFacts]
  public var tree: [TreeRow]
  public var truncated: Bool
  public var errors: [String]
  public var warnings: [String]?
}

/// One check's verdict. `reason` is plain text for under a failed item.
public struct CheckResult: Codable, Hashable, Sendable {
  public var passed: Bool
  public var reason: String?
}

/// A step's grade as src/core/grading/grade.ts shapes it, without `detail`.
public struct StepGrade: Codable, Hashable, Sendable {
  public struct Feedback: Codable, Hashable, Sendable {
    public var kind: String
    public var message: String
  }

  public var correct: Bool
  public var score: Double
  public var feedback: [Feedback]
}

/// The checklist and the grade for one report.
public struct PlaygroundVerdict: Codable, Hashable, Sendable {
  public var results: [CheckResult]
  public var grade: StepGrade
}

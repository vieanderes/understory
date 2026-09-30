import Foundation

// One struct per compiled step, mirroring src/core/content/compiled.ts field for field.
// Optional fields are omitted in the JSON and nil here; synthesized Codable writes them
// back with `encodeIfPresent`, so nothing is ever encoded as null.

/// A still figure drawn from a lab engine. A client without the drawing shows the caption.
public struct ProseFigure: Codable, Hashable, Sendable {
  public var id: String
  public var caption: String
}

public struct ProseStep: Codable, Hashable, Sendable {
  public var id: String
  public var body: Rich
  public var figure: ProseFigure?
}

public struct PredictOutputStep: Codable, Hashable, Sendable {
  public var id: String
  public var concept: String
  public var difficulty: Int
  public var code: String
  public var codeHtml: String
  public var language: Language
  public var question: Rich
  public var choices: [Choice]
}

public struct MultipleChoiceStep: Codable, Hashable, Sendable {
  public var id: String
  public var concept: String
  public var difficulty: Int
  public var question: Rich
  public var code: String?
  public var codeHtml: String?
  public var language: Language?
  public var choices: [Choice]
}

public struct TraceTableStep: Codable, Hashable, Sendable {
  public struct Row: Codable, Hashable, Sendable {
    /// 1-based line in `code`.
    public var line: Int
    public var values: [String]
    /// True when the row is shown filled in.
    public var given: Bool?
  }

  public var id: String
  public var concept: String
  public var difficulty: Int
  public var code: String
  public var codeHtml: String
  public var language: Language
  public var prompt: Rich
  public var columns: [String]
  public var rows: [Row]
}

public struct FillBlankStep: Codable, Hashable, Sendable {
  public struct Blank: Codable, Hashable, Sendable {
    /// The number inside `{{ }}` in `template`.
    public var key: String
    public var answer: String
    public var accept: [String]?
  }

  public var id: String
  public var concept: String
  public var difficulty: Int
  public var prompt: Rich
  public var template: String
  public var templateHtml: String
  public var language: Language
  public var blanks: [Blank]
  public var bank: [String]
}

public struct ParsonsStep: Codable, Hashable, Sendable {
  public struct Block: Codable, Hashable, Sendable, Identifiable {
    public var id: String
    public var code: String
    public var codeHtml: String
    public var indent: Int?
    public var subgoal: String?
  }

  public struct Distractor: Codable, Hashable, Sendable, Identifiable {
    public var id: String
    public var code: String
    public var codeHtml: String
    public var feedback: Rich
  }

  public var id: String
  public var concept: String
  public var difficulty: Int
  public var prompt: Rich
  public var language: Language
  /// Listed in the correct order. The player shuffles them with a seeded generator.
  public var blocks: [Block]
  public var distractors: [Distractor]?
  public var checkIndent: Bool?
}

public struct BugHuntStep: Codable, Hashable, Sendable {
  public var id: String
  public var concept: String
  public var difficulty: Int
  public var code: String
  public var codeHtml: String
  public var language: Language
  public var prompt: Rich
  /// The 1-based line or lines at fault.
  public var lines: [Int]
  public var reasons: [Choice]
  public var fix: String?
  public var fixHtml: String?
}

public struct AiReviewStep: Codable, Hashable, Sendable {
  public enum FlawClass: String, Codable, Sendable {
    case logic, race, security
    case hallucinatedApi = "hallucinated-api"
    case edgeCase = "edge-case"
    case performance
  }

  public var id: String
  public var concept: String
  public var difficulty: Int
  public var code: String
  public var codeHtml: String
  public var language: Language
  public var prompt: Rich
  public var lines: [Int]
  public var reasons: [Choice]
  public var fix: String?
  public var fixHtml: String?
  public var request: String
  public var flawClass: FlawClass
}

/// The reference solution is not here. It ships in the separate solutions file.
public struct CodeChallengeStep: Codable, Hashable, Sendable {
  /// `python` runs through Pyodide on the web and `tsx` through the React runtime.
  /// On iOS, UnderstoryRunner runs js, ts and tsx on JavaScriptCore and Python in a hidden
  /// web view (docs/SANDBOX.md, "On iOS" under "React challenges" and "Python").
  public enum ChallengeLanguage: String, Codable, Sendable { case js, ts, tsx, python }

  public var id: String
  public var concept: String
  public var difficulty: Int
  public var prompt: Rich
  public var language: ChallengeLanguage
  public var starterCode: String
  public var starterHtml: String
  public var testsCode: String
  /// Assessments only: tests scored on submit and never shown before.
  public var hiddenCode: String?
  public var performanceCode: String?
  /// Per performance test, in milliseconds.
  public var timeLimitMs: Int?
  /// True when the web editor checks types and a run must type-check to pass. Resolved by
  /// the build, so absent means no checking. iOS has no checker yet: it grades on the
  /// tests and says types are not checked, as the web does when its checker is not there
  /// (`StepRuntime.typesChecked`).
  public var typecheck: Bool?
  /// Python only: the packages beyond the standard library the step imports, among
  /// numpy, pandas and pydantic. Both the web and `PythonRunner` load them, with those the
  /// code and tests import, before the run's budget starts (docs/SANDBOX.md, "Packages").
  public var packages: [String]?
  /// Starter lines the learner edits, as "5-9" (src/core/content/editable.ts). The editor
  /// locks the rest; `lockedFrame` gives the app's editor the same lock.
  public var editable: String?
  public var hints: [Rich]
  /// The same challenge in a second language (src/core/content/twin.ts). The web lets the
  /// learner switch; the app plays the main language until it has a switch of its own.
  /// Its solution is under "<id>:twin" in the solutions file.
  public var twin: Twin?

  /// A twin's own files and runtime. Prompt, hints, id and scoring are the step's.
  public struct Twin: Codable, Hashable, Sendable {
    public var language: ChallengeLanguage
    public var starterCode: String
    public var starterHtml: String
    public var testsCode: String
    public var typecheck: Bool?
    public var packages: [String]?
    public var editable: String?
  }
}

public struct ExplainBackStep: Codable, Hashable, Sendable {
  public var id: String
  public var concept: String
  public var difficulty: Int
  public var prompt: Rich
  public var rubric: [String]
  public var modelAnswer: Rich
}

public struct LabStep: Codable, Hashable, Sendable {
  public struct Checkpoint: Codable, Hashable, Sendable {
    public var question: Rich
    public var choices: [Choice]
    public var difficulty: Int
  }

  public var id: String
  public var concept: String
  public var lab: String
  public var intro: Rich
  public var preset: [String: JSONValue]?
  public var checkpoint: Checkpoint?
  /// Shown by a client that does not have this lab. Always a portable step.
  public var fallback: CompiledStep
}

public struct IncidentStep: Codable, Hashable, Sendable {
  public var id: String
  public var concept: String
  public var difficulty: Int
  public var incident: String
  public var fallback: CompiledStep
}

/// Edit a page and watch it render (`CompiledPlaygroundStep` in src/core/content/compiled.ts).
/// `PlaygroundPreview` in UnderstoryRunner draws it in a WKWebView with the web's page
/// builder and judges it with the web's checks.
public struct PlaygroundStep: Codable, Hashable, Sendable {
  public enum Field: String, Codable, Sendable { case html, css, js, jsx }

  /// What a check does to the page before it looks: a click, or text typed into a field.
  public enum Action: Codable, Hashable, Sendable {
    case click(String)
    case type(String, into: String)

    private enum Keys: String, CodingKey { case click, type, into }

    public init(from decoder: any Decoder) throws {
      let container = try decoder.container(keyedBy: Keys.self)
      if let selector = try container.decodeIfPresent(String.self, forKey: .click) {
        self = .click(selector)
      } else {
        self = .type(
          try container.decode(String.self, forKey: .type),
          into: try container.decode(String.self, forKey: .into))
      }
    }

    public func encode(to encoder: any Encoder) throws {
      var container = encoder.container(keyedBy: Keys.self)
      switch self {
      case .click(let selector):
        try container.encode(selector, forKey: .click)
      case .type(let text, let selector):
        try container.encode(text, forKey: .type)
        try container.encode(selector, forKey: .into)
      }
    }
  }

  public struct Check: Codable, Hashable, Sendable {
    public struct Attribute: Codable, Hashable, Sendable {
      public var name: String
      public var value: String?
    }

    public struct Style: Codable, Hashable, Sendable {
      public var property: String
      public var value: String
    }

    public var label: String
    public var selector: String
    public var count: Int?
    public var text: String?
    public var attribute: Attribute?
    public var style: Style?
    /// Done in order before the check looks at the page.
    public var actions: [Action]?
  }

  public struct Solution: Codable, Hashable, Sendable {
    public var html: String?
    public var css: String?
    public var js: String?
    public var jsx: String?
  }

  public var id: String
  /// Present when the step has checks, and then it is scored.
  public var concept: String?
  public var difficulty: Int?
  public var prompt: Rich
  /// Absent in a React playground, which has `jsx` instead.
  public var html: String?
  public var css: String?
  public var js: String?
  /// A React component file. Its default export is rendered into `#root`.
  public var jsx: String?
  public var editable: [Field]
  public var showTree: Bool?
  public var checks: [Check]?
  public var solution: Solution?
  public var hints: [Rich]?
}

/// SQL against a small seeded Postgres database (`CompiledSqlStep` in
/// src/core/content/compiled.ts). `SqlRunner` in UnderstoryRunner runs it on PGlite, Postgres
/// in WebAssembly, in a hidden WKWebView as Pyodide runs, and judges it with the web's verdict.
public struct SqlStep: Codable, Hashable, Sendable {
  public struct Checks: Codable, Hashable, Sendable {
    /// Compare row order too.
    public var ordered: Bool?
    /// Run after the learner's SQL; its result is what gets compared.
    public var query: String?
  }

  public var id: String
  /// Present when the step has checks, and then it is scored.
  public var concept: String?
  public var difficulty: Int?
  public var prompt: Rich
  /// Tables and seed rows, run on a fresh database before every attempt.
  public var setup: String
  public var starter: String
  public var solution: String?
  public var checks: Checks?
  public var showSchema: Bool?
  public var hints: [Rich]?
}

/// A lesson step, decoded by its `type` discriminant.
///
/// A type this build does not know becomes `.unsupported`, so an older app can skip a step
/// a newer bundle added instead of refusing the whole lesson. A known type with a broken
/// shape still throws: that is a contract break, and the contract tests should see it.
public indirect enum CompiledStep: Codable, Hashable, Sendable {
  case prose(ProseStep)
  case predictOutput(PredictOutputStep)
  case multipleChoice(MultipleChoiceStep)
  case traceTable(TraceTableStep)
  case fillBlank(FillBlankStep)
  case parsons(ParsonsStep)
  case bugHunt(BugHuntStep)
  case aiReview(AiReviewStep)
  case codeChallenge(CodeChallengeStep)
  case explainBack(ExplainBackStep)
  case lab(LabStep)
  case incident(IncidentStep)
  case playground(PlaygroundStep)
  case sql(SqlStep)
  case unsupported(type: String, id: String?)

  private enum Keys: String, CodingKey { case type, id }

  public init(from decoder: Decoder) throws {
    let container = try decoder.container(keyedBy: Keys.self)
    let type = try container.decode(String.self, forKey: .type)
    switch type {
    case "prose": self = .prose(try ProseStep(from: decoder))
    case "predict-output": self = .predictOutput(try PredictOutputStep(from: decoder))
    case "multiple-choice": self = .multipleChoice(try MultipleChoiceStep(from: decoder))
    case "trace-table": self = .traceTable(try TraceTableStep(from: decoder))
    case "fill-blank": self = .fillBlank(try FillBlankStep(from: decoder))
    case "parsons": self = .parsons(try ParsonsStep(from: decoder))
    case "bug-hunt": self = .bugHunt(try BugHuntStep(from: decoder))
    case "ai-review": self = .aiReview(try AiReviewStep(from: decoder))
    case "code-challenge": self = .codeChallenge(try CodeChallengeStep(from: decoder))
    case "explain-back": self = .explainBack(try ExplainBackStep(from: decoder))
    case "lab": self = .lab(try LabStep(from: decoder))
    case "incident": self = .incident(try IncidentStep(from: decoder))
    case "playground": self = .playground(try PlaygroundStep(from: decoder))
    case "sql": self = .sql(try SqlStep(from: decoder))
    default:
      self = .unsupported(type: type, id: try container.decodeIfPresent(String.self, forKey: .id))
    }
  }

  public func encode(to encoder: Encoder) throws {
    var container = encoder.container(keyedBy: Keys.self)
    try container.encode(type, forKey: .type)
    switch self {
    case .prose(let step): try step.encode(to: encoder)
    case .predictOutput(let step): try step.encode(to: encoder)
    case .multipleChoice(let step): try step.encode(to: encoder)
    case .traceTable(let step): try step.encode(to: encoder)
    case .fillBlank(let step): try step.encode(to: encoder)
    case .parsons(let step): try step.encode(to: encoder)
    case .bugHunt(let step): try step.encode(to: encoder)
    case .aiReview(let step): try step.encode(to: encoder)
    case .codeChallenge(let step): try step.encode(to: encoder)
    case .explainBack(let step): try step.encode(to: encoder)
    case .lab(let step): try step.encode(to: encoder)
    case .incident(let step): try step.encode(to: encoder)
    case .playground(let step): try step.encode(to: encoder)
    case .sql(let step): try step.encode(to: encoder)
    case .unsupported(_, let id): try container.encodeIfPresent(id, forKey: .id)
    }
  }

  /// The wire name of the step type, as in `StepType` on the web.
  public var type: String {
    switch self {
    case .prose: "prose"
    case .predictOutput: "predict-output"
    case .multipleChoice: "multiple-choice"
    case .traceTable: "trace-table"
    case .fillBlank: "fill-blank"
    case .parsons: "parsons"
    case .bugHunt: "bug-hunt"
    case .aiReview: "ai-review"
    case .codeChallenge: "code-challenge"
    case .explainBack: "explain-back"
    case .lab: "lab"
    case .incident: "incident"
    case .playground: "playground"
    case .sql: "sql"
    case .unsupported(let type, _): type
    }
  }

  /// The stable step id that progress events point at. Nil only for an unsupported step
  /// that carried none.
  public var id: String? {
    switch self {
    case .prose(let step): step.id
    case .predictOutput(let step): step.id
    case .multipleChoice(let step): step.id
    case .traceTable(let step): step.id
    case .fillBlank(let step): step.id
    case .parsons(let step): step.id
    case .bugHunt(let step): step.id
    case .aiReview(let step): step.id
    case .codeChallenge(let step): step.id
    case .explainBack(let step): step.id
    case .lab(let step): step.id
    case .incident(let step): step.id
    case .playground(let step): step.id
    case .sql(let step): step.id
    case .unsupported(_, let id): id
    }
  }

  /// The concept a scored step gives evidence for. Prose has none.
  public var concept: String? {
    switch self {
    case .prose, .unsupported: nil
    case .predictOutput(let step): step.concept
    case .multipleChoice(let step): step.concept
    case .traceTable(let step): step.concept
    case .fillBlank(let step): step.concept
    case .parsons(let step): step.concept
    case .bugHunt(let step): step.concept
    case .aiReview(let step): step.concept
    case .codeChallenge(let step): step.concept
    case .explainBack(let step): step.concept
    case .lab(let step): step.concept
    case .incident(let step): step.concept
    case .playground(let step): step.checks == nil ? nil : step.concept
    case .sql(let step): step.checks == nil ? nil : step.concept
    }
  }

  /// What a client without labs or the incident desk shows in place of this step: the
  /// authored fallback for `lab` and `incident`, the step itself otherwise, and nil for a
  /// step this build cannot show at all.
  public var portable: CompiledStep? {
    switch self {
    case .lab(let step): step.fallback.portable
    case .incident(let step): step.fallback.portable
    case .unsupported: nil
    default: self
    }
  }

  /// Steps that need a keyboard. Phone practice sessions leave them out.
  public var needsTyping: Bool {
    if case .codeChallenge = self { return true }
    return false
  }
}

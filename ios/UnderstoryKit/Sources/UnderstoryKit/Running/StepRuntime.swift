import Foundation

/// What a step needs from the phone to be answered, and whether the phone can do it at
/// all. The lesson player reads this before it shows a step: it prepares the downloads,
/// shows the notes, and for a step the app cannot run it says so and offers the web,
/// rather than grading on a guess (docs/ios/PLAN.md, "Code on the phone").
public struct StepRuntime: Hashable, Sendable {
  public enum Kind: Hashable, Sendable {
    /// Nothing runs: the answer is graded by the rules in the app.
    case none
    /// js, ts or tsx on JavaScriptCore with the shared harness.
    case script(CodeChallengeStep.ChallengeLanguage)
    /// Pyodide in a hidden web view.
    case python
    /// The page in a web view, with the web's page builder and checks.
    case playground(react: Bool)
    /// PGlite in a hidden web view.
    case sql
  }

  /// Files fetched once and kept, before the first run that needs them.
  public enum Download: Hashable, Sendable {
    /// CPython in WebAssembly, 13.2 MB.
    case pyodide
    /// The wheels of these packages and their dependencies.
    case pythonPackages([String])
    /// Postgres in WebAssembly, 16.8 MB.
    case postgres
  }

  public var kind: Kind
  public var downloads: [Download]
  /// False for a TypeScript step with `typecheck`: the app has no checker yet, so it
  /// grades on the tests alone, as the web does when its checker is not available.
  public var typesChecked: Bool
  /// Why the app cannot do this step, in one sentence. Nil when it can.
  public var webOnlyReason: String?

  public init(
    kind: Kind, downloads: [Download] = [], typesChecked: Bool = true,
    webOnlyReason: String? = nil
  ) {
    self.kind = kind
    self.downloads = downloads
    self.typesChecked = typesChecked
    self.webOnlyReason = webOnlyReason
  }

  /// What the step shows beside a run, in the order to show it.
  public var notes: [String] {
    typesChecked ? [] : [Self.typesNotChecked]
  }

  public static let typesNotChecked = "Types are not checked in the app. The tests still run."

  /// The line a step shows when its runtime is missing or failed: the reason, then the
  /// way on. Interface copy, so no "please" and no exclamation.
  public static func openOnWeb(because reason: String) -> String {
    let sentence = reason.hasSuffix(".") ? reason : reason + "."
    return "\(sentence) Open this step on the web to finish it."
  }
}

extension CompiledStep {
  /// What this step needs on the phone. A lab or an incident is played as its fallback.
  public var runtime: StepRuntime {
    guard let step = portable else {
      return StepRuntime(kind: .none, webOnlyReason: "This step does not work in the app yet.")
    }
    switch step {
    case .codeChallenge(let challenge):
      return challenge.runtime
    case .playground(let playground):
      return StepRuntime(kind: .playground(react: playground.jsx != nil))
    case .sql:
      return StepRuntime(kind: .sql, downloads: [.postgres])
    default:
      return StepRuntime(kind: .none)
    }
  }
}

extension CodeChallengeStep {
  public var runtime: StepRuntime {
    switch language {
    case .python:
      let unknown = (packages ?? []).filter { !PythonPackages.isSupported($0) }
      if !unknown.isEmpty {
        let names = unknown.joined(separator: ", ")
        return StepRuntime(
          kind: .python, webOnlyReason: "This step needs \(names), which the app does not have yet.")
      }
      let needed = PythonPackages.needed(code: starterCode, tests: testsCode, named: packages)
      return StepRuntime(
        kind: .python, downloads: [.pyodide] + (needed.isEmpty ? [] : [.pythonPackages(needed)]))
    case .ts, .tsx, .js:
      return StepRuntime(kind: .script(language), typesChecked: typecheck != true)
    }
  }
}

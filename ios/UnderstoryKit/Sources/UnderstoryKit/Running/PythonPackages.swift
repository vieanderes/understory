import Foundation

/// The Python packages a challenge may import beyond the standard library, and how a run
/// finds out which it needs: src/core/running/python-packages.ts, case for case.
///
/// Three, chosen for the AI chapters. Each is megabytes of WebAssembly, so a run loads
/// only what its code and tests import, or what the step names, on the first run that
/// needs it (docs/SANDBOX.md, "Packages").
public enum PythonPackages {
  /// In the web's order, which is also the order a run lists them in.
  public static let supported = ["numpy", "pandas", "pydantic"]

  public static func isSupported(_ name: String) -> Bool { supported.contains(name) }

  /// A module that belongs to a supported package without being its own name.
  private static let providedBy = ["pydantic_core": "pydantic"]

  private static func package(ofModule module: String) -> String? {
    let top = String(module.split(separator: ".", omittingEmptySubsequences: false).first ?? "")
    if isSupported(top) { return top }
    return providedBy[top]
  }

  // The web's two patterns. A scan, not a parser: an import inside a string counts too,
  // which only loads a package early, and `__import__("numpy")` is not seen.
  private static let importLine = try! NSRegularExpression(
    pattern: #"^[ \t]*import[ \t]+([^#\n]+)"#, options: [.anchorsMatchLines])
  private static let fromLine = try! NSRegularExpression(
    pattern: #"^[ \t]*from[ \t]+([A-Za-z_][\w.]*)[ \t]+import\b"#, options: [.anchorsMatchLines])

  private static func captures(_ regex: NSRegularExpression, in source: String) -> [String] {
    let text = source as NSString
    return regex.matches(in: source, range: NSRange(location: 0, length: text.length)).map {
      text.substring(with: $0.range(at: 1))
    }
  }

  /// The supported packages the sources import, in the web's order, each once.
  public static func imported(_ sources: String...) -> [String] {
    var found = Set<String>()
    for source in sources {
      for list in captures(importLine, in: source) {
        for part in list.split(separator: ",", omittingEmptySubsequences: false) {
          let name = part.trimmingCharacters(in: .whitespaces)
            .split(whereSeparator: { $0 == " " || $0 == "\t" }).first.map(String.init) ?? ""
          if let owner = package(ofModule: name) { found.insert(owner) }
        }
      }
      for module in captures(fromLine, in: source) {
        if let owner = package(ofModule: module) { found.insert(owner) }
      }
    }
    return supported.filter(found.contains)
  }

  /// What `prepareRun` loads for a run: the imports of the code and the tests, and the
  /// packages the step names, so a learner who has not typed the import yet gets them.
  /// Names the app does not ship are left out here; `StepRuntime` says so up front.
  public static func needed(code: String, tests: String, named: [String]?) -> [String] {
    let wanted = Set(imported(code, tests)).union(named ?? [])
    return supported.filter(wanted.contains)
  }

  /// "Loading numpy…", "Loading Python and numpy…", "Loading numpy, pandas and pydantic…".
  public static func loadingLabel(_ what: [String]) -> String {
    let last = what.last ?? ""
    let list =
      what.count < 2 ? last : "\(what.dropLast().joined(separator: ", ")) and \(last)"
    return "Loading \(list)…"
  }
}

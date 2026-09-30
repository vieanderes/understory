import Foundation
import Testing
import UnderstoryKit

@testable import UnderstoryRunner

/// The web's page builder, checks and SQL verdict, called from Swift. These pin the
/// bridge, not the rules: the rules have their own tests in the web repo, and the bundle
/// is those very functions.
struct CoreKitTests {
  static let kit = try! CoreKit.shared()

  static func check(_ json: String) throws -> PlaygroundStep.Check {
    try JSONDecoder().decode(PlaygroundStep.Check.self, from: Data(json.utf8))
  }

  @Test("builds the web's page: the policy first, the probe by nonce, the learner's HTML")
  func page() throws {
    let checks = [try Self.check(#"{"label":"One h1","selector":"h1","count":1}"#)]
    let page = try Self.kit.page(
      PlaygroundFiles(html: "<h1>Pancakes</h1>", css: "h1 { color: teal; }"),
      probe: CoreKit.Probe(nonce: "abc123", checks: checks))
    #expect(page.hasPrefix("<!doctype html><html lang=\"en\"><head><title data-understory>Preview</title>"))
    #expect(page.contains("http-equiv=\"Content-Security-Policy\""))
    #expect(page.contains("script-src 'nonce-abc123'"))
    #expect(page.contains("<body><h1>Pancakes</h1>"))
    #expect(page.contains("<style data-understory>h1 { color: teal; }</style>"))
  }

  @Test("a React page carries the runtime and the learner's module, or the compile error")
  func reactPage() throws {
    let module = ComponentModule.compile(
      "export default function App() { return <p>Hi</p>; }", with: try SucraseTranspiler.shared())
    guard case .code(let code) = module else {
      Issue.record("expected code, got \(module)")
      return
    }
    #expect(code.contains("jsx"))
    let page = try Self.kit.page(
      PlaygroundFiles(jsx: "export default function App() { return <p>Hi</p>; }"),
      react: CoreKit.React(runtime: "window.__understoryReact = {};", component: module))
    #expect(page.contains("<div id=\"root\"></div>"))
    #expect(page.contains("window.__understoryReact = {};"))

    let broken = ComponentModule.compile("export default function App() { return <p>; }", with: try SucraseTranspiler.shared())
    guard case .error(_, let line) = broken else {
      Issue.record("expected an error, got \(broken)")
      return
    }
    #expect(line == 1)
    let failing = try Self.kit.page(
      PlaygroundFiles(jsx: "x"), react: CoreKit.React(runtime: "", component: broken))
    #expect(failing.contains("SyntaxError"))
  }

  @Test("judges facts with the web's reasons and grades the checklist")
  func judge() throws {
    let checks = [
      try Self.check(#"{"label":"One h1","selector":"h1","count":1,"text":"Waffles"}"#),
      try Self.check(#"{"label":"Has an id","selector":"h1","attribute":{"name":"id"}}"#),
    ]
    let verdict = try Self.kit.judge(
      checks, facts: [CheckFacts(count: 1, text: "Pancakes"), CheckFacts(count: 1, attribute: .some(nil))])
    #expect(verdict.results.map(\.passed) == [false, false])
    #expect(verdict.results[0].reason == #"The first "h1" reads "Pancakes". It needs "Waffles"."#)
    #expect(verdict.results[1].reason == #"The first "h1" has no id attribute."#)
    #expect(verdict.grade.correct == false)
    #expect(verdict.grade.score == 0)
    #expect(verdict.grade.feedback.first?.message.hasPrefix("One h1: ") == true)

    let passing = try Self.kit.judge(
      checks, facts: [CheckFacts(count: 1, text: "Waffles"), CheckFacts(count: 1, attribute: "main")])
    #expect(passing.grade.correct)
    #expect(passing.grade.score == 1)

    let unreported = try Self.kit.judge(checks, facts: [])
    #expect(unreported.results.first?.reason == "The preview has not been checked yet.")
  }

  @Test("reads a page's message only when it fits the schema and carries the nonce")
  func message() {
    let good = #"{"source":"understory-playground","nonce":"n1","report":{"facts":[{"count":2}],"tree":[{"depth":0,"kind":"element","tag":"html","attrs":[]}],"truncated":false,"errors":["TypeError: x (line 3)"]}}"#
    let report = Self.kit.report(fromMessage: good, nonce: "n1")
    #expect(report?.facts.first?.count == 2)
    #expect(report?.errors == ["TypeError: x (line 3)"])
    #expect(Self.kit.report(fromMessage: good, nonce: "other") == nil)
    let forged = good.replacingOccurrences(of: "understory-playground", with: "someone-else")
    #expect(Self.kit.report(fromMessage: forged, nonce: "n1") == nil)
    #expect(Self.kit.report(fromMessage: "not json", nonce: "n1") == nil)
    let extra = good.replacingOccurrences(of: #""truncated":false"#, with: #""truncated":false,"x":1"#)
    #expect(Self.kit.report(fromMessage: extra, nonce: "n1") == nil)
  }

  static func ran(_ rows: [[String?]], columns: [String] = ["id"]) -> SqlRunReport {
    .ran(
      statements: [
        .ok(
          line: 1, text: "select id from t", command: "SELECT",
          result: SqlResultSet(columns: columns, rows: rows, rowCount: rows.count), affected: nil,
          ms: 1)
      ], skipped: 0, query: nil, schema: nil)
  }

  @Test("the SQL verdict is the web's: a match, the first difference, an error, no grade when unavailable")
  func sql() throws {
    let match = try Self.kit.judge(
      learner: Self.ran([["2"], ["1"]]), expected: Self.ran([["1"], ["2"]]), checks: nil)
    #expect(match.verdict == .match)
    #expect(match.grade?.correct == true)

    let ordered = try Self.kit.judge(
      learner: Self.ran([["2"], ["1"]]), expected: Self.ran([["1"], ["2"]]),
      checks: try JSONDecoder().decode(SqlStep.Checks.self, from: Data(#"{"ordered":true}"#.utf8)))
    guard case .mismatch(let differences) = ordered.verdict else {
      Issue.record("expected a mismatch, got \(ordered.verdict)")
      return
    }
    #expect(!differences.isEmpty)
    #expect(ordered.grade?.score == 0)

    let failed = try Self.kit.judge(
      learner: .ran(
        statements: [
          .error(line: 2, text: "selct", error: SqlError(message: "syntax error at or near \"selct\"", line: 2))
        ], skipped: 0, query: nil, schema: nil),
      expected: Self.ran([["1"]]), checks: nil)
    #expect(failed.verdict == .error(message: "Line 2: syntax error at or near \"selct\""))

    let slow = try Self.kit.judge(learner: .timeout(limitMs: 5_000), expected: Self.ran([["1"]]), checks: nil)
    #expect(slow.verdict == .error(message: "Your SQL ran for more than 5 seconds and was stopped."))

    let down = try Self.kit.judge(
      learner: .unavailable(reason: "The database did not load."), expected: Self.ran([["1"]]), checks: nil)
    #expect(down.verdict == .unavailable(reason: "The database did not load."))
    #expect(down.grade == nil)
  }

  @Test("a report survives the trip through Swift unchanged")
  func sqlRoundTrip() throws {
    let json = #"{"status":"ran","statements":[{"status":"ok","line":1,"text":"insert into t values (1)","command":"INSERT","affected":1,"ms":0.4},{"status":"error","line":2,"text":"select nope","error":{"message":"column \"nope\" does not exist","code":"42703","line":2,"column":8}}],"skipped":1,"query":{"result":{"columns":["id"],"rows":[["1"],[null]],"rowCount":2}},"schema":[{"name":"t","columns":[{"name":"id","type":"integer","notNull":true,"primaryKey":true}]}]}"#
    let report = try JSONDecoder().decode(SqlRunReport.self, from: Data(json.utf8))
    let again = try JSONDecoder().decode(SqlRunReport.self, from: JSONEncoder().encode(report))
    #expect(report == again)
    guard case .ran(let statements, let skipped, let query, let schema) = report else {
      Issue.record("expected ran")
      return
    }
    #expect(statements.count == 2)
    #expect(skipped == 1)
    #expect(query == .result(SqlResultSet(columns: ["id"], rows: [["1"], [nil]], rowCount: 2)))
    #expect(schema?.first?.columns.first?.primaryKey == true)
  }
}

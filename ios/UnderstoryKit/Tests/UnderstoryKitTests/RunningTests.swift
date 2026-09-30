import Foundation
import Testing

@testable import UnderstoryKit

/// The pure parts of running a step on the phone: which Python packages a run needs
/// (src/core/running/python-packages.ts), the editable region of a starter
/// (src/core/content/editable.ts), and what a step needs from this device.
/// The cases mirror the web's unit tests, so the two agree line for line.
struct PythonPackagesTests {
  @Test("finds plain, aliased, dotted and from imports")
  func plainImports() {
    #expect(PythonPackages.imported("import numpy as np\n") == ["numpy"])
    #expect(PythonPackages.imported("from pandas import DataFrame\n") == ["pandas"])
    #expect(PythonPackages.imported("import numpy.linalg\n") == ["numpy"])
    #expect(PythonPackages.imported("from pydantic.fields import Field\n") == ["pydantic"])
  }

  @Test("reads a comma list and an indented import")
  func commaList() {
    let source = "import os, numpy as np, pandas\n\ndef f():\n    import pydantic\n"
    #expect(PythonPackages.imported(source) == ["numpy", "pandas", "pydantic"])
  }

  @Test("joins several sources, sorted and without repeats")
  func severalSources() {
    #expect(PythonPackages.imported("import pandas\n", "import numpy\nimport pandas\n") == ["numpy", "pandas"])
  }

  @Test("ignores comments, relative imports, the standard library and look-alike names")
  func ignores() {
    let source = [
      "# import numpy",
      "from . import pandas",
      "import numpyish",
      "import json, asyncio",
      "from pydantic_settings import BaseSettings",
      "x = \"import pandas\"",
    ].joined(separator: "\n")
    #expect(PythonPackages.imported(source) == [])
  }

  @Test("takes pydantic_core as pydantic, which brings it")
  func pydanticCore() {
    #expect(PythonPackages.imported("from pydantic_core import ValidationError\n") == ["pydantic"])
  }

  @Test("a run needs what it imports plus what the step names, in the web's order")
  func needed() {
    #expect(
      PythonPackages.needed(code: "import pandas\n", tests: "", named: ["numpy"]) == [
        "numpy", "pandas",
      ])
    #expect(PythonPackages.needed(code: "x = 1\n", tests: "import json\n", named: nil) == [])
  }

  @Test("only numpy, pandas and pydantic are supported")
  func supported() {
    #expect(PythonPackages.supported == ["numpy", "pandas", "pydantic"])
    #expect(PythonPackages.isSupported("pandas"))
    #expect(!PythonPackages.isSupported("requests"))
  }

  @Test("the status line names what is loading")
  func loadingLabel() {
    #expect(PythonPackages.loadingLabel(["numpy"]) == "Loading numpy…")
    #expect(PythonPackages.loadingLabel(["Python", "numpy"]) == "Loading Python and numpy…")
    #expect(
      PythonPackages.loadingLabel(["numpy", "pandas", "pydantic"])
        == "Loading numpy, pandas and pydantic…")
  }
}

struct EditableRegionTests {
  static let starter = [
    "function cartTotal(lines) {",
    "  let total = 0;",
    "  // Add each line here.",
    "  return total;",
    "}",
    "",
  ].joined(separator: "\n")

  @Test("reads a range and a single line")
  func parse() {
    #expect(LineRange(parsing: "3-5") == LineRange(first: 3, last: 5))
    #expect(LineRange(parsing: "3") == LineRange(first: 3, last: 3))
  }

  @Test("refuses what is not a forward range of line numbers")
  func refuses() {
    for text in ["", "0", "0-2", "5-3", "a-b", "3-", "-3", " 3-5", "3 - 5", "3-5-7", "٣"] {
      #expect(LineRange(parsing: text) == nil, "\(text)")
    }
  }

  @Test("keeps the lines before and after the range, with their line breaks")
  func frame() {
    #expect(
      LockedFrame(starter: Self.starter, range: LineRange(first: 3, last: 3))
        == LockedFrame(
          head: "function cartTotal(lines) {\n  let total = 0;\n", tail: "\n  return total;\n}\n"))
  }

  @Test("has an empty head or tail when the range starts or ends the file")
  func edges() {
    #expect(
      LockedFrame(starter: "a\nb\nc", range: LineRange(first: 1, last: 2))
        == LockedFrame(head: "", tail: "\nc"))
    #expect(
      LockedFrame(starter: "a\nb\nc", range: LineRange(first: 2, last: 3))
        == LockedFrame(head: "a\n", tail: ""))
  }

  @Test("is nil for a range past the last line")
  func pastTheEnd() {
    #expect(LockedFrame(starter: "a\nb", range: LineRange(first: 2, last: 3)) == nil)
    #expect(LockedFrame(starter: "a\nb", range: LineRange(first: 3, last: 3)) == nil)
  }

  @Test("finds the region, follows it as it grows, and allows it empty, in UTF-16 offsets")
  func locate() throws {
    let frame = try #require(LockedFrame(starter: Self.starter, range: LineRange(first: 3, last: 3)))
    let region = try #require(frame.locate(in: Self.starter))
    #expect((Self.starter as NSString).substring(with: region) == "  // Add each line here.")

    let body = "  for (const line of lines) {\n    total += line; // ✓ ünïcode\n  }"
    let doc = frame.head + body + frame.tail
    let grown = try #require(frame.locate(in: doc))
    #expect((doc as NSString).substring(with: grown) == body)

    let empty = frame.head + frame.tail
    #expect(frame.locate(in: empty) == NSRange(location: frame.head.utf16.count, length: 0))
  }

  @Test("is nil for a draft whose locked lines were changed, so it stays fully editable")
  func changedScaffold() throws {
    let frame = try #require(LockedFrame(starter: Self.starter, range: LineRange(first: 3, last: 3)))
    #expect(frame.locate(in: Self.starter.replacingOccurrences(of: "let total", with: "var total")) == nil)
    #expect(frame.locate(in: Self.starter.replacingOccurrences(of: "return", with: "yield")) == nil)
    #expect(LockedFrame(head: "function", tail: "on").locate(in: "function") == nil)
  }

  @Test("a code challenge exposes its region, and none for a range past the starter")
  func challenge() throws {
    var step = try Self.challenge()
    step.editable = "3"
    #expect(step.lockedFrame?.head == "function cartTotal(lines) {\n  let total = 0;\n")
    step.editable = "40-41"
    #expect(step.lockedFrame == nil)
    step.editable = nil
    #expect(step.lockedFrame == nil)
  }

  static func challenge() throws -> CodeChallengeStep {
    let json = """
      {"id":"c","concept":"js.loops","difficulty":1,"prompt":{"md":"Add.","html":""},
       "language":"js","starterCode":\(try String(data: JSONEncoder().encode(starter), encoding: .utf8)!),
       "starterHtml":"","testsCode":"","hints":[]}
      """
    return try JSONDecoder().decode(CodeChallengeStep.self, from: Data(json.utf8))
  }
}

/// What a step needs from the phone, and whether it can be done here at all. A step that
/// cannot is shown with a way to the web, and never graded on a guess.
struct StepRuntimeTests {
  static func step(_ json: String) throws -> CompiledStep {
    try JSONDecoder().decode(CompiledStep.self, from: Data(json.utf8))
  }

  static let prompt = #""prompt":{"md":"Do it.","html":""}"#

  @Test("steps with no code need nothing")
  func nothing() throws {
    let prose = try Self.step(#"{"type":"prose","id":"p","body":{"md":"Hi.","html":""}}"#)
    #expect(prose.runtime == StepRuntime(kind: .none))
    #expect(prose.runtime.webOnlyReason == nil)
  }

  @Test("a js, ts or tsx challenge runs on JavaScriptCore; typecheck says types go unchecked")
  func script() throws {
    let ts = try Self.step(
      #"{"type":"code-challenge","id":"c","concept":"ts.types","difficulty":1,"#
        + Self.prompt
        + #","language":"ts","starterCode":"","starterHtml":"","testsCode":"","typecheck":true,"hints":[]}"#
    )
    #expect(ts.runtime.kind == .script(.ts))
    #expect(ts.runtime.typesChecked == false)
    #expect(ts.runtime.downloads.isEmpty)
    #expect(ts.runtime.webOnlyReason == nil)
    #expect(ts.runtime.notes == [StepRuntime.typesNotChecked])
  }

  @Test("a Python challenge needs Pyodide and the packages it imports or names")
  func python() throws {
    let py = try Self.step(
      #"{"type":"code-challenge","id":"c","concept":"py.data","difficulty":1,"#
        + Self.prompt
        + #","language":"python","starterCode":"import pandas as pd\n","starterHtml":"","testsCode":"","packages":["numpy"],"hints":[]}"#
    )
    #expect(py.runtime.kind == .python)
    #expect(py.runtime.downloads == [.pyodide, .pythonPackages(["numpy", "pandas"])])
    #expect(py.runtime.webOnlyReason == nil)
  }

  @Test("a package the phone does not ship makes the step web only")
  func unknownPackage() throws {
    let py = try Self.step(
      #"{"type":"code-challenge","id":"c","concept":"py.data","difficulty":1,"#
        + Self.prompt
        + #","language":"python","starterCode":"","starterHtml":"","testsCode":"","packages":["scipy"],"hints":[]}"#
    )
    #expect(py.runtime.webOnlyReason == "This step needs scipy, which the app does not have yet.")
  }

  @Test("a playground renders in a web view; a React one also needs the React page runtime")
  func playground() throws {
    let html = try Self.step(
      #"{"type":"playground","id":"p","#
        + Self.prompt
        + #","html":"<h1>Hi</h1>","editable":["html"]}"#)
    #expect(html.runtime.kind == .playground(react: false))
    #expect(html.runtime.downloads.isEmpty)
    let react = try Self.step(
      #"{"type":"playground","id":"p","#
        + Self.prompt
        + #","jsx":"export default function App() { return null }","editable":["jsx"]}"#)
    #expect(react.runtime.kind == .playground(react: true))
    #expect(react.runtime.webOnlyReason == nil)
  }

  @Test("a sql step runs on PGlite, downloaded once")
  func sql() throws {
    let sql = try Self.step(
      #"{"type":"sql","id":"s","#
        + Self.prompt
        + #","setup":"create table t (id int);","starter":"select 1;"}"#)
    #expect(sql.runtime.kind == .sql)
    #expect(sql.runtime.downloads == [.postgres])
  }

  @Test("a step type this build does not know is web only")
  func unknownType() throws {
    let unknown = try Self.step(#"{"type":"hologram","id":"h"}"#)
    #expect(unknown.runtime.webOnlyReason == "This step does not work in the app yet.")
  }

  @Test("a lab is judged by its fallback")
  func lab() throws {
    let lab = try Self.step(
      #"{"type":"lab","id":"l","concept":"x","lab":"cache","intro":{"md":"","html":""},"#
        + #""fallback":{"type":"sql","id":"s","#
        + Self.prompt
        + #","setup":"","starter":"select 1;"}}"#)
    #expect(lab.runtime.kind == .sql)
  }

  @Test("an unavailable runtime turns into one honest sentence and a way to the web")
  func unavailableCopy() {
    let text = StepRuntime.openOnWeb(because: "Postgres did not start.")
    #expect(text == "Postgres did not start. Open this step on the web to finish it.")
    for banned in ["Please", "successfully", "!", "\u{2014}"] {
      #expect(!text.contains(banned))
    }
  }
}

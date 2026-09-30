#if canImport(WebKit)
  import Foundation
  import Testing
  import UnderstoryKit

  @testable import UnderstoryRunner

  /// The playground page in a real WKWebView, judged by the web's checks. WebKit is on
  /// macOS too, so these run under `swift test`; on the iOS simulator without a host app
  /// the page never loads (see PythonRunnerTests), so they follow the same switch.
  extension RunnerSuite {
    @Suite struct PlaygroundPreviewTests {
      static var webViewRuns: Bool { PythonRunnerTests.webViewRunsWithoutPyodide }

      static func checks(_ json: String) throws -> [PlaygroundStep.Check] {
        try JSONDecoder().decode([PlaygroundStep.Check].self, from: Data(json.utf8))
      }

      @MainActor
      static func preview() throws -> PlaygroundPreview { try PlaygroundPreview() }

      @Test("an HTML and CSS page is drawn and judged, computed styles included",
        .enabled(if: webViewRuns), .timeLimit(.minutes(1)))
      @MainActor
      func htmlAndCss() async throws {
        let checks = try Self.checks(
          #"""
          [{"label":"One heading","selector":"h1","count":1,"text":"Waffles"},
           {"label":"Teal","selector":"h1","style":{"property":"color","value":"rgb(0, 128, 128)"}},
           {"label":"Has an id","selector":"h1","attribute":{"name":"id","value":"top"}}]
          """#)
        let preview = try Self.preview()
        let solved = await preview.render(
          PlaygroundFiles(html: "<h1 id=\"top\">Waffles</h1>", css: "h1 { color: teal; }"),
          checks: checks)
        guard case .reported(let report) = solved else {
          Issue.record("no report: \(solved)")
          return
        }
        #expect(report.tree.contains { $0.tag == "h1" })
        #expect(!report.tree.contains { $0.tag == "meta" || $0.tag == "style" })
        let verdict = try #require(preview.verdict(for: checks))
        #expect(verdict.results.map(\.passed) == [true, true, true], "\(verdict)")
        #expect(verdict.grade.correct)

        let starter = await preview.judge(PlaygroundFiles(html: "<h1>Pancakes</h1>"), checks: checks)
        #expect(starter?.grade.correct == false)
        #expect(starter?.results[0].reason == #"The first "h1" reads "Pancakes". It needs "Waffles"."#)
        #expect(starter?.results[1].reason == "color is rgb(0, 0, 0). It needs rgb(0, 128, 128).")
      }

      @Test("a script error names the learner's line, and the page reports again as it changes",
        .enabled(if: webViewRuns), .timeLimit(.minutes(1)))
      @MainActor
      func scriptErrorsAndLaterReports() async throws {
        let preview = try Self.preview()
        var reports = 0
        preview.onReport = { _ in reports += 1 }
        let outcome = await preview.render(
          PlaygroundFiles(
            html: "<p id=\"out\">0</p>",
            js: "setTimeout(function () { document.getElementById('out').textContent = '1'; }, 300);\nnull.boom;"),
          checks: try Self.checks(##"[{"label":"Counts","selector":"#out","text":"1"}]"##))
        guard case .reported(let report) = outcome else {
          Issue.record("no report: \(outcome)")
          return
        }
        #expect(report.errors.first?.hasSuffix("(line 2)") == true, "\(report.errors)")
        for _ in 0..<40 where reports < 2 { try await Task.sleep(nanoseconds: 50_000_000) }
        #expect(reports >= 2)
        #expect(preview.report?.facts.first?.text == "1")
      }

      /// Storage works, unlike in the web's opaque-origin frame: the page's origin is its
      /// own scheme (an opaque one masks every script error as "Script error."), and the
      /// data store is per view and forgotten with it. The network and the bridge are out
      /// of reach, as on the web.
      @Test("the page has no network and cannot reach the app",
        .enabled(if: webViewRuns), .timeLimit(.minutes(1)))
      @MainActor
      func walls() async throws {
        let js = """
          var out = [];
          try { localStorage.setItem('a', '1'); out.push('storage'); } catch (e) { out.push('no storage'); }
          try { document.cookie = 'a=1'; out.push(document.cookie === '' ? 'no cookie' : 'cookie'); } catch (e) { out.push('no cookie'); }
          out.push(typeof window.webkit === 'undefined' || !window.webkit.messageHandlers.understoryPlayground ? 'no bridge' : 'bridge');
          document.getElementById('out').textContent = out.join(', ');
          fetch('https://example.com/').then(function () { document.getElementById('net').textContent = 'network'; },
            function () { document.getElementById('net').textContent = 'no network'; });
          """
        let preview = try Self.preview()
        let checks = try Self.checks(
          ##"[{"label":"Walls","selector":"#out","text":"x"},{"label":"Net","selector":"#net","text":"x"}]"##)
        _ = await preview.render(
          PlaygroundFiles(html: "<p id=\"out\"></p><p id=\"net\"></p>", js: js), checks: checks)
        for _ in 0..<40 where preview.report?.facts.last?.text == "" {
          try await Task.sleep(nanoseconds: 50_000_000)
        }
        #expect(preview.report?.facts.first?.text == "storage, no cookie, no bridge")
        #expect(preview.report?.facts.last?.text == "no network")
      }

      /// Off screen, as here, WebKit stretches the page's nested timers to about a second,
      /// and a check waits two of them per click and keystroke, so this takes seconds. On
      /// screen it takes milliseconds.
      @Test("a React page mounts, and a check clicks and types before it looks",
        .enabled(if: webViewRuns), .timeLimit(.minutes(1)))
      @MainActor
      func react() async throws {
        let jsx = """
          import { useState } from 'react';

          export default function App() {
            const [count, setCount] = useState(0);
            const [name, setName] = useState('');
            return (
              <main>
                <button onClick={() => setCount(count + 1)}>Add</button>
                <p id="count">{count}</p>
                <input aria-label="Name" value={name} onChange={(e) => setName(e.target.value)} />
                <p id="hello">Hello {name}</p>
              </main>
            );
          }
          """
        let checks = try Self.checks(
          #"""
          [{"label":"Starts at zero","selector":"#count","text":"0"},
           {"label":"Counts a click","selector":"#count","text":"2","actions":[{"click":"button"},{"click":"button"}]},
           {"label":"Greets","selector":"#hello","text":"Hello Ada","actions":[{"type":"Ada","into":"input"}]},
           {"label":"Missing","selector":"#x","count":1,"actions":[{"click":"#nothing"}]}]
          """#)
        let verdict = try #require(try await Self.preview().judge(PlaygroundFiles(jsx: jsx), checks: checks))
        #expect(verdict.results.map(\.passed) == [true, true, true, false], "\(verdict)")
        #expect(verdict.results[3].reason == ##"Nothing matches "#nothing" to click."##)
      }

      @Test("a component that does not compile shows the error with its line",
        .enabled(if: webViewRuns), .timeLimit(.minutes(1)))
      @MainActor
      func reactCompileError() async throws {
        let outcome = try await Self.preview().render(
          PlaygroundFiles(jsx: "export default function App() {\n  return <p>;\n}"),
          checks: try Self.checks(#"[{"label":"p","selector":"p"}]"#))
        guard case .reported(let report) = outcome else {
          Issue.record("no report: \(outcome)")
          return
        }
        #expect(report.errors.first?.hasPrefix("SyntaxError") == true, "\(report.errors)")
        #expect(report.errors.first?.contains("(line 2)") == true, "\(report.errors)")
      }

      @Test("a page that never reports is abandoned, and the next render works in a new view",
        .enabled(if: webViewRuns), .timeLimit(.minutes(1)))
      @MainActor
      func runaway() async throws {
        let preview = try Self.preview()
        let first = preview.webView
        var replaced: Int = 0
        preview.onReplace = { _ in replaced += 1 }
        let spin = await preview.render(
          PlaygroundFiles(html: "<p>x</p>", js: "while (true) {}"),
          checks: try Self.checks(#"[{"label":"p","selector":"p"}]"#), timeoutMs: 1_500)
        #expect(spin == .unresponsive)
        #expect(replaced == 1)
        #expect(preview.webView !== first)
        let after = await preview.judge(
          PlaygroundFiles(html: "<p>x</p>"), checks: try Self.checks(#"[{"label":"p","selector":"p"}]"#))
        #expect(after?.grade.correct == true)
      }
    }
  }
#endif

#if canImport(WebKit)
  extension RunnerSuite.PlaygroundPreviewTests {
    /// The other bundles (core-kit, sql-host, sql-engine) are built, not copied; for them
    /// `Scripts/sync-resources.sh --check` is the gate.
    @Test("the React page runtime is the web's committed copy")
    func runtimeIsCurrent() throws {
      let web = RunnerSuite.JavaScriptRunnerTests.repoRoot.appending(
        path: "public/sandbox/react-playground.v1.js")
      let bundled = try #require(JavaScriptRunner.resource("react-playground.v1", "js"))
      #expect(try String(contentsOf: web, encoding: .utf8) == bundled)
    }

    static let lessons = RunnerSuite.JavaScriptRunnerTests.repoRoot.appending(
      path: "public/content/v1/lessons", directoryHint: .isDirectory)

    static var bundleBuilt: Bool { FileManager.default.fileExists(atPath: lessons.path) }

    /// Every scored playground in the built bundle, with lab and incident fallbacks.
    static func scoredPlaygrounds() throws -> [PlaygroundStep] {
      let files = try FileManager.default.contentsOfDirectory(
        at: lessons, includingPropertiesForKeys: nil
      ).filter { $0.pathExtension == "json" }.sorted { $0.path < $1.path }
      return try files.flatMap { url in
        try JSONDecoder().decode(CompiledLesson.self, from: Data(contentsOf: url)).steps
          .compactMap { step -> PlaygroundStep? in
            guard case .playground(let playground) = step.portable, playground.checks != nil,
              playground.solution != nil
            else { return nil }
            return playground
          }
      }
    }

    /// The content gate's two rules (scripts/lib/playground-gate.ts), in WebKit on the
    /// phone's side: the solution passes every check with no script error, and the
    /// starter leaves something to do. The gate checks them in jsdom; this proves the
    /// phone gives the same verdicts on the same pages.
    @Test("every scored playground in the bundle: the solution passes, the starter does not",
      .enabled(if: webViewRuns && bundleBuilt), .timeLimit(.minutes(10)))
    @MainActor
    func bundleParity() async throws {
      let steps = try Self.scoredPlaygrounds()
      #expect(!steps.isEmpty)
      let preview = try Self.preview()
      for step in steps {
        let checks = step.checks ?? []
        let solution = try #require(PlaygroundFiles(solutionOf: step))
        guard case .reported(let report) = await preview.render(solution, checks: checks) else {
          Issue.record("\(step.id): the solution's page never reported")
          continue
        }
        #expect(report.errors.isEmpty, "\(step.id): \(report.errors)")
        _ = await preview.settled()
        let solved = try #require(preview.verdict(for: checks))
        #expect(solved.grade.correct, "\(step.id): \(solved.results)")
        let begun = await preview.judge(PlaygroundFiles(starterOf: step), checks: checks)
        #expect(begun?.grade.correct == false, "\(step.id): the starter passes every check")
      }
    }
  }
#endif

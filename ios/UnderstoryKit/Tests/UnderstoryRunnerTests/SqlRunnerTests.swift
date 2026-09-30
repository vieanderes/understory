#if canImport(WebKit)
  import Foundation
  import Testing
  import UnderstoryKit

  @testable import UnderstoryRunner

  /// sql steps on PGlite in a hidden WKWebView, with the web's worker, page side and
  /// verdict. The files come from the repo's node_modules (the web's pinned copy) through
  /// the same store an app uses, so the checksums are exercised on every run.
  extension RunnerSuite {
    @Suite struct SqlRunnerTests {
      static let source: URL = {
        let modules = RunnerSuite.JavaScriptRunnerTests.repoRoot.appending(
          path: "node_modules/@electric-sql/pglite", directoryHint: .isDirectory)
        return modules.resolvingSymlinksInPath().appending(path: "dist", directoryHint: .isDirectory)
      }()

      static var installed: Bool {
        FileManager.default.fileExists(atPath: source.appending(path: "pglite.wasm").path)
      }

      static var runs: Bool { installed && PythonRunnerTests.webViewRunsWithoutPyodide }

      /// One warm database for the suite, as a page keeps one.
      @MainActor static let runner: SqlRunner = {
        let store = try! PGliteAssetStore(
          source: source, directory: PythonRunnerTests.scratch("pglite"))
        return try! SqlRunner(assets: store)
      }()

      static func step(_ json: String) throws -> SqlStep {
        try JSONDecoder().decode(SqlStep.self, from: Data(json.utf8))
      }

      static let setup = """
        create table orders (id int primary key, total numeric(8,2), shipped boolean);
        insert into orders values (1, 12.5, true), (2, 3, false), (3, 40, false);
        """

      @Test("the manifest pins the PGlite version the web installs, and its three files",
        .enabled(if: installed))
      func manifest() throws {
        struct Package: Decodable { var version: String }
        let package = try JSONDecoder().decode(
          Package.self, from: Data(contentsOf: Self.source.deletingLastPathComponent().appending(path: "package.json")))
        let manifest = try PGliteManifest.bundled()
        #expect(manifest.version == package.version)
        #expect(manifest.files.keys.sorted() == ["initdb.wasm", "pglite.data", "pglite.wasm"])
        #expect(manifest.totalBytes > 15_000_000)
      }

      @Test("a store without its files is an unavailable report, not a crash")
      @MainActor
      func missing() async throws {
        let store = try PGliteAssetStore(
          source: PythonRunnerTests.scratch("nowhere"),
          directory: PythonRunnerTests.scratch("pg-empty-\(UUID().uuidString.prefix(6))"))
        let runner = try SqlRunner(assets: store)
        let report = await runner.run(SqlRunRequest(setup: "", sql: "select 1"))
        guard case .unavailable(let reason) = report else {
          Issue.record("expected unavailable, got \(report)")
          return
        }
        #expect(reason.hasPrefix("The database did not load."))
        #expect(runner.isStarted == false)
      }

      @Test("SQL runs on a fresh database each time, with Postgres's own text values",
        .enabled(if: runs), .timeLimit(.minutes(3)))
      @MainActor
      func freshDatabase() async throws {
        let report = await Self.runner.run(
          SqlRunRequest(
            setup: Self.setup,
            sql: "insert into orders values (4, 1, true);\nselect id, total, shipped from orders where not shipped order by id;",
            describe: true))
        guard case .ran(let statements, let skipped, _, let schema) = report else {
          Issue.record("expected a run, got \(report)")
          return
        }
        #expect(skipped == 0)
        #expect(statements.count == 2)
        guard case .ok(_, _, let command, let result, _, _) = statements[1] else {
          Issue.record("expected ok, got \(statements[1])")
          return
        }
        #expect(command == "SELECT")
        #expect(result?.columns == ["id", "total", "shipped"])
        #expect(result?.rows == [["2", "3.00", "f"], ["3", "40.00", "f"]])
        #expect(schema?.first?.name == "orders")
        #expect(schema?.first?.columns.first?.primaryKey == true)

        // The row inserted above is gone: every run starts from the setup.
        let again = await Self.runner.run(
          SqlRunRequest(setup: Self.setup, sql: "select count(*) as n from orders;"))
        guard case .ran(let next, _, _, _) = again, case .ok(_, _, _, let counted, _, _) = next.first
        else {
          Issue.record("expected a count, got \(again)")
          return
        }
        #expect(counted?.rows == [["3"]])
      }

      @Test("an error names its line and stops the run, as psql does",
        .enabled(if: runs), .timeLimit(.minutes(3)))
      @MainActor
      func errors() async throws {
        let report = await Self.runner.run(
          SqlRunRequest(setup: Self.setup, sql: "select 1;\nselct 2;\nselect 3;"))
        guard case .ran(let statements, let skipped, _, _) = report,
          case .error(let line, _, let error) = statements.last
        else {
          Issue.record("expected an error, got \(report)")
          return
        }
        #expect(line == 2)
        #expect(error.message.contains("selct"))
        #expect(skipped == 1)
      }

      @Test("a step is judged against its solution with the web's verdict",
        .enabled(if: runs), .timeLimit(.minutes(3)))
      @MainActor
      func judge() async throws {
        let step = try Self.step(
          #"""
          {"id":"unshipped","concept":"db.select","difficulty":1,"prompt":{"md":"","html":""},
           "setup":\#(String(data: try JSONEncoder().encode(Self.setup), encoding: .utf8)!),
           "starter":"select * from orders;","solution":"select id from orders where not shipped;",
           "checks":{}}
          """#)
        let right = await Self.runner.judge(step, sql: "select id from orders where shipped = false order by id desc")
        #expect(right?.judgement.verdict == .match)
        #expect(right?.judgement.grade?.correct == true)

        let wrong = await Self.runner.judge(step, sql: "select id from orders")
        guard case .mismatch(let differences) = wrong?.judgement.verdict else {
          Issue.record("expected a mismatch, got \(String(describing: wrong))")
          return
        }
        #expect(!differences.isEmpty)
        #expect(wrong?.judgement.grade?.score == 0)

        let free = try Self.step(
          #"{"id":"free","prompt":{"md":"","html":""},"setup":"","starter":"select 1;"}"#)
        #expect(await Self.runner.judge(free, sql: "select 1") == nil)
      }

      @Test("a query past its budget is a timeout, and the next run starts a new database",
        .enabled(if: runs), .timeLimit(.minutes(3)))
      @MainActor
      func timeout() async throws {
        let slow = await Self.runner.run(
          SqlRunRequest(setup: "", sql: "select count(*) from generate_series(1, 2000000000);"))
        #expect(slow == .timeout(limitMs: 5_000), "\(slow)")
        let after = await Self.runner.run(SqlRunRequest(setup: "", sql: "select 1 as one;"))
        guard case .ran = after else {
          Issue.record("expected a run after the timeout, got \(after)")
          return
        }
      }

      static let lessons = RunnerSuite.JavaScriptRunnerTests.repoRoot.appending(
        path: "public/content/v1/lessons", directoryHint: .isDirectory)

      static var bundleBuilt: Bool { FileManager.default.fileExists(atPath: lessons.path) }

      /// The content gate's rules for a scored sql step (scripts/lib/sql-gate.ts), on the
      /// phone: the solution matches itself, and the starter does not give its result.
      @Test("every scored sql step in the bundle: the solution matches, the starter does not",
        .enabled(if: runs && bundleBuilt), .timeLimit(.minutes(5)))
      @MainActor
      func bundleParity() async throws {
        let files = try FileManager.default.contentsOfDirectory(
          at: Self.lessons, includingPropertiesForKeys: nil
        ).filter { $0.pathExtension == "json" }
        let steps = try files.flatMap { url in
          try JSONDecoder().decode(CompiledLesson.self, from: Data(contentsOf: url)).steps
            .compactMap { step -> SqlStep? in
              guard case .sql(let sql) = step.portable, sql.checks != nil, sql.solution != nil
              else { return nil }
              return sql
            }
        }
        for step in steps {
          let solved = await Self.runner.judge(step, sql: step.solution ?? "")
          #expect(solved?.judgement.verdict == .match, "\(step.id): \(String(describing: solved))")
          let begun = await Self.runner.judge(step, sql: step.starter)
          #expect(begun?.judgement.verdict != .match, "\(step.id): the starter matches")
        }
      }
    }
  }
#endif

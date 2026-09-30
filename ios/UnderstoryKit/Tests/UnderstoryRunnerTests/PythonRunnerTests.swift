#if canImport(WebKit)
  import Foundation
  import Testing
  import UnderstoryKit

  @testable import UnderstoryRunner

  /// Python on Pyodide in a hidden WKWebView. WebKit is on macOS too, so these run under
  /// `swift test` with no simulator. The Pyodide files come from the repo's
  /// node_modules/pyodide (the web's pinned copy) through the same store an app uses, so
  /// the checksums are exercised on every run.
  extension RunnerSuite {
    @Suite struct PythonRunnerTests {
      static let pyodideSource = JavaScriptRunnerTests.repoRoot.appending(
        path: "node_modules/pyodide", directoryHint: .isDirectory)

      /// Where the web build keeps the wheels, checked against the lock file
      /// (src/adapters/pyodide/wheels.ts). Filled by `pnpm build` or sync-resources.sh.
      static let wheelCache = JavaScriptRunnerTests.repoRoot.appending(
        path: "node_modules/.cache/understory-pyodide/0.27.8", directoryHint: .isDirectory)

      static var pyodideInstalled: Bool {
        FileManager.default.fileExists(atPath: pyodideSource.appending(path: "pyodide.asm.wasm").path)
      }

      static var wheelsCached: Bool {
        guard let manifest = try? PyodideManifest.bundled(), !manifest.wheels.isEmpty else {
          return false
        }
        return manifest.wheels.keys.allSatisfy {
          FileManager.default.fileExists(atPath: wheelCache.appending(path: $0).path)
        }
      }

      /// One folder holding the start files and the wheels, as the web app's
      /// /pyodide/<version>/ does: links into node_modules, so nothing is copied twice.
      static let combinedSource: URL = {
        let folder = scratch("source")
        let files = FileManager.default
        try? files.createDirectory(at: folder, withIntermediateDirectories: true)
        let manifest = try? PyodideManifest.bundled()
        for name in manifest?.files.keys.sorted() ?? [] {
          try? files.createSymbolicLink(
            at: folder.appending(path: name), withDestinationURL: pyodideSource.appending(path: name))
        }
        for name in manifest?.wheels.keys.sorted() ?? [] {
          try? files.createSymbolicLink(
            at: folder.appending(path: name), withDestinationURL: wheelCache.appending(path: name))
        }
        return folder
      }()

      /// The runs need a web content process. Under `swift test` on macOS WebKit starts one.
      /// In a SwiftPM test bundle on the iOS simulator (`xcodebuild test`, no host app) the
      /// page never loads, so there these need an app-hosted test target, which the package
      /// does not have. `UNDERSTORY_WEBVIEW_TESTS=1` forces them on.
      static var webViewRuns: Bool { pyodideInstalled && webViewRunsWithoutPyodide }

      /// Whether a web view's page loads here at all, whatever it runs.
      static var webViewRunsWithoutPyodide: Bool {
        #if os(macOS)
          return true
        #else
          return ProcessInfo.processInfo.environment["UNDERSTORY_WEBVIEW_TESTS"] == "1"
        #endif
      }

      static func scratch(_ name: String) -> URL {
        FileManager.default.temporaryDirectory.appending(
          path: "understory-tests-\(ProcessInfo.processInfo.processIdentifier)/\(name)",
          directoryHint: .isDirectory)
      }

      /// One warm runner for the suite, as an app keeps one.
      static let runner: PythonRunner = {
        let store = try! PyodideAssetStore(source: combinedSource, directory: scratch("pyodide"))
        return PythonRunner(assets: store, bootTimeoutMs: 60_000)
      }()

      static func request(
        _ code: String, _ tests: String, timeoutMs: Int = 5_000, packages: [String]? = nil
      ) -> RunRequest {
        RunRequest(
          runId: "py-\(UUID().uuidString.prefix(8))", language: .python, code: code, tests: tests,
          timeoutMs: timeoutMs, packages: packages)
      }

      static let starter = """
        def two_sum(numbers, target):
            # Return the positions of the two numbers that add up to target.
            return []
        """

      static let solution = """
        def two_sum(numbers, target):
            seen = {}
            for index, number in enumerate(numbers):
                if target - number in seen:
                    return [seen[target - number], index]
                seen[number] = index
            return []
        """

      static let tests = """
        @test('finds the pair')
        def _():
            assert two_sum([2, 7, 11, 15], 9) == [0, 1]

        @test('works when the pair is at the end')
        def _():
            assert two_sum([3, 2, 4], 6) == [1, 2]

        @test('prints go to the log')
        def _():
            print('checking', two_sum([1, 1], 2))
            assert two_sum([1, 1], 2) == [0, 1]
        """

      // MARK: The asset store

      @Test("the manifest pins the Pyodide version the web installs")
      func manifestVersion() throws {
        let package = Self.pyodideSource.appending(path: "package.json")
        try #require(FileManager.default.fileExists(atPath: package.path), "run pnpm install")
        struct Package: Decodable { var version: String }
        let installed = try JSONDecoder().decode(Package.self, from: Data(contentsOf: package))
        let manifest = try PyodideManifest.bundled()
        #expect(manifest.version == installed.version)
        #expect(manifest.files.count == 5)
        #expect(manifest.totalBytes > 10_000_000)
      }

      @Test("the store fetches once, checks every file and repairs a damaged one",
        .enabled(if: pyodideInstalled))
      func storeFetchesAndRepairs() async throws {
        let directory = Self.scratch("store-\(UUID().uuidString.prefix(6))")
        defer { try? FileManager.default.removeItem(at: directory) }
        let store = try PyodideAssetStore(source: Self.pyodideSource, directory: directory)
        #expect(await store.isReady == false)
        try await store.ensure()
        #expect(await store.isReady)
        let names = try FileManager.default.contentsOfDirectory(atPath: directory.path).sorted()
        #expect(names == store.manifest.files.keys.sorted())

        // A new process (a new store) finds a damaged file and fetches it again.
        let loader = directory.appending(path: "pyodide.js")
        try Data("damaged".utf8).write(to: loader)
        let again = try PyodideAssetStore(source: Self.pyodideSource, directory: directory)
        try await again.ensure()
        #expect(try Data(contentsOf: loader).count == store.manifest.files["pyodide.js"]?.bytes)
      }

      @Test("a source that serves other bytes is refused", .enabled(if: pyodideInstalled))
      func storeRefusesOtherBytes() async throws {
        let directory = Self.scratch("refuse-\(UUID().uuidString.prefix(6))")
        defer { try? FileManager.default.removeItem(at: directory) }
        var manifest = try PyodideManifest.bundled()
        manifest.files = ["pyodide.js": .init(bytes: 14_913, sha256: String(repeating: "0", count: 64))]
        let store = try PyodideAssetStore(
          source: Self.pyodideSource, directory: directory, manifest: manifest)
        await #expect(throws: PyodideAssetStore.Failure.self) { try await store.ensure() }
        #expect(!FileManager.default.fileExists(atPath: directory.appending(path: "pyodide.js").path))
      }

      @Test("a missing source is an error result, not a crash")
      func missingSource() async throws {
        let store = try PyodideAssetStore(
          source: Self.scratch("nowhere"), directory: Self.scratch("empty-\(UUID().uuidString.prefix(6))"))
        let runner = PythonRunner(assets: store)
        let result = await runner.run(Self.request("x = 1", "test('t', lambda: None)"))
        #expect(result.status == .error)
        #expect(result.error?.name == "SandboxError")
        #expect(await runner.isStarted == false)
      }

      // MARK: Verdicts

      @Test("nothing of WebKit starts before the first Python run")
      func lazy() async throws {
        let store = try PyodideAssetStore(source: Self.pyodideSource, directory: Self.scratch("lazy"))
        let runner = PythonRunner(assets: store)
        #expect(await runner.isStarted == false)
        #expect(await store.isReady == false)
        let routed = CodeRunnerByLanguage(script: try JavaScriptRunner(), python: runner)
        let js = await routed.run(
          RunRequest(
            runId: "js", language: .js, code: "", tests: "test('t', function () {});",
            timeoutMs: 1_000))
        #expect(js.status == .passed)
        #expect(await runner.isStarted == false)
      }

      @Test("the solution passes and the starter fails", .enabled(if: webViewRuns),
        .timeLimit(.minutes(2)))
      func verdicts() async throws {
        let first = await Self.runner.run(Self.request(Self.solution, Self.tests, timeoutMs: 10_000))
        #expect(first.status == .passed, "\(first)")
        #expect(first.tests.map(\.name) == [
          "finds the pair", "works when the pair is at the end", "prints go to the log",
        ])
        #expect(first.logs == ["checking [0, 1]"])

        let starter = await Self.runner.run(Self.request(Self.starter, Self.tests))
        #expect(starter.status == .failed)
        #expect(starter.tests.count == 3)
        #expect(starter.tests.allSatisfy { !$0.passed })
        #expect(starter.tests.first?.message == "Expected [0, 1], received []")
      }

      @Test("a syntax error in the learner's code carries its line", .enabled(if: webViewRuns),
        .timeLimit(.minutes(2)))
      func syntaxError() async throws {
        let result = await Self.runner.run(
          Self.request("def two_sum(numbers, target):\n    return [\n", Self.tests))
        #expect(result.status == .error)
        #expect(result.error?.name == "SyntaxError")
        #expect(result.error?.line != nil)
      }

      @Test("a loop that never ends is a timeout, and the next run still works",
        .enabled(if: webViewRuns), .timeLimit(.minutes(2)))
      func timeout() async throws {
        let spin = await Self.runner.run(
          Self.request(
            "print('before the spin')\nwhile True:\n    pass", "test('t', lambda: None)",
            timeoutMs: 1_000))
        #expect(spin.status == .timeout)
        #expect(spin.error?.name == "Timeout")
        #expect(spin.logs == ["before the spin"])

        let after = await Self.runner.run(Self.request(Self.solution, Self.tests, timeoutMs: 10_000))
        #expect(after.status == .passed, "\(after)")
      }

      // MARK: Packages

      @Test("the manifest pins every wheel with the lock file's SHA-256, dependencies first",
        .enabled(if: pyodideInstalled))
      func manifestWheels() throws {
        struct Lock: Decodable {
          struct Package: Decodable {
            var file_name: String
            var sha256: String
          }
          var packages: [String: Package]
        }
        let lock = try JSONDecoder().decode(
          Lock.self, from: Data(contentsOf: Self.pyodideSource.appending(path: "pyodide-lock.json")))
        let pinned = Dictionary(uniqueKeysWithValues: lock.packages.values.map { ($0.file_name, $0.sha256) })
        let manifest = try PyodideManifest.bundled()
        #expect(Set(manifest.packages.keys) == Set(PythonPackages.supported))
        #expect(manifest.wheels.count == 9)
        for (name, file) in manifest.wheels {
          #expect(pinned[name] == file.sha256, "\(name)")
        }
        let pandas = try manifest.wheelFiles(for: ["pandas"])
        #expect(pandas.last?.hasPrefix("pandas-") == true)
        #expect(pandas.first?.hasPrefix("numpy-") == true)
        #expect(try manifest.wheelFiles(for: ["numpy", "pandas"]).count == pandas.count)
        #expect(try manifest.packageBytes(for: ["pandas"]) > 8_000_000)
        #expect(throws: PyodideAssetStore.Failure.unknownPackage("scipy")) {
          try manifest.wheelFiles(for: ["scipy"])
        }
      }

      @Test("the store fetches a package's wheels only when a run asks for it",
        .enabled(if: pyodideInstalled && wheelsCached))
      func storeFetchesWheels() async throws {
        let directory = Self.scratch("wheels-\(UUID().uuidString.prefix(6))")
        defer { try? FileManager.default.removeItem(at: directory) }
        let store = try PyodideAssetStore(source: Self.combinedSource, directory: directory)
        try await store.ensure()
        #expect(try FileManager.default.contentsOfDirectory(atPath: directory.path).count == 5)
        #expect(await store.hasPackages(["pydantic"]) == false)
        try await store.ensure(packages: ["pydantic"])
        #expect(await store.hasPackages(["pydantic"]))
        let names = try FileManager.default.contentsOfDirectory(atPath: directory.path)
        #expect(names.count == 5 + (try store.manifest.wheelFiles(for: ["pydantic"])).count)
        #expect(names.contains { $0.hasPrefix("pydantic_core-") })
      }

      @Test("a request naming a package the app does not ship is refused")
      func unknownPackageRequest() async throws {
        let store = try PyodideAssetStore(
          source: Self.scratch("nowhere"), directory: Self.scratch("none-\(UUID().uuidString.prefix(6))"))
        let result = await PythonRunner(assets: store).run(
          Self.request("x = 1", "test('t', lambda: None)", packages: ["scipy"]))
        #expect(result.status == .error)
        #expect(result.error?.name == "InvalidRequest")
      }

      @Test("numpy, pandas and pydantic import, and the first import is not on the clock",
        .enabled(if: webViewRuns && wheelsCached), .timeLimit(.minutes(3)))
      func packages() async throws {
        // pandas takes seconds to import the first time; the budget is one second.
        let result = await Self.runner.run(
          Self.request(
            """
            import numpy as np
            import pandas as pd
            from pydantic import BaseModel

            class Reply(BaseModel):
                label: str
                score: float

            def mean_score(rows):
                frame = pd.DataFrame([Reply(**row).model_dump() for row in rows])
                return float(np.round(frame['score'].mean(), 2))
            """,
            """
            @test('averages the scores')
            def _():
                assert mean_score([{'label': 'a', 'score': 0.5}, {'label': 'b', 'score': 1}]) == 0.75

            @test('pydantic rejects a bad row')
            def _():
                try:
                    mean_score([{'label': 'a', 'score': 'high'}])
                except Exception as error:
                    assert 'score' in str(error)
                else:
                    raise AssertionError('no error')
            """, timeoutMs: 1_000))
        #expect(result.status == .passed, "\(result)")

        // A step can name a package before the learner has typed the import.
        let named = await Self.runner.run(
          Self.request(
            "def total(xs):\n    import numpy\n    return int(numpy.sum(xs))",
            "test('sums', lambda: None)\nassert 'numpy' in __import__('sys').modules",
            packages: ["numpy"]))
        #expect(named.status == .passed, "\(named)")
      }

      @Test("an async test is awaited on Pyodide's loop", .enabled(if: webViewRuns),
        .timeLimit(.minutes(2)))
      func asyncTests() async throws {
        let result = await Self.runner.run(
          Self.request(
            """
            import asyncio

            async def fetch_all(ids):
                async def one(i):
                    await asyncio.sleep(0.01)
                    return i * 2
                return await asyncio.gather(*(one(i) for i in ids))
            """,
            """
            @test('gathers every result in order')
            async def _():
                assert await fetch_all([1, 2, 3]) == [2, 4, 6]

            @test('a plain test still runs')
            def _():
                assert True
            """))
        #expect(result.status == .passed, "\(result)")
        #expect(result.tests.count == 2)

        let never = await Self.runner.run(
          Self.request(
            "import asyncio",
            "@test('waits for ever')\nasync def _():\n    await asyncio.Event().wait()",
            timeoutMs: 1_000))
        #expect(never.status == .timeout, "\(never)")
      }

      @Test("the worker has no network", .enabled(if: webViewRuns), .timeLimit(.minutes(2)))
      func noNetwork() async throws {
        let result = await Self.runner.run(
          Self.request(
            "import js",
            """
            @test('fetch is blocked')
            def _():
                try:
                    js.fetch('https://example.com/')
                except Exception as error:
                    assert 'not available' in str(error)
                else:
                    raise AssertionError('fetch ran')

            @test('no XMLHttpRequest')
            def _():
                try:
                    js.XMLHttpRequest.new()
                except Exception as error:
                    assert 'not available' in str(error)
                else:
                    raise AssertionError('XMLHttpRequest ran')
            """))
        #expect(result.status == .passed, "\(result)")
      }
    }
  }
#endif

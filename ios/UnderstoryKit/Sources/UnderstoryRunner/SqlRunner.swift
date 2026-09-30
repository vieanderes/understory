#if canImport(WebKit)
  import Foundation
  import UnderstoryKit
  import WebKit

  /// Runs sql steps on PGlite, Postgres 18 in WebAssembly, in a hidden `WKWebView`, with
  /// the web's own worker and page side, and judges them with the web's verdict.
  ///
  /// The same reason as Python for a web view: WebAssembly needs the JIT, which a
  /// `JSContext` in an iOS app does not get and WebKit's content process has. What runs
  /// in it is the browser's, byte for byte:
  ///
  ///  - `sql-engine.v1.js` is src/adapters/sql/worker.ts as scripts/build-sql.ts bundles
  ///    it: PGlite and the session that resets the database, runs the setup, splits the
  ///    learner's SQL and runs it statement by statement. It is a module worker, and
  ///    PGlite fetches its three files relative to it.
  ///  - `sql-host.v1.js` is the page side, `WorkerSqlEngine`: one worker, one run at a
  ///    time, 90 s to start and 5 s a run, a worker past its budget terminated and the
  ///    next run given a new one, and never a rejection.
  ///  - The verdict is `sqlVerdict` and `gradeSql` through `CoreKit`.
  ///
  /// Learner SQL is never JavaScript, and Postgres here has no network, no shell and no
  /// file outside its memory. Still: everything comes from `understory-sql://sql/`, served
  /// by `SqlSchemeHandler` from the bundle and the asset folder; a content rule list blocks
  /// every http, https, ws and wss load; the data store is non-persistent; and the worker
  /// removes its own network APIs once Postgres has started.
  ///
  /// Lazy: nothing of WebKit exists until the first run, and PGlite's files (16.8 MB) are
  /// fetched by `PGliteAssetStore` then.
  @MainActor
  public final class SqlRunner {
    public static let scheme = "understory-sql"
    static let origin = "understory-sql://sql/"

    public nonisolated let assets: PGliteAssetStore
    private let kit: CoreKit
    private var webView: WKWebView?
    private var handler: SqlSchemeHandler?
    private var delegate: LoadDelegate?
    /// The solution's report per step, as the web keeps one per step on the page.
    private var expected: [String: SqlRunReport] = [:]

    public init(assets: PGliteAssetStore, kit: CoreKit? = nil) throws {
      self.assets = assets
      self.kit = try kit ?? CoreKit.shared()
    }

    public var isStarted: Bool { webView != nil }

    /// `SQL_LIMITS` in src/core/sql/limits.ts: the page's engine enforces them; the host
    /// only waits a little longer than the engine can take.
    static let bootTimeoutMs = 90_000
    static let runTimeoutMs = 5_000

    private var queue: Task<Void, Never>?

    /// Runs one request on a fresh database. Never throws: a runner that cannot start is
    /// `unavailable`, as on the web. Runs take turns: one database, one run at a time.
    public func run(_ request: SqlRunRequest) async -> SqlRunReport {
      let previous = queue
      let job = Task { @MainActor in
        await previous?.value
        return await self.runNow(request)
      }
      queue = Task { _ = await job.value }
      return await job.value
    }

    private func runNow(_ request: SqlRunRequest) async -> SqlRunReport {
      let view: WKWebView
      do {
        view = try await ready()
      } catch {
        tearDown()
        return .unavailable(reason: "The database did not load. \(error)")
      }
      let json = String(decoding: (try? JSONEncoder().encode(request)) ?? Data("{}".utf8), as: UTF8.self)
      let answer = await WebCall.call(
        view, "return await understorySqlRun(JSON.parse(request));", arguments: ["request": json],
        deadlineMs: Self.bootTimeoutMs + Self.runTimeoutMs + Limits.watchdogGraceMs)
      switch answer {
      case .value(let text?):
        if let report = try? JSONDecoder().decode(SqlRunReport.self, from: Data(text.utf8)) {
          return report
        }
        return .unavailable(reason: "The database answered in a way this build cannot read.")
      case .value(nil), .error:
        tearDown()
        return .unavailable(reason: "The database stopped.")
      case .timedOut:
        tearDown()
        return .unavailable(reason: "The database stopped answering.")
      }
    }

    /// The tables the step's setup makes, for the schema panel.
    public func schema(of step: SqlStep) async -> [SqlTableInfo]? {
      guard case .ran(_, _, _, let schema) = await run(
        SqlRunRequest(setup: step.setup, sql: "", describe: true))
      else { return nil }
      return schema
    }

    /// The learner's SQL against the solution's, on the same fresh database, as the sql
    /// step does on the web. Nil for a step without checks: it is a sandbox and has no
    /// grade. An `unavailable` verdict has no grade either.
    public func judge(_ step: SqlStep, sql: String) async -> (report: SqlRunReport, judgement: SqlJudgement)? {
      guard step.checks != nil, let solution = step.solution else { return nil }
      let query = step.checks?.query
      let learner = await run(SqlRunRequest(setup: step.setup, sql: sql, query: query))
      var want = expected[step.id]
      if want == nil {
        let solved = await run(SqlRunRequest(setup: step.setup, sql: solution, query: query))
        if case .ran = solved { expected[step.id] = solved }
        want = solved
      }
      guard let want,
        let judgement = try? kit.judge(learner: learner, expected: want, checks: step.checks)
      else {
        return (learner, SqlJudgement(verdict: .unavailable(reason: "The answer could not be checked.")))
      }
      return (learner, judgement)
    }

    /// Drops the web view. WebKit ends its content process, and the worker with it.
    public func tearDown() {
      webView?.stopLoading()
      webView?.navigationDelegate = nil
      webView = nil
      handler = nil
      delegate = nil
    }

    private func ready() async throws -> WKWebView {
      if let webView { return webView }
      let directory = try await assets.ensure()
      let configuration = WKWebViewConfiguration()
      configuration.websiteDataStore = .nonPersistent()
      let handler = SqlSchemeHandler(assets: directory, files: Set(assets.manifest.files.keys))
      configuration.setURLSchemeHandler(handler, forURLScheme: Self.scheme)
      configuration.userContentController.add(try await WebHost.blockNetwork())
      configuration.preferences.javaScriptCanOpenWindowsAutomatically = false
      configuration.preferences.inactiveSchedulingPolicy = .none
      let view = WKWebView(frame: CGRect(x: 0, y: 0, width: 1, height: 1), configuration: configuration)
      let delegate = LoadDelegate()
      view.navigationDelegate = delegate
      try await delegate.load(view, URL(string: Self.origin + "index.html")!, timeoutMs: 30_000) {
        [weak self] in self?.tearDown()
      }
      self.webView = view
      self.handler = handler
      self.delegate = delegate
      return view
    }
  }

  /// Waits for the page to load, and reports a content process that ends later.
  @MainActor
  private final class LoadDelegate: NSObject, WKNavigationDelegate {
    private var loaded: CheckedContinuation<Void, Error>?
    private var onTerminate: (@MainActor () -> Void)?

    func load(
      _ view: WKWebView, _ url: URL, timeoutMs: Int, onTerminate: @escaping @MainActor () -> Void
    ) async throws {
      self.onTerminate = onTerminate
      try await withCheckedThrowingContinuation { (continuation: CheckedContinuation<Void, Error>) in
        loaded = continuation
        view.load(URLRequest(url: url))
        Task { @MainActor [weak self] in
          try? await Task.sleep(nanoseconds: UInt64(timeoutMs) * 1_000_000)
          self?.finish(WebHostError("The database page did not load."))
        }
      }
    }

    private func finish(_ error: Error?) {
      guard let loaded else { return }
      self.loaded = nil
      if let error { loaded.resume(throwing: error) } else { loaded.resume() }
    }

    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) { finish(nil) }

    func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: any Error) {
      finish(error)
    }

    func webView(
      _ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!,
      withError error: any Error
    ) {
      finish(error)
    }

    func webViewWebContentProcessDidTerminate(_ webView: WKWebView) {
      finish(WebHostError("The database stopped."))
      onTerminate?()
    }
  }

  /// Serves the page, the page script, the worker and PGlite's three files, and nothing
  /// else, each with the policy the web gives it (next.config.ts for `/sql/`).
  @MainActor
  final class SqlSchemeHandler: NSObject, WKURLSchemeHandler {
    private let assets: URL
    private let files: Set<String>

    static let page = """
      <!doctype html>
      <html lang="en">
      <meta charset="utf-8">
      <title>SQL runner</title>
      <script src="host.js"></script>
      </html>
      """
    static let pagePolicy =
      "default-src 'none'; script-src 'self'; connect-src 'self'; worker-src 'self'"
    /// The web's policy for `/sql/`: WebAssembly may compile, and nothing else is added.
    static let workerPolicy =
      "default-src 'none'; script-src 'self' 'wasm-unsafe-eval'; connect-src 'self'"

    init(assets: URL, files: Set<String>) {
      self.assets = assets
      self.files = files
    }

    func webView(_ webView: WKWebView, start task: any WKURLSchemeTask) {
      guard let url = task.request.url, url.host() == "sql" else { return fail(task) }
      let name = String(url.path().dropFirst())
      switch name {
      case "index.html":
        respond(task, Data(Self.page.utf8), type: "text/html", policy: Self.pagePolicy)
      case "host.js":
        guard let text = JavaScriptRunner.resource("sql-host.v1", "js") else { return fail(task) }
        respond(task, Data(text.utf8), type: "text/javascript")
      case "engine.js":
        guard let text = JavaScriptRunner.resource("sql-engine.v1", "js") else { return fail(task) }
        respond(task, Data(text.utf8), type: "text/javascript", policy: Self.workerPolicy)
      default:
        guard files.contains(name),
          let data = try? Data(contentsOf: assets.appending(path: name), options: .alwaysMapped)
        else { return fail(task) }
        respond(
          task, data, type: name.hasSuffix(".wasm") ? "application/wasm" : "application/octet-stream")
      }
    }

    func webView(_ webView: WKWebView, stop task: any WKURLSchemeTask) {}

    private func respond(_ task: any WKURLSchemeTask, _ data: Data, type: String, policy: String? = nil) {
      var headers = [
        "Content-Type": type, "Content-Length": "\(data.count)", "Cache-Control": "no-store",
      ]
      if let policy { headers["Content-Security-Policy"] = policy }
      task.didReceive(
        HTTPURLResponse(
          url: task.request.url!, statusCode: 200, httpVersion: "HTTP/1.1", headerFields: headers)!)
      task.didReceive(data)
      task.didFinish()
    }

    private func fail(_ task: any WKURLSchemeTask) {
      task.didReceive(
        HTTPURLResponse(
          url: task.request.url ?? URL(string: SqlRunner.origin)!, statusCode: 404,
          httpVersion: "HTTP/1.1", headerFields: ["Content-Length": "0"])!)
      task.didReceive(Data())
      task.didFinish()
    }
  }
#endif

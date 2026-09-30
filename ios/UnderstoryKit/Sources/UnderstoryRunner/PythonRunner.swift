#if canImport(WebKit)
  import Foundation
  import UnderstoryKit
  import WebKit

  /// Runs Python challenges on Pyodide in a hidden `WKWebView`, with the Python harness the
  /// browser and the Node gate use (`python-harness.v1.py`), so the verdict is theirs.
  ///
  /// Why a web view: Pyodide is CPython compiled to WebAssembly, and a `JSContext` inside an
  /// app on iOS runs without a JIT, where WebAssembly is not available to it. A `WKWebView`
  /// runs its JavaScript in WebKit's own content process, which has the JIT and
  /// WebAssembly, and it has a supported way to stop a runaway run: terminating a Web
  /// Worker. docs/SANDBOX.md, "Python", has the whole design and the numbers.
  ///
  /// Lazy: nothing of WebKit exists until the first Python run, and Pyodide (13.2 MB) is
  /// downloaded by `PyodideAssetStore` on that run, not before. The web view then stays,
  /// with a warm interpreter, for the runs that follow. The wheels of numpy, pandas and
  /// pydantic are fetched on the first run that imports one (or whose step names one),
  /// and imported before the run's budget starts, as on the web.
  ///
  /// Runs go through the harness's `run_async`, so a test may be an `async def`.
  ///
  /// What it cannot reach: the page loads only from `understory-runner://`, served by
  /// `RunnerSchemeHandler` from the bundle and the asset folder; a content rule list blocks
  /// every http, https, ws and wss load; the data store is non-persistent; the worker that
  /// runs learner code has a policy that loads nothing and removes the network APIs before
  /// the first run.
  @MainActor
  public final class PythonRunner: CodeRunner {
    public nonisolated let assets: PyodideAssetStore
    /// How long a start may take before a run gives up on it: the frame's
    /// `pythonBootTimeoutMs`. A slow start never becomes a timeout verdict.
    public nonisolated let bootTimeoutMs: Int
    public nonisolated let harnessVersion = 1

    private var host: WebHost?
    private var queue: Task<Void, Never>?

    public nonisolated init(assets: PyodideAssetStore, bootTimeoutMs: Int = 60_000) {
      self.assets = assets
      self.bootTimeoutMs = bootTimeoutMs
    }

    /// True once a web view exists. False until the first Python run.
    public var isStarted: Bool { host != nil }

    /// Resolves for every outcome, like `JavaScriptRunner.run`. Runs queue: one warm
    /// interpreter takes one run at a time.
    public nonisolated func run(_ request: RunRequest) async -> RunResult {
      await enqueue(request)
    }

    /// Starts the web view and Pyodide without running anything, for a screen that knows
    /// a Python run is coming.
    public func prepare() async throws {
      let host = try await readyHost()
      try await host.boot(timeoutMs: bootTimeoutMs)
    }

    private func enqueue(_ request: RunRequest) async -> RunResult {
      let previous = queue
      let job = Task { @MainActor in
        await previous?.value
        return await self.runNow(request)
      }
      queue = Task { _ = await job.value }
      return await job.value
    }

    private func runNow(_ request: RunRequest) async -> RunResult {
      let started = DispatchTime.now()
      func elapsedMs() -> Int {
        Int((DispatchTime.now().uptimeNanoseconds - started.uptimeNanoseconds) / 1_000_000)
      }
      func failure(_ name: String, _ message: String, logs: [String] = []) -> RunResult {
        RunResult(
          status: .error, logs: logs, error: RunError(name: name, message: message),
          durationMs: elapsedMs())
      }

      if let invalid = RunRequestCheck.validate(request, harnessVersion: harnessVersion) {
        return RunResult(status: .error, error: invalid, durationMs: elapsedMs())
      }
      guard request.language == .python else {
        return failure("RunnerError", "PythonRunner runs Python only.")
      }

      // What prepareRun adds on the web: the imports of the code and the tests, and what the
      // step names.
      let packages = PythonPackages.needed(
        code: request.code, tests: request.tests, named: request.packages)
      let host: WebHost
      let wheels: [String]
      do {
        wheels = try assets.manifest.wheelFiles(for: packages)
        host = try await readyHost()
        try await assets.ensure(packages: packages)
      } catch {
        return failure("SandboxError", "\(error)")
      }

      // The page starts the budget when the worker says `started`, after the packages are
      // imported; this outer deadline only catches a page that stopped answering, and so
      // allows for a start and the packages.
      let deadlineMs = bootTimeoutMs + request.timeoutMs + Limits.watchdogGraceMs
      let outcome = await host.run(
        request, packages: packages, wheels: wheels, deadlineMs: deadlineMs)
      switch outcome {
      case .report(let json, let logs):
        var result = JavaScriptRunner.report(fromJSON: json, logs: logs)
        result.durationMs = elapsedMs()
        return result
      case .timeout(let logs):
        var result = JavaScriptRunner.timeoutResult(timeoutMs: request.timeoutMs, logs: logs)
        result.durationMs = elapsedMs()
        return result
      case .crash(let message, let logs):
        return failure("RunnerError", message, logs: logs)
      case .unresponsive:
        // Nothing came back at all. The web view goes, and the next run builds a new one.
        tearDown()
        var result = JavaScriptRunner.timeoutResult(timeoutMs: request.timeoutMs, logs: [])
        result.durationMs = elapsedMs()
        return result
      case .failed(let message):
        tearDown()
        return failure("SandboxError", message)
      }
    }

    private func readyHost() async throws -> WebHost {
      if let host, host.isAlive { return host }
      let directory = try await assets.ensure()
      let served = Set(assets.manifest.files.keys).union(assets.manifest.wheels.keys)
      let made = try await WebHost.make(
        assets: directory, served: served, loadTimeoutMs: bootTimeoutMs
      ) {
        [weak self] in
        self?.tearDown()
      }
      host = made
      return made
    }

    /// Drops the web view. WebKit ends its content process with it.
    public func tearDown() {
      host?.close()
      host = nil
    }
  }

  // MARK: - The web view

  @MainActor
  final class WebHost: NSObject, WKNavigationDelegate {
    enum Outcome {
      case report(json: String, logs: [String])
      case timeout(logs: [String])
      case crash(message: String, logs: [String])
      case unresponsive
      case failed(String)
    }

    private let webView: WKWebView
    private let schemeHandler: RunnerSchemeHandler
    private let onTerminate: @MainActor () -> Void
    private var loaded: CheckedContinuation<Void, Error>?
    private(set) var isAlive = true
    private var booted = false

    private init(
      webView: WKWebView, schemeHandler: RunnerSchemeHandler,
      onTerminate: @escaping @MainActor () -> Void
    ) {
      self.webView = webView
      self.schemeHandler = schemeHandler
      self.onTerminate = onTerminate
    }

    static func make(
      assets: URL, served: Set<String>, loadTimeoutMs: Int,
      onTerminate: @escaping @MainActor () -> Void
    ) async throws
      -> WebHost
    {
      let configuration = WKWebViewConfiguration()
      configuration.websiteDataStore = .nonPersistent()
      let handler = RunnerSchemeHandler(assets: assets, served: served)
      configuration.setURLSchemeHandler(handler, forURLScheme: PythonRunnerPage.scheme)
      configuration.userContentController.add(try await blockNetwork())
      configuration.preferences.javaScriptCanOpenWindowsAutomatically = false
      // A run in flight is not suspended when the view is off screen or the app goes back.
      configuration.preferences.inactiveSchedulingPolicy = .none
      configuration.defaultWebpagePreferences.allowsContentJavaScript = true

      let webView = WKWebView(frame: CGRect(x: 0, y: 0, width: 1, height: 1), configuration: configuration)
      let host = WebHost(webView: webView, schemeHandler: handler, onTerminate: onTerminate)
      webView.navigationDelegate = host
      try await withCheckedThrowingContinuation { (continuation: CheckedContinuation<Void, Error>) in
        host.loaded = continuation
        webView.load(URLRequest(url: URL(string: PythonRunnerPage.origin + "index.html")!))
        // A web content process that never starts must not hold the run queue for ever.
        Task { @MainActor [weak host] in
          try? await Task.sleep(nanoseconds: UInt64(loadTimeoutMs) * 1_000_000)
          host?.failLoad(WebHostError("The Python runner page did not load."))
        }
      }
      return host
    }

    /// A rule list that blocks every load over the network. The page never needs one: all
    /// it loads comes from `understory-runner://`.
    static func blockNetwork() async throws -> WKContentRuleList {
      let rules = """
        [
          {"trigger":{"url-filter":"^https?:"},"action":{"type":"block"}},
          {"trigger":{"url-filter":"^wss?:"},"action":{"type":"block"}},
          {"trigger":{"url-filter":"^ftp:"},"action":{"type":"block"}}
        ]
        """
      let store = WKContentRuleListStore.default()!
      guard let list = try await store.compileContentRuleList(
        forIdentifier: "understory-runner-offline-v1", encodedContentRuleList: rules)
      else { throw WebHostError("The network rules did not compile.") }
      return list
    }

    func boot(timeoutMs: Int) async throws {
      if booted { return }
      let answer = await call(
        "return await understoryBoot();", arguments: [:], deadlineMs: timeoutMs)
      switch answer {
      case .value: booted = true
      case .error(let message): throw WebHostError(message)
      case .timedOut: throw WebHostError("Python took more than \(timeoutMs / 1000) s to start.")
      }
    }

    func run(_ request: RunRequest, packages: [String], wheels: [String], deadlineMs: Int) async
      -> Outcome
    {
      let answer = await call(
        "return await understoryRun(runId, code, tests, timeoutMs, packages, wheels);",
        arguments: [
          "runId": request.runId, "code": request.code, "tests": request.tests,
          "timeoutMs": request.timeoutMs, "packages": packages, "wheels": wheels,
        ], deadlineMs: deadlineMs)
      switch answer {
      case .timedOut: return .unresponsive
      case .error(let message): return .failed(message)
      case .value(let value):
        struct Answer: Decodable {
          var kind: String
          var report: String?
          var logs: [String]
          var message: String?
        }
        guard let text = value, let data = text.data(using: .utf8),
          let answer = try? JSONDecoder().decode(Answer.self, from: data)
        else { return .failed("The Python runner returned an answer this build cannot read.") }
        let logs = Array(answer.logs.prefix(Limits.maxLogLines))
        switch answer.kind {
        case "report": return .report(json: answer.report ?? "", logs: logs)
        case "timeout": return .timeout(logs: logs)
        default: return .crash(message: answer.message ?? "The Python worker stopped.", logs: logs)
        }
      }
    }

    private typealias Answer = WebCall.Answer

    private func call(_ body: String, arguments: [String: Any], deadlineMs: Int) async -> Answer {
      await WebCall.call(webView, body, arguments: arguments, deadlineMs: deadlineMs)
    }

    func close() {
      isAlive = false
      webView.stopLoading()
      webView.navigationDelegate = nil
      webView.configuration.userContentController.removeAllContentRuleLists()
    }

    func failLoad(_ error: any Error) {
      guard let loaded else { return }
      self.loaded = nil
      isAlive = false
      loaded.resume(throwing: error)
    }

    // MARK: WKNavigationDelegate

    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
      loaded?.resume()
      loaded = nil
    }

    func webView(
      _ webView: WKWebView, didFail navigation: WKNavigation!, withError error: any Error
    ) {
      failLoad(error)
    }

    func webView(
      _ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!,
      withError error: any Error
    ) {
      failLoad(error)
    }

    /// Out of memory or killed by the system: the next run starts again.
    func webViewWebContentProcessDidTerminate(_ webView: WKWebView) {
      failLoad(WebHostError("The Python runner stopped."))
      isAlive = false
      onTerminate()
    }
  }

  struct WebHostError: Error, CustomStringConvertible {
    var description: String
    init(_ description: String) { self.description = description }
  }

  // MARK: - The scheme handler

  /// Serves the page, its scripts, the Python harness, the five Pyodide files and the
  /// pinned wheels, and nothing else. Only main-thread callbacks, as WebKit makes them.
  @MainActor
  final class RunnerSchemeHandler: NSObject, WKURLSchemeHandler {
    private let assets: URL
    /// File names from the pinned manifest. Nothing else in the folder is served.
    private let served: Set<String>

    init(assets: URL, served: Set<String>) {
      self.assets = assets
      self.served = served
    }

    func webView(_ webView: WKWebView, start task: any WKURLSchemeTask) {
      guard let url = task.request.url, url.host() == "runner" else {
        return fail(task, status: 404)
      }
      let path = url.path()
      switch path {
      case "/index.html":
        respond(
          task, Data(PythonRunnerPage.html.utf8), type: "text/html",
          policy: PythonRunnerPage.pagePolicy)
      case "/host.js":
        respond(task, Data(PythonRunnerPage.hostScript.utf8), type: "text/javascript")
      case "/python-worker.js":
        respond(
          task, Data(PythonRunnerPage.workerScript.utf8), type: "text/javascript",
          policy: PythonRunnerPage.workerPolicy)
      case "/python-harness.v1.py":
        guard let harness = JavaScriptRunner.resource("python-harness.v1", "py") else {
          return fail(task, status: 404)
        }
        respond(task, Data(harness.utf8), type: "text/x-python")
      default:
        let name = String(path.dropFirst("/pyodide/".count))
        guard path.hasPrefix("/pyodide/"), served.contains(name),
          let data = try? Data(contentsOf: assets.appending(path: name), options: .alwaysMapped)
        else { return fail(task, status: 404) }
        respond(task, data, type: Self.type(of: name))
      }
    }

    func webView(_ webView: WKWebView, stop task: any WKURLSchemeTask) {}

    private static func type(of name: String) -> String {
      if name.hasSuffix(".wasm") { return "application/wasm" }
      if name.hasSuffix(".zip") || name.hasSuffix(".whl") { return "application/zip" }
      if name.hasSuffix(".json") { return "application/json" }
      return "text/javascript"
    }

    private func respond(
      _ task: any WKURLSchemeTask, _ data: Data, type: String, policy: String? = nil
    ) {
      var headers = [
        "Content-Type": type, "Content-Length": "\(data.count)", "Cache-Control": "no-store",
      ]
      if let policy { headers["Content-Security-Policy"] = policy }
      let response = HTTPURLResponse(
        url: task.request.url!, statusCode: 200, httpVersion: "HTTP/1.1", headerFields: headers)!
      task.didReceive(response)
      task.didReceive(data)
      task.didFinish()
    }

    private func fail(_ task: any WKURLSchemeTask, status: Int) {
      let response = HTTPURLResponse(
        url: task.request.url ?? URL(string: PythonRunnerPage.origin)!, statusCode: status,
        httpVersion: "HTTP/1.1", headerFields: ["Content-Length": "0"])!
      task.didReceive(response)
      task.didReceive(Data())
      task.didFinish()
    }
  }
#endif

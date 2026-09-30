#if canImport(WebKit)
  import Foundation
  import UnderstoryKit
  import WebKit

  /// The playground's live page on the phone: the web's page builder (`CoreKit`) and the
  /// web's probe, drawn by WebKit in a `WKWebView` the app puts on screen, and judged by
  /// the web's `evaluateChecks`. So a check passes here exactly when it passes in the
  /// browser, layout and computed styles included, which the jsdom gate cannot say.
  ///
  /// The walls are the browser frame's (docs/SANDBOX.md, "Playground"), rebuilt with what
  /// WebKit offers an app:
  ///
  ///  - Each page is served by `PlaygroundSchemeHandler` from memory under
  ///    `understory-playground://preview/`, with `Content-Security-Policy: sandbox
  ///    allow-scripts allow-same-origin`: no forms, pop-ups, dialogs or top navigation, as
  ///    `sandbox="allow-scripts"` gives the iframe. Not an opaque origin: WebKit then
  ///    masks every script error as "Script error.", and the learner would lose the
  ///    message and the line. Nothing else lives on that origin, and the data store is
  ///    new per web view, so storage works and is forgotten with the view. The page's
  ///    own `default-src 'none'` policy is in the document, as on the web.
  ///  - A content rule list blocks every http, https, ws and wss load, the data store is
  ///    non-persistent and new per web view, and a navigation away from the page is
  ///    cancelled.
  ///  - The page reports with `postMessage` to its parent, which for a top-level page is
  ///    itself. A user script in its own content world forwards the message to Swift; the
  ///    learner's scripts cannot see that world or its message handler. The message is
  ///    parsed with the web's schema and must carry the current page's nonce. The learner
  ///    can still forge a report from their own script, which only changes their own
  ///    mark ("Integrity").
  ///  - A page that never reports (a script that loops for ever) is abandoned: the web view
  ///    and its content process are replaced, and `onReplace` hands the app the new view.
  ///    The browser cannot do that for a frame; the phone can.
  @MainActor
  public final class PlaygroundPreview: NSObject {
    public enum Outcome: Hashable, Sendable {
      /// The page's first report after it loaded.
      case reported(ProbeReport)
      /// No report in time. The web view has been replaced.
      case unresponsive
      /// The page could not be shown at all.
      case failed(String)
    }

    public static let scheme = "understory-playground"

    /// The view to put on screen. Replaced after a page stopped answering.
    public private(set) var webView: WKWebView
    /// Called with the new view when `webView` is replaced.
    public var onReplace: ((WKWebView) -> Void)?
    /// Called with every report, the first and those the page sends as it changes.
    public var onReport: ((ProbeReport) -> Void)?
    /// The last report of the page on screen.
    public private(set) var report: ProbeReport?

    private let kit: CoreKit
    private let transpiler: @Sendable () throws -> any Transpiler
    private let reactRuntime: @Sendable () throws -> String
    private let handler = PlaygroundSchemeHandler()
    private var rules: WKContentRuleList?
    private var nonce = ""
    /// Reports received for the page on screen, to tell when it has gone quiet.
    private var reports = 0
    private var waiting: CheckedContinuation<Outcome, Never>?
    private var bridge: MessageBridge?

    public init(
      kit: CoreKit? = nil,
      transpiler: (@Sendable () throws -> any Transpiler)? = nil
    ) throws {
      self.kit = try kit ?? CoreKit.shared()
      self.transpiler = transpiler ?? { try SucraseTranspiler.shared() }
      self.reactRuntime = {
        guard let text = PlaygroundPreview.runtimeText else {
          throw CoreKit.Failure.bundleMissing
        }
        return text
      }
      webView = WKWebView(frame: .zero)
      super.init()
      webView = makeWebView()
    }

    /// Read once, on the first React page: 420 KB most lessons never need.
    nonisolated private static let runtimeText: String? = JavaScriptRunner.resource(
      "react-playground.v1", "js")

    /// Builds the page, shows it, and waits for its first report. A new render replaces
    /// the page on screen, as an edit does on the web; a render still waiting resolves as
    /// `failed` then. The wait defaults to `defaultTimeoutMs(for:)`.
    public func render(
      _ files: PlaygroundFiles, checks: [PlaygroundStep.Check], timeoutMs: Int? = nil
    ) async -> Outcome {
      let timeoutMs = timeoutMs ?? Self.defaultTimeoutMs(for: checks)
      if rules == nil {
        rules = try? await WebHost.blockNetwork()
        if let rules { webView.configuration.userContentController.add(rules) }
      }
      guard rules != nil else { return .failed("The preview could not be made safe to show.") }

      let nonce = Self.makeNonce()
      let page: String
      do {
        var react: CoreKit.React?
        if let jsx = files.jsx {
          react = CoreKit.React(
            runtime: try reactRuntime(),
            component: ComponentModule.compile(jsx, with: try transpiler()))
        }
        page = try kit.page(
          files, probe: CoreKit.Probe(nonce: nonce, checks: checks), react: react)
      } catch {
        return .failed("\(error)")
      }

      settle(.failed("A newer version of the page replaced this one."))
      self.nonce = nonce
      report = nil
      handler.show(page, nonce: nonce)
      webView.load(URLRequest(url: URL(string: "\(Self.scheme)://preview/\(nonce).html")!))

      return await withCheckedContinuation { continuation in
        waiting = continuation
        Task { @MainActor [weak self] in
          try? await Task.sleep(nanoseconds: UInt64(timeoutMs) * 1_000_000)
          guard let self, self.nonce == nonce, self.waiting != nil else { return }
          self.replaceWebView()
          self.settle(.unresponsive)
        }
      }
    }

    /// Ten seconds, the content gate's limit, plus two for every click and keystroke the
    /// checks play. WebKit stretches the timers of a page that is not on screen to about a
    /// second, and a React check waits two timer turns after each step, so a page judged
    /// off screen needs the room; on screen it reports in milliseconds.
    public static func defaultTimeoutMs(for checks: [PlaygroundStep.Check]) -> Int {
      let steps = checks.flatMap { $0.actions ?? [] }.reduce(0) { total, action in
        switch action {
        case .click: total + 1
        case .type(let text, _): total + text.count
        }
      }
      return 10_000 + 2_000 * steps
    }

    /// The checklist and the grade for the page on screen, or nil before it reported.
    public func verdict(for checks: [PlaygroundStep.Check]) -> PlaygroundVerdict? {
      guard let report else { return nil }
      return try? kit.judge(checks, facts: report.facts)
    }

    /// Waits until the page has stopped changing: no new report for `quietMs` (the frame
    /// reports 120 ms after a change), or `limitMs` in all. A script that answers from a
    /// timer after load changes the page after its first report, and the web judges what
    /// the page shows when the learner presses Check, not what it showed at load.
    public func settled(quietMs: Int = 300, limitMs: Int = 3_000) async -> ProbeReport? {
      var waited = 0
      var seen = reports
      while waited < limitMs {
        try? await Task.sleep(nanoseconds: UInt64(quietMs) * 1_000_000)
        waited += quietMs
        if reports == seen { break }
        seen = reports
      }
      return report
    }

    /// Renders, lets the page settle, and judges, for grading a page the learner has not
    /// looked at: a practice item, or the content check in the tests. Nil when the page
    /// never reported, which is no grade at all.
    public func judge(_ files: PlaygroundFiles, checks: [PlaygroundStep.Check]) async
      -> PlaygroundVerdict?
    {
      guard case .reported = await render(files, checks: checks),
        let report = await settled()
      else { return nil }
      return try? kit.judge(checks, facts: report.facts)
    }

    // MARK: Plumbing

    private static func makeNonce() -> String {
      String(UUID().uuidString.replacingOccurrences(of: "-", with: "").prefix(24))
    }

    private func settle(_ outcome: Outcome) {
      guard let waiting else { return }
      self.waiting = nil
      waiting.resume(returning: outcome)
    }

    fileprivate func receive(_ body: Any) {
      guard let text = body as? String, let report = kit.report(fromMessage: text, nonce: nonce)
      else { return }
      self.report = report
      reports += 1
      onReport?(report)
      settle(.reported(report))
    }

    private func replaceWebView() {
      let old = webView
      old.stopLoading()
      old.navigationDelegate = nil
      old.configuration.userContentController.removeAllScriptMessageHandlers()
      old.removeFromSuperview()
      webView = makeWebView()
      if let rules { webView.configuration.userContentController.add(rules) }
      onReplace?(webView)
    }

    private static let world = WKContentWorld.world(name: "understory-playground")

    /// The forwarder, in a world of its own. It sends the message on as JSON text, so
    /// nothing but plain data crosses into Swift. The viewport line makes the page as
    /// wide as the view, as the iframe is; it carries `data-understory`, so the probe
    /// leaves it out of checks and the tree.
    private static let forwarder = """
      window.addEventListener('message', function (event) {
        try {
          window.webkit.messageHandlers.understoryPlayground.postMessage(JSON.stringify(event.data));
        } catch (ignored) {}
      });
      """

    private static let viewport = """
      (function () {
        if (!document.head || document.querySelector('meta[name="viewport"]')) return;
        var meta = document.createElement('meta');
        meta.setAttribute('data-understory', '');
        meta.name = 'viewport';
        meta.content = 'width=device-width, initial-scale=1';
        document.head.appendChild(meta);
      })();
      """

    private func makeWebView() -> WKWebView {
      let configuration = WKWebViewConfiguration()
      // Its own store, so a new view gets a new content process, never a stuck one.
      configuration.websiteDataStore = .nonPersistent()
      configuration.setURLSchemeHandler(handler, forURLScheme: Self.scheme)
      configuration.preferences.javaScriptCanOpenWindowsAutomatically = false
      // A check waits two timer turns after every click and keystroke for React to commit.
      // A view that is off screen (grading without showing, or the app in the background)
      // would have those timers stretched further and further, until a check with
      // typing takes minutes. The page is small and short-lived, so it is never throttled.
      configuration.preferences.inactiveSchedulingPolicy = .none
      configuration.defaultWebpagePreferences.allowsContentJavaScript = true
      let bridge = MessageBridge(owner: self)
      self.bridge = bridge
      let content = configuration.userContentController
      content.add(bridge, contentWorld: Self.world, name: "understoryPlayground")
      content.addUserScript(
        WKUserScript(
          source: Self.forwarder, injectionTime: .atDocumentStart, forMainFrameOnly: true,
          in: Self.world))
      content.addUserScript(
        WKUserScript(
          source: Self.viewport, injectionTime: .atDocumentEnd, forMainFrameOnly: true,
          in: Self.world))
      let view = WKWebView(frame: .zero, configuration: configuration)
      view.navigationDelegate = self
      #if canImport(UIKit)
        view.accessibilityLabel = "Preview"
      #else
        view.setAccessibilityLabel("Preview")
      #endif
      return view
    }
  }

  extension PlaygroundPreview: WKNavigationDelegate {
    /// The page stays the page: links and forms are stopped inside it already, and
    /// anything that still tries to leave is cancelled here. Frames the learner writes
    /// (`srcdoc`, `about:blank`) may load.
    public func webView(
      _ webView: WKWebView, decidePolicyFor navigationAction: WKNavigationAction,
      decisionHandler: @escaping @MainActor (WKNavigationActionPolicy) -> Void
    ) {
      let url = navigationAction.request.url
      let isPage = url?.scheme == Self.scheme && url?.lastPathComponent == "\(nonce).html"
      let isFrame = navigationAction.targetFrame?.isMainFrame == false && url?.scheme == "about"
      decisionHandler(isPage || isFrame ? .allow : .cancel)
    }

    public func webViewWebContentProcessDidTerminate(_ webView: WKWebView) {
      guard webView === self.webView else { return }
      replaceWebView()
      settle(.failed("The preview stopped."))
    }
  }

  /// Holds the preview weakly: the content controller keeps its handlers for ever.
  @MainActor
  private final class MessageBridge: NSObject, WKScriptMessageHandler {
    weak var owner: PlaygroundPreview?
    init(owner: PlaygroundPreview) { self.owner = owner }

    func userContentController(
      _ userContentController: WKUserContentController, didReceive message: WKScriptMessage
    ) {
      owner?.receive(message.body)
    }
  }

  /// Serves the one page on screen, from memory, with the sandbox header. Anything else is
  /// a 404: the page fetches nothing.
  @MainActor
  final class PlaygroundSchemeHandler: NSObject, WKURLSchemeHandler {
    private var page: (nonce: String, html: Data)?

    func show(_ html: String, nonce: String) {
      page = (nonce, Data(html.utf8))
    }

    func webView(_ webView: WKWebView, start task: any WKURLSchemeTask) {
      guard let url = task.request.url, url.host() == "preview", let page,
        url.path() == "/\(page.nonce).html"
      else {
        let response = HTTPURLResponse(
          url: task.request.url ?? URL(string: "\(PlaygroundPreview.scheme)://preview/")!,
          statusCode: 404, httpVersion: "HTTP/1.1", headerFields: ["Content-Length": "0"])!
        task.didReceive(response)
        task.didReceive(Data())
        task.didFinish()
        return
      }
      let response = HTTPURLResponse(
        url: url, statusCode: 200, httpVersion: "HTTP/1.1",
        headerFields: [
          "Content-Type": "text/html; charset=utf-8",
          "Content-Length": "\(page.html.count)",
          "Cache-Control": "no-store",
          "Content-Security-Policy": "sandbox allow-scripts allow-same-origin",
        ])!
      task.didReceive(response)
      task.didReceive(page.html)
      task.didFinish()
    }

    func webView(_ webView: WKWebView, stop task: any WKURLSchemeTask) {}
  }
#endif

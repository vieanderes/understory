#if canImport(WebKit)
  import Foundation
  import WebKit

  /// One call into a hidden web view's page with a deadline. `callAsyncJavaScript` has no
  /// cancel, so the deadline races it and the first to settle wins; a page that stopped
  /// answering is then the caller's to drop.
  @MainActor
  enum WebCall {
    enum Answer {
      case value(String?)
      case error(String)
      case timedOut
    }

    static func call(
      _ webView: WKWebView, _ body: String, arguments: [String: Any], deadlineMs: Int
    ) async -> Answer {
      await withCheckedContinuation { (continuation: CheckedContinuation<Answer, Never>) in
        let once = Once(continuation)
        let deadline = Task { @MainActor in
          try? await Task.sleep(nanoseconds: UInt64(deadlineMs) * 1_000_000)
          once.resume(.timedOut)
        }
        webView.callAsyncJavaScript(body, arguments: arguments, in: nil, in: .page) { result in
          deadline.cancel()
          switch result {
          case .success(let value): once.resume(.value(value as? String))
          case .failure(let error): once.resume(.error(message(of: error)))
          }
        }
      }
    }

    static func message(of error: Error) -> String {
      let info = (error as NSError).userInfo
      return (info["WKJavaScriptExceptionMessage"] as? String) ?? error.localizedDescription
    }

    private final class Once {
      private var continuation: CheckedContinuation<Answer, Never>?
      init(_ continuation: CheckedContinuation<Answer, Never>) { self.continuation = continuation }
      func resume(_ answer: Answer) {
        continuation?.resume(returning: answer)
        continuation = nil
      }
    }
  }
#endif

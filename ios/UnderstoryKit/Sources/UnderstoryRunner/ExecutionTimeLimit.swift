import Foundation
import JavaScriptCore

/// JavaScriptCore's watchdog, the only thing that stops a loop that never ends.
///
/// What is actually there, checked against Xcode 26.2:
///
///  - `JSContextGroupSetExecutionTimeLimit` and `JSContextGroupClearExecutionTimeLimit`
///    are exported by the JavaScriptCore binary on macOS and on iOS, but they are
///    declared in no public header of either SDK. They are therefore private API:
///    reachable only through `dlsym`, and not safe to ship to the App Store.
///  - The Objective-C API (`JSContext`, `JSVirtualMachine`) has no equivalent. There is
///    no supported way to interrupt running JavaScript in a `JSContext`.
///
/// So this type resolves the symbols at run time and uses them when they are there, which
/// makes the Swift tests able to prove that an endless loop really is stopped, and the
/// shipping decision is recorded in docs/ios/PLAN.md, decision D8: learner code that may
/// loop for ever runs in a `WKWebView`, which has its own supported watchdog, and
/// JavaScriptCore stays for work the app itself controls.
///
/// Set `UNDERSTORY_JSC_TIME_LIMIT=0` in the environment to switch it off and see what a
/// host-side deadline alone can do.
final class ExecutionTimeLimit {
  private typealias ShouldTerminate = @convention(c) (JSContextRef?, UnsafeMutableRawPointer?)
    -> Bool
  private typealias SetLimit = @convention(c) (
    JSContextGroupRef?, Double, ShouldTerminate?, UnsafeMutableRawPointer?
  ) -> Void
  private typealias ClearLimit = @convention(c) (JSContextGroupRef?) -> Void

  /// A class so that its address can travel through the C callback's `void *`.
  private final class Flag {
    var fired = false
  }

  private static let setLimit: SetLimit? = symbol(
    "JSContextGroupSetExecutionTimeLimit", as: SetLimit.self)
  private static let clearLimit: ClearLimit? = symbol(
    "JSContextGroupClearExecutionTimeLimit", as: ClearLimit.self)

  private static func symbol<T>(_ name: String, as: T.Type) -> T? {
    // RTLD_DEFAULT: the already-loaded JavaScriptCore image.
    guard let pointer = dlsym(UnsafeMutableRawPointer(bitPattern: -2), name) else { return nil }
    return unsafeBitCast(pointer, to: T.self)
  }

  /// True when both symbols resolved in this process.
  static var isSupported: Bool { setLimit != nil && clearLimit != nil }

  /// True when the watchdog will be armed. Off when the symbols are missing or when
  /// `UNDERSTORY_JSC_TIME_LIMIT` is set to `0`.
  static var isEnabled: Bool {
    guard isSupported else { return false }
    return ProcessInfo.processInfo.environment["UNDERSTORY_JSC_TIME_LIMIT"] != "0"
  }

  private let group: JSContextGroupRef?
  private let flag = Flag()
  private var armed = false

  /// Arms the watchdog on the context's group. `seconds` is the whole run's budget.
  init(context: JSContext, seconds: Double) {
    group = JSContextGetGroup(context.jsGlobalContextRef)
    guard Self.isEnabled, let setLimit = Self.setLimit, let group else { return }
    let callback: ShouldTerminate = { _, pointer in
      guard let pointer else { return true }
      Unmanaged<Flag>.fromOpaque(pointer).takeUnretainedValue().fired = true
      return true  // yes, terminate
    }
    setLimit(group, seconds, callback, Unmanaged.passUnretained(flag).toOpaque())
    armed = true
  }

  /// True when the watchdog was armed for this context.
  var isArmed: Bool { armed }

  /// True once the watchdog has terminated a run in this group.
  var didFire: Bool { flag.fired }

  /// Sets a new budget, measured from the next entry into the VM. The event loop calls it
  /// before each timer callback so that a run's callbacks share one budget.
  func rearm(seconds: Double) {
    guard armed, let setLimit = Self.setLimit, let group else { return }
    let callback: ShouldTerminate = { _, pointer in
      guard let pointer else { return true }
      Unmanaged<Flag>.fromOpaque(pointer).takeUnretainedValue().fired = true
      return true
    }
    setLimit(group, max(seconds, 0.001), callback, Unmanaged.passUnretained(flag).toOpaque())
  }

  func clear() {
    guard armed, let clearLimit = Self.clearLimit, let group else { return }
    clearLimit(group)
    armed = false
  }
}

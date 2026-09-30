import Foundation

/// Where the web repo's files are, resolved from this source file rather than from the
/// working directory, so `swift test` finds them from anywhere. A checkout without the
/// built content bundle is normal (it is generated, not committed), so every test that
/// needs one skips with a message instead of failing.
enum RepoPaths {
  /// `<repo>/ios/UnderstoryKit/Tests/UnderstoryKitTests/RepoPaths.swift` is four levels
  /// below `ios/`, which is one below the repo root.
  static let root: URL = URL(fileURLWithPath: #filePath)
    .deletingLastPathComponent()  // UnderstoryKitTests
    .deletingLastPathComponent()  // Tests
    .deletingLastPathComponent()  // UnderstoryKit
    .deletingLastPathComponent()  // ios
    .deletingLastPathComponent()  // repo root

  static let contentBundle = root.appending(path: "public/content/v1")
  static let fixtures = root.appending(path: "contracts/fixtures")
  static let schemas = root.appending(path: "contracts/schemas")
  static let harness = root.appending(path: "public/sandbox/harness.v1.js")

  static func exists(_ url: URL) -> Bool { FileManager.default.fileExists(atPath: url.path) }

  static let missingBundle = """
    public/content/v1 is not in this checkout. It is built, not committed. \
    Run: pnpm exec tsx scripts/build-content.ts
    """

  static func jsonFiles(in directory: URL) -> [URL] {
    let contents =
      (try? FileManager.default.contentsOfDirectory(
        at: directory, includingPropertiesForKeys: nil)) ?? []
    return contents.filter { $0.pathExtension == "json" }.sorted { $0.path < $1.path }
  }
}

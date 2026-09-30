import Foundation

/// PGlite's three data files, pinned by size and SHA-256 in `pglite.v1.json`, written by
/// `Scripts/build-resources.ts` from the `@electric-sql/pglite` package the web installs.
/// The worker that loads them, `sql-engine.v1.js`, ships in the bundle; these do not.
public struct PGliteManifest: Codable, Sendable, Hashable {
  public var version: String
  public var files: [String: PyodideManifest.File]

  public init(version: String, files: [String: PyodideManifest.File]) {
    self.version = version
    self.files = files
  }

  public static func bundled() throws -> PGliteManifest {
    guard let url = Bundle.module.url(forResource: "pglite.v1", withExtension: "json") else {
      throw PGliteAssetStore.Failure.manifestMissing
    }
    return try JSONDecoder().decode(PGliteManifest.self, from: Data(contentsOf: url))
  }

  /// 16.8 MB: the Postgres binary, its share directory and initdb.
  public var totalBytes: Int { files.values.reduce(0) { $0 + $1.bytes } }
}

/// Keeps PGlite on disk, downloading it once on the first sql step, as the web does.
///
/// Why not in the app bundle: 16.8 MB raw, about 5.4 MB compressed, for every install,
/// while only the database lessons need it. Every file is checked against its pinned size
/// and SHA-256 before use, once per process; a download reaches its final name only once
/// it matches. The folder is excluded from backup.
public actor PGliteAssetStore {
  public enum Failure: Error, CustomStringConvertible, Equatable {
    case manifestMissing
    case download(file: String, reason: String)
    case integrity(file: String, expected: String, actual: String)

    public var description: String {
      switch self {
      case .manifestMissing:
        "pglite.v1.json is not in the bundle. Run ios/UnderstoryKit/Scripts/sync-resources.sh."
      case .download(let file, let reason): "The database could not be loaded (\(file): \(reason))."
      case .integrity(let file, _, _):
        "The database could not be loaded (\(file) did not match its checksum)."
      }
    }
  }

  public nonisolated let manifest: PGliteManifest
  public nonisolated let directory: URL
  /// A folder holding the three files: the web app's `/sql/<version>/`, or a local folder.
  public nonisolated let source: URL

  private let session: URLSession
  private var verified = false

  public init(
    source: URL, directory: URL? = nil, manifest: PGliteManifest? = nil,
    session: URLSession = .shared
  ) throws {
    let manifest = try manifest ?? PGliteManifest.bundled()
    self.manifest = manifest
    self.source = source.hasDirectoryPath ? source : source.appendingPathComponent("", isDirectory: true)
    self.directory = try directory ?? Self.defaultDirectory(version: manifest.version)
    self.session = session
  }

  /// The folder the web app serves the same files from (scripts/build-sql.ts).
  public static func webAppSource(origin: URL, version: String) -> URL {
    origin.appending(path: "sql/\(version)/", directoryHint: .isDirectory)
  }

  /// Application Support/Understory/pglite/<version>/.
  public static func defaultDirectory(version: String) throws -> URL {
    try FileManager.default.url(
      for: .applicationSupportDirectory, in: .userDomainMask, appropriateFor: nil, create: true
    )
    .appending(path: "Understory/pglite/\(version)", directoryHint: .isDirectory)
  }

  public var isReady: Bool { verified }

  @discardableResult
  public func ensure() async throws -> URL {
    if verified { return directory }
    try PinnedFiles.prepare(directory)
    for (name, pinned) in manifest.files.sorted(by: { $0.key < $1.key }) {
      do {
        try await PinnedFiles.ensure(
          name, bytes: pinned.bytes, sha256: pinned.sha256, in: directory, from: source,
          session: session)
      } catch PinnedFiles.Problem.download(let reason) {
        throw Failure.download(file: name, reason: reason)
      } catch PinnedFiles.Problem.integrity(let expected, let actual) {
        throw Failure.integrity(file: name, expected: expected, actual: actual)
      }
    }
    verified = true
    return directory
  }
}

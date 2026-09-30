import CryptoKit
import Foundation

/// The five Pyodide files a Python run needs, and the wheels of numpy, pandas and pydantic,
/// pinned by size and SHA-256.
///
/// `pyodide.v1.json` is written by `Scripts/build-resources.ts` from the `pyodide` package
/// the web installs (an exact version in package.json) and the wheels its lock file pins,
/// so the phone runs the bytes the browser and the Node gate run.
public struct PyodideManifest: Codable, Sendable, Hashable {
  public struct File: Codable, Sendable, Hashable {
    public var bytes: Int
    public var sha256: String

    public init(bytes: Int, sha256: String) {
      self.bytes = bytes
      self.sha256 = sha256
    }
  }

  public var version: String
  public var files: [String: File]
  /// Per package, the wheels it needs, dependencies first, as the lock file orders them.
  public var packages: [String: [String]]
  /// Every wheel any package needs.
  public var wheels: [String: File]

  public init(
    version: String, files: [String: File], packages: [String: [String]] = [:],
    wheels: [String: File] = [:]
  ) {
    self.version = version
    self.files = files
    self.packages = packages
    self.wheels = wheels
  }

  private enum CodingKeys: String, CodingKey { case version, files, packages, wheels }

  public init(from decoder: any Decoder) throws {
    let container = try decoder.container(keyedBy: CodingKeys.self)
    version = try container.decode(String.self, forKey: .version)
    files = try container.decode([String: File].self, forKey: .files)
    packages = try container.decodeIfPresent([String: [String]].self, forKey: .packages) ?? [:]
    wheels = try container.decodeIfPresent([String: File].self, forKey: .wheels) ?? [:]
  }

  /// The wheels the packages need, each once, in an order that loads dependencies first.
  /// Throws for a package the manifest does not pin.
  public func wheelFiles(for packages: [String]) throws -> [String] {
    var ordered: [String] = []
    for name in packages {
      guard let files = self.packages[name] else {
        throw PyodideAssetStore.Failure.unknownPackage(name)
      }
      for file in files where !ordered.contains(file) { ordered.append(file) }
    }
    return ordered
  }

  /// numpy 2.9 MB, pandas with its dependencies 9.0 MB, pydantic 1.8 MB.
  public func packageBytes(for packages: [String]) throws -> Int {
    try wheelFiles(for: packages).reduce(0) { $0 + (wheels[$1]?.bytes ?? 0) }
  }

  public static func bundled() throws -> PyodideManifest {
    guard let url = Bundle.module.url(forResource: "pyodide.v1", withExtension: "json") else {
      throw PyodideAssetStore.Failure.manifestMissing
    }
    return try JSONDecoder().decode(PyodideManifest.self, from: Data(contentsOf: url))
  }

  /// 13.2 MB: too much to add to every install for a language most learners never run.
  public var totalBytes: Int { files.values.reduce(0) { $0 + $1.bytes } }
}

/// Keeps Pyodide on disk, downloading it once on the first Python run.
///
/// Why not in the app bundle: 13.2 MB raw (the wasm alone is 10.1 MB), about 5.7 MB
/// compressed, for every install, while most learners never run Python. The web makes the
/// same trade: the files are fetched on the first Python run and never precached.
///
/// Every file is checked against the pinned size and SHA-256 before it is used, the first
/// time per process, and a download is written to its final place only once it matches.
/// A file that fails the check is fetched again; a source that serves other bytes is
/// refused. The folder is excluded from backup, because it can always be fetched again.
public actor PyodideAssetStore {
  public enum Failure: Error, CustomStringConvertible, Equatable {
    case manifestMissing
    case unknownPackage(String)
    case download(file: String, reason: String)
    case integrity(file: String, expected: String, actual: String)

    public var description: String {
      switch self {
      case .manifestMissing:
        "pyodide.v1.json is not in the bundle. Run ios/UnderstoryKit/Scripts/sync-resources.sh."
      case .unknownPackage(let name): "The app does not have the Python package \(name)."
      case .download(let file, let reason): "Python could not be loaded (\(file): \(reason))."
      case .integrity(let file, _, _):
        "Python could not be loaded (\(file) did not match its checksum)."
      }
    }
  }

  public nonisolated let manifest: PyodideManifest
  /// Where the files live once fetched.
  public nonisolated let directory: URL
  /// A folder holding the five files: the app's origin (`/pyodide/<version>/` on the web
  /// app), a CDN serving the same release, or a local folder.
  public nonisolated let source: URL

  private let session: URLSession
  private var verified = false

  public init(
    source: URL, directory: URL? = nil, manifest: PyodideManifest? = nil,
    session: URLSession = .shared
  ) throws {
    let manifest = try manifest ?? PyodideManifest.bundled()
    self.manifest = manifest
    self.source = source.hasDirectoryPath ? source : source.appendingPathComponent("", isDirectory: true)
    self.directory = try directory ?? Self.defaultDirectory(version: manifest.version)
    self.session = session
  }

  /// The folder the web app serves the same files from (src/adapters/pyodide/assets.ts),
  /// for an app that fetches from its own origin. jsDelivr's
  /// `https://cdn.jsdelivr.net/pyodide/v<version>/full/` served the same bytes when checked
  /// (September 2026); the checksums decide either way.
  public static func webAppSource(origin: URL, version: String) -> URL {
    origin.appending(path: "pyodide/\(version)/", directoryHint: .isDirectory)
  }

  /// Application Support/Understory/pyodide/<version>/. A new version gets a new folder.
  public static func defaultDirectory(version: String) throws -> URL {
    try FileManager.default.url(
      for: .applicationSupportDirectory, in: .userDomainMask, appropriateFor: nil, create: true
    )
    .appending(path: "Understory/pyodide/\(version)", directoryHint: .isDirectory)
  }

  /// True once every start file is on disk and has matched its checksum in this process.
  public var isReady: Bool { verified }

  private var verifiedWheels = Set<String>()

  /// True once every wheel the packages need has matched its checksum in this process.
  public func hasPackages(_ packages: [String]) -> Bool {
    guard let files = try? manifest.wheelFiles(for: packages) else { return false }
    return files.allSatisfy(verifiedWheels.contains)
  }

  /// Makes sure every start file, and every wheel the packages need, is present and
  /// intact, fetching what is missing or damaged. Wheels are fetched only for the packages
  /// asked for, on the first run that imports one, as on the web. Returns the folder.
  @discardableResult
  public func ensure(packages: [String] = []) async throws -> URL {
    let wheels = try manifest.wheelFiles(for: packages)
    if verified && wheels.allSatisfy(verifiedWheels.contains) { return directory }
    try PinnedFiles.prepare(directory)

    if !verified {
      for (name, pinned) in manifest.files.sorted(by: { $0.key < $1.key }) {
        try await ensureFile(name, pinned)
      }
      verified = true
    }
    for name in wheels where !verifiedWheels.contains(name) {
      guard let pinned = manifest.wheels[name] else { throw Failure.unknownPackage(name) }
      try await ensureFile(name, pinned)
      verifiedWheels.insert(name)
    }
    return directory
  }

  private func ensureFile(_ name: String, _ pinned: PyodideManifest.File) async throws {
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
}

/// A file on disk that must have exactly the pinned bytes: fetched (or copied) to a
/// temporary name next to its target, checked for size and SHA-256, and only then moved
/// into place. Shared by the Pyodide and PGlite stores.
enum PinnedFiles {
  enum Problem: Error {
    case download(String)
    case integrity(expected: String, actual: String)
  }

  static func ensure(
    _ name: String, bytes: Int, sha256: String, in directory: URL, from source: URL,
    session: URLSession
  ) async throws {
    let files = FileManager.default
    let target = directory.appending(path: name)
    if (try? check(target, bytes: bytes, sha256: sha256)) != nil { return }
    let fetched = try await fetch(name, from: source, into: directory, session: session)
    defer { try? files.removeItem(at: fetched) }
    try check(fetched, bytes: bytes, sha256: sha256)
    _ = try? files.removeItem(at: target)
    try files.moveItem(at: fetched, to: target)
  }

  /// Marks a folder that can always be fetched again as not worth a backup.
  static func prepare(_ directory: URL) throws {
    try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
    var folder = directory
    var values = URLResourceValues()
    values.isExcludedFromBackup = true
    try? folder.setResourceValues(values)
  }

  private static func fetch(
    _ name: String, from source: URL, into directory: URL, session: URLSession
  ) async throws -> URL {
    let from = source.appending(path: name)
    let temporary = directory.appending(path: ".\(name).\(UUID().uuidString).part")
    do {
      if from.isFileURL {
        try FileManager.default.copyItem(at: from, to: temporary)
      } else {
        let (downloaded, response) = try await session.download(from: from)
        if let http = response as? HTTPURLResponse, !(200..<300).contains(http.statusCode) {
          try? FileManager.default.removeItem(at: downloaded)
          throw Problem.download("HTTP \(http.statusCode)")
        }
        try FileManager.default.moveItem(at: downloaded, to: temporary)
      }
    } catch let problem as Problem {
      throw problem
    } catch {
      throw Problem.download(error.localizedDescription)
    }
    return temporary
  }

  private static func check(_ url: URL, bytes: Int, sha256: String) throws {
    let data = try Data(contentsOf: url, options: .alwaysMapped)
    guard data.count == bytes else {
      throw Problem.integrity(expected: "\(bytes) bytes", actual: "\(data.count) bytes")
    }
    let digest = SHA256.hash(data: data).map { String(format: "%02x", $0) }.joined()
    guard digest == sha256 else { throw Problem.integrity(expected: sha256, actual: digest) }
  }
}

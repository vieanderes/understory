// swift-tools-version: 6.0
import PackageDescription

// Two libraries, no third-party dependencies.
//  - UnderstoryKit: the domain (content models, the event log reducer, the learning rules,
//    the forgetting curve). Foundation only, so it can be linked into the app, a widget
//    extension and an App Intents extension alike.
//  - UnderstoryRunner: learner code execution on JavaScriptCore with the shared harness.
//    Kept apart so that extensions which never run code do not link JavaScriptCore.
let package = Package(
  name: "UnderstoryKit",
  platforms: [.iOS(.v17), .macOS(.v14)],
  products: [
    .library(name: "UnderstoryKit", targets: ["UnderstoryKit"]),
    .library(name: "UnderstoryRunner", targets: ["UnderstoryRunner"]),
  ],
  targets: [
    .target(
      name: "UnderstoryKit",
      swiftSettings: [.swiftLanguageMode(.v6)]
    ),
    .target(
      name: "UnderstoryRunner",
      dependencies: ["UnderstoryKit"],
      // Written from the web repo by Scripts/sync-resources.sh (Scripts/build-resources.ts
      // lists the sources). Pyodide, its wheels and PGlite's wasm are downloaded once, not
      // embedded.
      resources: [
        .copy("Resources/harness.v1.js"),
        .copy("Resources/react-runtime.v1.js"),
        .copy("Resources/sucrase.v1.js"),
        .copy("Resources/python-harness.v1.py"),
        .copy("Resources/pyodide.v1.json"),
        .copy("Resources/react-playground.v1.js"),
        .copy("Resources/core-kit.v1.js"),
        .copy("Resources/sql-host.v1.js"),
        .copy("Resources/sql-engine.v1.js"),
        .copy("Resources/pglite.v1.json"),
      ],
      swiftSettings: [.swiftLanguageMode(.v6)]
    ),
    .testTarget(
      name: "UnderstoryKitTests",
      dependencies: ["UnderstoryKit"],
      swiftSettings: [.swiftLanguageMode(.v6)]
    ),
    .testTarget(
      name: "UnderstoryRunnerTests",
      dependencies: ["UnderstoryRunner", "UnderstoryKit"],
      swiftSettings: [.swiftLanguageMode(.v6)]
    ),
  ]
)

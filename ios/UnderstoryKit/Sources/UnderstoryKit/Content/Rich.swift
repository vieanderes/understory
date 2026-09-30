import Foundation

/// The version of the bundle layout under `/content/v1/`. A breaking change ships as
/// `/content/v2/` beside it (docs/ios/CONTRACT.md).
public let bundleSchema = 1

/// Markdown compiled at build time. iOS renders `md`, a CommonMark subset with no raw HTML,
/// through `AttributedString`. `html` is for the web client and is carried so that a
/// decoded lesson encodes back to the same JSON.
public struct Rich: Codable, Hashable, Sendable {
  public var md: String
  public var html: String

  public init(md: String, html: String = "") {
    self.md = md
    self.html = html
  }
}

public enum Language: String, Codable, Sendable, CaseIterable {
  case js, ts, jsx, tsx, html, css, sql, json, bash, yaml, http, python, text
}

public struct Choice: Codable, Hashable, Sendable {
  public var text: Rich
  /// Present and true on the right choice only. Omitted otherwise, never `false` or null.
  public var correct: Bool?
  public var feedback: Rich

  public var isCorrect: Bool { correct ?? false }
}

public struct Reference: Codable, Hashable, Sendable {
  public enum Kind: String, Codable, Sendable {
    case paper, spec, rfc, book, essay, docs, talk, source
  }

  public var kind: Kind
  public var title: String
  public var authors: String?
  public var year: Int?
  public var venue: String?
  public var url: URL?
  public var note: String?
  public var primary: Bool?
  public var verified: Bool
}

public struct RecallCard: Codable, Hashable, Sendable, Identifiable {
  public var id: String
  public var concept: String
  public var front: Rich
  public var back: Rich
}

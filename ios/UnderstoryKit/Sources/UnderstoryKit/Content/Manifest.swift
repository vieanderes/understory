import Foundation

public struct Concept: Codable, Hashable, Sendable, Identifiable {
  public var id: String
  public var title: String
  public var summary: String
  public var confusableWith: [String]?
}

public struct ManifestLesson: Codable, Hashable, Sendable, Identifiable {
  public var id: String
  public var slug: String
  public var title: String
  public var objective: String
  public var level: LessonLevel
  public var minutes: Int
  public var concepts: [String]
  public var prerequisites: [String]
  public var stepCount: Int
  /// Distinct step types, sorted. Strings, so a newer type does not fail the manifest.
  public var stepTypes: [String]
  public var needsTyping: Bool
  /// A timed assessment, listed with the other mock tests.
  public var assessment: Bool?
  /// Path relative to the bundle root: `lessons/js.closures.0123456789ab.json`.
  public var file: String
  public var solutionsFile: String?
}

public struct ManifestModule: Codable, Hashable, Sendable, Identifiable {
  public var id: String
  public var number: Int
  public var slug: String
  public var title: String
  public var summary: String
  public var why: String
  public var youCanBuild: String
  public var lab: String?
  public var concepts: [Concept]
  public var lessons: [ManifestLesson]
}

/// A small project that uses the skills of one part.
public struct Capstone: Codable, Hashable, Sendable {
  public var title: String
  public var brief: String
}

/// A stretch of the journey with a checkpoint and a capstone at its end. `lessons` and
/// `concepts` are the published ones, in journey order: a woven lesson counts towards the
/// part of the lesson it follows.
public struct ManifestPart: Codable, Hashable, Sendable, Identifiable {
  /// One lowercase word, never a module id: capstone and test-out events name a part in
  /// their `moduleId` field.
  public var id: String
  public var title: String
  /// One sentence: what the learner can do after this part.
  public var summary: String
  /// Module ids in course order. Woven modules are in no part.
  public var modules: [String]
  public var capstone: Capstone
  public var lessons: [String]
  public var concepts: [String]
}

/// The one course. Its modules sit beside it in the manifest.
public struct ManifestCourse: Codable, Hashable, Sendable {
  public var title: String
  public var summary: String
}

/// `manifest.json`. Short-cached. The only file a client has to re-fetch to learn what
/// changed: every other path in the bundle carries a content hash.
public struct Manifest: Codable, Hashable, Sendable {
  public var schema: Int
  /// Changes when any lesson changes. Progress events carry it.
  public var contentRev: String
  public var course: ManifestCourse
  /// In course order.
  public var modules: [ManifestModule]
  /// In course order. Empty for a course with no parts.
  public var parts: [ManifestPart]

  public var lessons: [ManifestLesson] {
    modules.flatMap(\.lessons)
  }
}

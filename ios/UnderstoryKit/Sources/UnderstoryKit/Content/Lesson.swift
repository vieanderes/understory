import Foundation

public enum LessonLevel: String, Codable, Sendable { case essential, advanced }

public struct Opening: Codable, Hashable, Sendable {
  public var text: String
}

/// `lessons/<id>.<hash>.json`. Immutable once published: a changed lesson gets a new hash.
public struct CompiledLesson: Codable, Hashable, Sendable, Identifiable {
  public var schema: Int
  public var id: String
  public var moduleId: String
  public var moduleSlug: String
  public var slug: String
  public var title: String
  public var objective: String
  public var level: LessonLevel
  public var minutes: Int
  /// A timed assessment: `minutes` is its time limit.
  public var assessment: Bool?
  public var concepts: [String]
  public var prerequisites: [String]
  public var opening: Opening
  public var steps: [CompiledStep]
  /// Three lines on what the learner can now do, for the summary screen.
  public var recap: [Rich]?
  public var recall: [RecallCard]
  public var references: [Reference]
  public var deepDive: Rich?

  /// The steps this build can show, with labs and incidents replaced by their fallbacks.
  public var playableSteps: [CompiledStep] { steps.compactMap(\.portable) }

  /// The path of the lesson on the web, and so the universal link into the app.
  public var webPath: String { "/learn/\(moduleSlug)/\(slug)" }
}

/// `solutions/<lessonId>.<hash>.json`. Fetched only when the learner asks for a solution.
public struct CompiledSolutions: Codable, Hashable, Sendable {
  public var schema: Int
  public var lessonId: String
  /// Step id to reference solution source.
  public var solutions: [String: String]
}

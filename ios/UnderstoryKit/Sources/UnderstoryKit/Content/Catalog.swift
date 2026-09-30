import Foundation

/// `catalog.json`: the whole course as an index with no lesson text. Practice, the map and
/// Today need every concept, every scored step and every recall card to choose what comes
/// next, but only load the lessons they show.
public struct CatalogFile: Codable, Hashable, Sendable {
  public struct Module: Codable, Hashable, Sendable, Identifiable {
    public var id: String
    public var number: Int
    public var slug: String
    public var title: String
  }

  public struct Concept: Codable, Hashable, Sendable, Identifiable {
    public var id: String
    public var moduleId: String
    public var title: String
    public var summary: String
    public var confusableWith: [String]?
  }

  /// A scoreable exercise template: a lesson step a session can offer as practice.
  public struct SkillItem: Codable, Hashable, Sendable {
    public var lessonId: String
    public var stepId: String
    public var type: String
    public var concept: String
    public var difficulty: Int

    /// The FSRS key of this item in `review_graded` events.
    public var cardKey: String { "skill:\(lessonId)#\(stepId)" }
  }

  public struct RecallCardRef: Codable, Hashable, Sendable {
    public var lessonId: String
    public var cardId: String
    public var concept: String

    public var cardKey: String { "lesson:\(lessonId)#\(cardId)" }
  }

  public struct Lesson: Codable, Hashable, Sendable {
    public var title: String
    public var moduleId: String
    public var moduleSlug: String
    public var slug: String
    public var level: LessonLevel
    public var minutes: Int
    public var concepts: [String]
    public var file: String
    public var solutionsFile: String?
  }

  public var schema: Int
  public var contentRev: String
  public var modules: [Module]
  public var concepts: [Concept]
  public var skillItems: [SkillItem]
  public var recallCards: [RecallCardRef]
  /// Lesson id to where its compiled file and its page live.
  public var lessons: [String: Lesson]
}

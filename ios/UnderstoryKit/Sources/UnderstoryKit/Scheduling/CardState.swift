import Foundation

/// The FSRS card as it travels inside a `review_graded` event: plain JSON, ISO strings,
/// the lifecycle spelled out (src/core/scheduling/card-state.ts). The device that graded
/// the review computed it; every other device only stores it, so floating-point
/// differences between TypeScript and Swift cannot make two devices diverge.
public struct CardState: Codable, Hashable, Sendable {
  public enum Lifecycle: String, Codable, Sendable {
    case new, learning, review, relearning
  }

  public var due: String
  public var stability: Double
  public var difficulty: Double
  public var reps: Int
  public var lapses: Int
  public var state: Lifecycle
  public var scheduledDays: Int
  public var elapsedDays: Int
  public var lastReview: String?
  public var learningSteps: Int?

  public init(
    due: String, stability: Double, difficulty: Double, reps: Int, lapses: Int,
    state: Lifecycle, scheduledDays: Int, elapsedDays: Int, lastReview: String? = nil,
    learningSteps: Int? = nil
  ) {
    self.due = due
    self.stability = stability
    self.difficulty = difficulty
    self.reps = reps
    self.lapses = lapses
    self.state = state
    self.scheduledDays = scheduledDays
    self.elapsedDays = elapsedDays
    self.lastReview = lastReview
    self.learningSteps = learningSteps
  }

  static let allowedKeys: Set<String> = [
    "due", "stability", "difficulty", "reps", "lapses", "state", "scheduledDays",
    "elapsedDays", "lastReview", "learningSteps",
  ]

  /// The bounds `cardStateSchema` enforces on the web.
  var isValid: Bool {
    Instant.milliseconds(due) != nil && stability >= 0 && (0...10).contains(difficulty)
      && reps >= 0 && lapses >= 0 && scheduledDays >= 0 && elapsedDays >= 0
      && (lastReview.map { Instant.milliseconds($0) != nil } ?? true)
      && (learningSteps ?? 0) >= 0
  }
}

/// FSRS ratings, matching ts-fsrs (Again = 1 ... Easy = 4, no Manual).
public enum FsrsRating: Int, Codable, Sendable, CaseIterable {
  case again = 1, hard, good, easy
}

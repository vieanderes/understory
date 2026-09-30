import Foundation

public struct ConceptRecord: Hashable, Sendable {
  public var p = 0.0
  public var familiesPassed: Set<FormatFamily> = []
  public var produceOrExplainPassed = false
  /// Local dates (`YYYY-MM-DD`) on which a correct attempt landed. May repeat.
  public var successLocalDates: [String] = []
  public var assumed = false
  /// Once mastery has reached Solid it stays true for ever, so the Gap rule can fire later.
  public var wasEverSolidOrFluent = false
  public var attemptCount = 0

  public init() {}

  public var evidence: Mastery.Evidence {
    Mastery.Evidence(
      p: p, familiesPassed: familiesPassed, produceOrExplainPassed: produceOrExplainPassed)
  }
}

public struct TestOutAttempt: Hashable, Sendable {
  public var score: Double
  public var passed: Bool
  public var at: String
}

/// The current decision record of one part's capstone (`CapstoneAdr` in reducer.ts).
public struct CapstoneAdr: Hashable, Sendable, Codable {
  public var partId: String
  public var title: String
  public var context: String?
  public var decision: String
  public var alternatives: String?
  public var consequences: String?
  /// The learner's date of the first version, and of the one shown.
  public var firstWrittenOn: String
  public var updatedOn: String
  /// How many versions the log holds. Every one of them stays there.
  public var revisions: Int
}

/// The read model folded from the event log (`ProgressState` in reducer.ts). Never stored
/// as truth: it is a cache keyed by `reducerVersion`, rebuilt from the log at any time.
public struct ProgressState: Hashable, Sendable {
  public var reducerVersion = Reducer.version
  public var concepts: [String: ConceptRecord] = [:]
  public var cards: [String: CardState] = [:]
  /// Which concept each card belongs to, from `review_graded.concept`.
  public var cardConcept: [String: String] = [:]
  /// Card keys in the order they were first reviewed. The web iterates a JavaScript
  /// object, which keeps insertion order, and a mean of doubles depends on the order of
  /// the sum, so the order is kept here too.
  public var cardOrder: [String] = []
  public var thetaByModule: [String: Double] = [:]
  public var modeByModule: [String: Mode] = [:]
  public var settings: [String: SettingValue] = [:]
  public var goalTier: GoalTier?
  public var xpByLocalDate: [String: Int] = [:]
  public var calibrationAnswers: [CalibrationAnswer] = []
  public var completedLessons: Set<String> = []
  public var completedCapstones: Set<String> = []
  /// Last writer wins per part, in (at, deviceId, seq) order.
  public var capstoneAdrs: [String: CapstoneAdr] = [:]
  public var resolvedIncidents: [IncidentResolved] = []
  public var testOuts: [String: [TestOutAttempt]] = [:]
  public var assumedConcepts: Set<String> = []
  public var collectedReadings: Set<String> = []
  public var aiReviewsPassed = 0
  /// Bookkeeping for the "same item within 24 hours" XP rule.
  public var lastGradedAt: [String: String] = [:]

  public init() {}

  public var xpTotal: Int { xpByLocalDate.values.reduce(0, +) }

  /// The concept's cards, in first-reviewed order.
  public func cards(of concept: String) -> [CardState] {
    cardOrder.compactMap { cardConcept[$0] == concept ? cards[$0] : nil }
  }

  /// `mastery_c` at `now`. Memory decays, so this is computed at the moment of looking.
  public func mastery(of concept: String, now: Date) -> Double {
    guard let record = concepts[concept] else { return 0 }
    return Mastery.mastery(of: record.evidence, cards: cards(of: concept), now: now)
  }

  public func meanStabilityDays(of concept: String) -> Double {
    let cards = cards(of: concept)
    return cards.isEmpty ? 0 : cards.reduce(0) { $0 + $1.stability } / Double(cards.count)
  }
}

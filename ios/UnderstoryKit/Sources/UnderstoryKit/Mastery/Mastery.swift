import Foundation

/// The evidence family a step belongs to. Mastery caps depend on it (LEARNING-SCIENCE B4).
public enum FormatFamily: String, Codable, Sendable, CaseIterable {
  case recognise, arrange, produce
}

public enum MasteryState: String, Codable, Sendable, CaseIterable {
  case unseen, assumed, introduced, practised, solid, fluent, gap
}

/// The mastery model, exactly as LEARNING-SCIENCE.md B4 and src/core/mastery/mastery.ts
/// define it. The constants keep their TypeScript names in camel case.
public enum Mastery {
  // MARK: Attempt score

  /// B4: "1.0 for first try with no hint."
  public static let firstTryScore = 1.0
  /// B4: "0.6 for second try." Reused for any later unhinted, unrevealed try.
  public static let secondTryScore = 0.6
  /// B4: "max(0.2, 1 - 0.2 * hints) when hints were used."
  public static let hintScoreFloor = 0.2
  public static let hintScorePerHint = 0.2
  /// B4: "0 when the solution was revealed."
  public static let revealedScore = 0.0

  public static func attemptScore(tryNumber: Int, hintsUsed: Int, revealed: Bool, correct: Bool)
    -> Double
  {
    if revealed { return revealedScore }
    if !correct { return 0 }
    if hintsUsed > 0 { return max(hintScoreFloor, firstTryScore - hintScorePerHint * Double(hintsUsed)) }
    return tryNumber <= 1 ? firstTryScore : secondTryScore
  }

  // MARK: Skill (P)

  /// B4: alpha by format family.
  public static func alpha(_ family: FormatFamily) -> Double {
    switch family {
    case .recognise: 0.15
    case .arrange: 0.25
    case .produce: 0.35
    }
  }

  /// `P_c <- (1 - alpha) * P_c + alpha * s`.
  public static func updateSkill(p: Double, score: Double, family: FormatFamily) -> Double {
    let alpha = alpha(family)
    return (1 - alpha) * p + alpha * score
  }

  /// B5: "Passing at 80% or more marks the module's concepts Practised, with P = 0.7."
  public static let testOutPassSkillP = 0.7
  /// B5: "Their FSRS items enter at S = 7 days."
  public static let testOutInitialStabilityDays = 7.0

  // MARK: Memory (M) and mastery

  /// B4: "M_c is the mean R(now) over the concept's items." Cards never reviewed are left
  /// out of the mean. Note that elapsed time is not clamped here in the TypeScript either;
  /// `retrievability` clamps it.
  public static func memory(of cards: [CardState], now: Date) -> Double {
    let nowMs = now.timeIntervalSince1970 * 1_000
    var total = 0.0
    var count = 0
    for card in cards {
      guard let lastReview = card.lastReview, let reviewedMs = Instant.milliseconds(lastReview)
      else { continue }
      let elapsedDays = (nowMs - reviewedMs) / Instant.millisecondsPerDay
      total += Scheduling.retrievability(stabilityDays: card.stability, elapsedDays: elapsedDays)
      count += 1
    }
    return count == 0 ? 0 : total / Double(count)
  }

  /// B4: "raw = 0.4 * M_c + 0.6 * P_c."
  public static let memoryWeight = 0.4
  public static let skillWeight = 0.6
  /// B4: "mastery is capped at 0.6 until two format families have passed."
  public static let midMasteryCap = 0.6
  public static let familiesForMidCap = 2
  /// B4: "and at 0.8 until a produce or explain item has passed."
  public static let highMasteryCap = 0.8

  public struct Evidence: Sendable, Hashable {
    public var p: Double
    public var familiesPassed: Set<FormatFamily>
    public var produceOrExplainPassed: Bool

    public init(p: Double, familiesPassed: Set<FormatFamily>, produceOrExplainPassed: Bool) {
      self.p = p
      self.familiesPassed = familiesPassed
      self.produceOrExplainPassed = produceOrExplainPassed
    }
  }

  /// `mastery_c = min(raw, cap)`.
  public static func mastery(of evidence: Evidence, cards: [CardState], now: Date) -> Double {
    let raw = memoryWeight * memory(of: cards, now: now) + skillWeight * evidence.p
    let cap =
      evidence.familiesPassed.count < familiesForMidCap
      ? midMasteryCap : evidence.produceOrExplainPassed ? 1 : highMasteryCap
    return min(raw, cap)
  }

  // MARK: State

  public static let practisedThreshold = 0.4
  public static let solidThreshold = 0.7
  public static let fluentThreshold = 0.85
  /// B4: "Gap: was Solid or Fluent and has fallen below 0.6."
  public static let gapThreshold = 0.6
  /// B4: "mean stability S at least 21 days."
  public static let fluentMinMeanStabilityDays = 21.0
  /// B4: "successes on at least 2 distinct days at least 7 days apart."
  public static let fluentMinSuccessDays = 2
  public static let fluentMinDaysApart = 7

  public struct StateInput: Sendable {
    public var assumed: Bool
    public var hasEvidence: Bool
    public var wasEverSolidOrFluent: Bool
    public var mastery: Double
    public var meanStabilityDays: Double
    public var fluentSpacingMet: Bool

    public init(
      assumed: Bool, hasEvidence: Bool, wasEverSolidOrFluent: Bool, mastery: Double,
      meanStabilityDays: Double, fluentSpacingMet: Bool
    ) {
      self.assumed = assumed
      self.hasEvidence = hasEvidence
      self.wasEverSolidOrFluent = wasEverSolidOrFluent
      self.mastery = mastery
      self.meanStabilityDays = meanStabilityDays
      self.fluentSpacingMet = fluentSpacingMet
    }
  }

  public static func state(_ input: StateInput) -> MasteryState {
    if input.wasEverSolidOrFluent && input.mastery < gapThreshold { return .gap }
    if !input.hasEvidence { return input.assumed ? .assumed : .unseen }
    if input.mastery >= fluentThreshold
      && input.meanStabilityDays >= fluentMinMeanStabilityDays && input.fluentSpacingMet
    {
      return .fluent
    }
    if input.mastery >= solidThreshold { return .solid }
    if input.mastery >= practisedThreshold { return .practised }
    return .introduced
  }

  /// True once two distinct success days are at least `fluentMinDaysApart` apart.
  public static func hasFluentSpacing(_ successLocalDates: [String]) -> Bool {
    let days = Set(successLocalDates).compactMap(Instant.dayNumber)
    guard Set(successLocalDates).count >= fluentMinSuccessDays, let first = days.min(),
      let last = days.max()
    else { return false }
    return last - first >= fluentMinDaysApart
  }
}

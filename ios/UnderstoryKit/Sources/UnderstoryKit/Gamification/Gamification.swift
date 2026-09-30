import Foundation

public enum Confidence: String, Codable, Sendable, CaseIterable {
  case guess, fairly, certain
}

public enum GoalTier: String, Codable, Sendable, CaseIterable {
  case light, steady, deep
}

public enum Rank: String, Codable, Sendable, CaseIterable, Comparable {
  case reader, tracer, builder, reviewer, engineer, architect

  public static func < (a: Rank, b: Rank) -> Bool {
    allCases.firstIndex(of: a)! < allCases.firstIndex(of: b)!
  }
}

/// C: the XP base table.
public enum XpKind: String, Sendable, CaseIterable {
  case recall
  case predictMcFill = "predict-mc-fill"
  case parsonsTrace = "parsons-trace"
  case labCheckpoint = "lab-checkpoint"
  case bugHuntAiReviewExplain = "bug-hunt-ai-review-explain"
  case codeChallenge = "code-challenge"
  case incident
  case testOut = "test-out"
  case capstone
  case none

  public var baseXp: Int {
    switch self {
    case .recall: 2
    case .predictMcFill: 4
    case .parsonsTrace: 6
    case .labCheckpoint: 8
    case .bugHuntAiReviewExplain: 10
    case .codeChallenge: 15
    case .incident: 25
    case .testOut: 60
    case .capstone: 100
    case .none: 0
    }
  }
}

public struct CalibrationAnswer: Sendable, Hashable {
  public var confidence: Confidence
  public var correct: Bool
  public var moduleId: String?

  public init(confidence: Confidence, correct: Bool, moduleId: String? = nil) {
    self.confidence = confidence
    self.correct = correct
    self.moduleId = moduleId
  }
}

/// XP, ranks, the weekly goal and calibration (LEARNING-SCIENCE.md section C,
/// src/core/gamification/gamification.ts). Nothing here is stored. All of it is derived
/// from events, so a sync merge cannot double-award.
public enum Gamification {
  // MARK: XP

  /// C: "an item with R above 0.95 that was not scheduled earns 0."
  public static let cramRetrievabilityThreshold = 0.95
  /// C: "spacingBonus = min(1.5, 1 + (1 - R))."
  public static let spacingBonusCap = 1.5
  /// C: "an attempt with any submitted approach earns 0.5 * base even when wrong."
  public static let challengeFirstWrongMultiplier = 0.5
  /// C: "the rubric self-grade maps 0 to 3 to s of 0, 0.4, 0.7 and 1."
  public static let explainBackSelfGradeToScore: [Double] = [0, 0.4, 0.7, 1]

  public struct XpInput: Sendable {
    public var kind: XpKind
    public var score: Double
    public var retrievabilityBefore: Double?
    public var wasScheduled: Bool
    public var challengeFirstWrongAttempt: Bool
    public var withinCooldown: Bool

    public init(
      kind: XpKind, score: Double, retrievabilityBefore: Double? = nil, wasScheduled: Bool = true,
      challengeFirstWrongAttempt: Bool = false, withinCooldown: Bool = false
    ) {
      self.kind = kind
      self.score = score
      self.retrievabilityBefore = retrievabilityBefore
      self.wasScheduled = wasScheduled
      self.challengeFirstWrongAttempt = challengeFirstWrongAttempt
      self.withinCooldown = withinCooldown
    }
  }

  /// `xp = round(base * s * spacingBonus)`, with the no-cramming, no-grinding and
  /// challenge-first-effort exceptions, checked in the same order as the TypeScript.
  public static func xp(for input: XpInput) -> Int {
    if input.kind == .none { return 0 }
    let base = Double(input.kind.baseXp)
    if input.withinCooldown { return 0 }
    if input.challengeFirstWrongAttempt { return Int(JSMath.round(challengeFirstWrongMultiplier * base)) }
    if !input.wasScheduled && (input.retrievabilityBefore ?? 0) > cramRetrievabilityThreshold {
      return 0
    }
    let spacingBonus = input.retrievabilityBefore.map { min(spacingBonusCap, 1 + (1 - $0)) } ?? 1
    return Int(JSMath.round(base * input.score * spacingBonus))
  }

  public static func xpKind(for stepType: AnsweredStepType) -> XpKind {
    switch stepType {
    case .predictOutput, .multipleChoice, .fillBlank: .predictMcFill
    case .traceTable, .parsons: .parsonsTrace
    case .lab: .labCheckpoint
    case .bugHunt, .aiReview: .bugHuntAiReviewExplain
    // A checked playground or sql step is written code judged by checks, like a challenge's tests.
    case .codeChallenge, .playground, .sql: .codeChallenge
    case .incident: .incident
    }
  }

  // MARK: Weekly goal

  /// C: "Light 150, Steady 300 and Deep 600."
  public static func goalXp(_ tier: GoalTier) -> Int {
    switch tier {
    case .light: 150
    case .steady: 300
    case .deep: 600
    }
  }

  /// C: "starts with 1, earns 1 for every 4 met weeks, and can hold at most 2."
  public static let startingReserve = 1
  public static let metWeeksPerEarnedReserve = 4
  public static let maxReserve = 2

  /// The ISO week key (`YYYY-Www`) of a `YYYY-MM-DD` local date, or nil for a bad date.
  public static func weekKey(_ localDate: String) -> String? {
    guard let day = Instant.dayNumber(localDate) else { return nil }
    return weekKey(dayNumber: day)
  }

  static func weekKey(dayNumber day: Int) -> String {
    // 1970-01-01 was a Thursday. ISO weeks start on Monday and belong to the year of
    // their Thursday.
    let isoDayOfWeek = ((day % 7) + 7 + 3) % 7 + 1
    let thursday = day + 4 - isoDayOfWeek
    let year = Instant.civil(fromDayNumber: thursday).year
    let yearStart = Instant.dayNumber(year: year, month: 1, day: 1)
    let week = (thursday - yearStart) / 7 + 1
    return String(format: "%04d-W%02d", year, week)
  }

  public struct WeekRecord: Sendable, Hashable {
    public var weekKey: String
    public var xp: Int
    public var tier: GoalTier

    public init(weekKey: String, xp: Int, tier: GoalTier) {
      self.weekKey = weekKey
      self.xp = xp
      self.tier = tier
    }
  }

  public struct WeeklyGoalSummary: Sendable, Hashable {
    public var run: Int
    public var bestRun: Int
    public var reserve: Int
    public var metWeeksTowardsReserve: Int
    public var lastWeekMissedWithNoReserve: Bool
  }

  /// Folds week-by-week XP into run, best run and rest weeks. `weeks` is chronological.
  public static func applyWeeks(_ weeks: [WeekRecord]) -> WeeklyGoalSummary {
    var summary = WeeklyGoalSummary(
      run: 0, bestRun: 0, reserve: startingReserve, metWeeksTowardsReserve: 0,
      lastWeekMissedWithNoReserve: false)
    for week in weeks {
      let met = week.xp >= goalXp(week.tier)
      summary.lastWeekMissedWithNoReserve = false
      if met {
        summary.run += 1
        summary.metWeeksTowardsReserve += 1
        if summary.metWeeksTowardsReserve >= metWeeksPerEarnedReserve && summary.reserve < maxReserve {
          summary.reserve += 1
          summary.metWeeksTowardsReserve = 0
        }
      } else if summary.reserve > 0 {
        // A rest week is spent automatically and the run continues.
        summary.reserve -= 1
        summary.run += 1
      } else {
        summary.lastWeekMissedWithNoReserve = true
        summary.run = 0
        summary.metWeeksTowardsReserve = 0
      }
      summary.bestRun = max(summary.bestRun, summary.run)
    }
    return summary
  }

  // MARK: Ranks

  public struct RankThresholds: Sendable, Hashable {
    public var tracerSolid = 25
    public var builderSolid = 60
    public var builderCapstones = 3
    public var reviewerSolid = 100
    public var reviewerAiReviewsPassed = 15
    public var reviewerMaxCalibrationGap = 15
    public var engineerSolid = 160
    /// One capstone per part; the course has seven, and five is the Production part's.
    public var engineerCapstones = 5
    public var architectSolid = 220
    /// Architect asks for every capstone (`totalCapstones`); this is the seven parts' count.
    public var architectCapstones = 7
    public var architectIncidents = 8
    public var architectFluentPerKeyModule = 10

    public init() {}
    public static let standard = RankThresholds()
  }

  public struct RankInput: Sendable {
    public var placementDone: Bool
    public var solidCount: Int
    public var capstonesCompleted: Int
    public var totalCapstones: Int
    public var aiReviewsPassed: Int
    public var calibrationGapPoints: Int?
    public var incidentsResolved: Int
    public var fluentCountByKeyModule: [Int]
    public var totalConcepts: Int

    public init(
      placementDone: Bool, solidCount: Int, capstonesCompleted: Int, totalCapstones: Int,
      aiReviewsPassed: Int, calibrationGapPoints: Int?, incidentsResolved: Int,
      fluentCountByKeyModule: [Int], totalConcepts: Int
    ) {
      self.placementDone = placementDone
      self.solidCount = solidCount
      self.capstonesCompleted = capstonesCompleted
      self.totalCapstones = totalCapstones
      self.aiReviewsPassed = aiReviewsPassed
      self.calibrationGapPoints = calibrationGapPoints
      self.incidentsResolved = incidentsResolved
      self.fluentCountByKeyModule = fluentCountByKeyModule
      self.totalConcepts = totalConcepts
    }
  }

  static func meets(_ rank: Rank, _ input: RankInput, _ t: RankThresholds) -> Bool {
    func solidCap(_ n: Int) -> Int { min(n, input.totalConcepts) }
    switch rank {
    case .reader:
      return input.placementDone
    case .tracer:
      return input.solidCount >= solidCap(t.tracerSolid)
    case .builder:
      return input.solidCount >= solidCap(t.builderSolid)
        && input.capstonesCompleted >= t.builderCapstones
    case .reviewer:
      return input.solidCount >= solidCap(t.reviewerSolid)
        && input.aiReviewsPassed >= t.reviewerAiReviewsPassed
        && (input.calibrationGapPoints ?? 0) <= t.reviewerMaxCalibrationGap
    case .engineer:
      return input.solidCount >= solidCap(t.engineerSolid)
        && input.capstonesCompleted >= t.engineerCapstones
    case .architect:
      return input.solidCount >= solidCap(t.architectSolid)
        && input.capstonesCompleted >= input.totalCapstones
        && input.incidentsResolved >= t.architectIncidents
        && input.fluentCountByKeyModule.allSatisfy { $0 >= t.architectFluentPerKeyModule }
    }
  }

  /// The highest rank whose own requirement is met. As on the web, the ranks are tested
  /// one by one and not as a ladder, and `reader` is also the answer when none is met.
  public static func rank(for input: RankInput, thresholds: RankThresholds = .standard) -> Rank {
    var achieved = Rank.reader
    for rank in Rank.allCases where meets(rank, input, thresholds) { achieved = rank }
    return achieved
  }

  // MARK: Calibration

  public static func confidenceValue(_ confidence: Confidence) -> Double {
    switch confidence {
    case .guess: 0.5
    case .fairly: 0.75
    case .certain: 0.95
    }
  }

  /// The minimum sample before a calibration gap means anything.
  public static let minCalibrationSample = 5

  public struct CalibrationGap: Sendable, Hashable {
    /// Percentage points. Nil below the minimum sample.
    public var gapPoints: Int?
    public var sampleSize: Int
  }

  /// Mean stated confidence minus accuracy, in percentage points.
  public static func calibrationGap(_ answers: [CalibrationAnswer]) -> CalibrationGap {
    guard answers.count >= minCalibrationSample else {
      return CalibrationGap(gapPoints: nil, sampleSize: answers.count)
    }
    let count = Double(answers.count)
    let meanConfidence = answers.reduce(0.0) { $0 + confidenceValue($1.confidence) } / count
    let accuracy = Double(answers.filter(\.correct).count) / count
    return CalibrationGap(
      gapPoints: Int(JSMath.round((meanConfidence - accuracy) * 100)), sampleSize: answers.count)
  }

  /// The same gap per module. Modules under the minimum sample are left out.
  public static func calibrationGapByModule(_ answers: [CalibrationAnswer]) -> [String: CalibrationGap] {
    var byModule: [String: [CalibrationAnswer]] = [:]
    for answer in answers {
      guard let moduleId = answer.moduleId else { continue }
      byModule[moduleId, default: []].append(answer)
    }
    return byModule.compactMapValues {
      let gap = calibrationGap($0)
      return gap.gapPoints == nil ? nil : gap
    }
  }

  /// Certain and wrong: re-test within the same session (hypercorrection).
  public static func isHypercorrectionCandidate(_ answer: CalibrationAnswer) -> Bool {
    answer.confidence == .certain && !answer.correct
  }

  public static let selfGradeRunsHighStreak = 3
  public static let selfGradePassThreshold = 0.7

  public static func selfGradesRunHigh(_ recentChecks: [(selfGradeScore: Double, transferCorrect: Bool)])
    -> Bool
  {
    guard recentChecks.count >= selfGradeRunsHighStreak else { return false }
    return recentChecks.suffix(selfGradeRunsHighStreak).allSatisfy {
      $0.selfGradeScore >= selfGradePassThreshold && !$0.transferCorrect
    }
  }
}

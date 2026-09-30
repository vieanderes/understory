import Foundation
import Testing

@testable import UnderstoryKit

/// The learning rules from docs/LEARNING-SCIENCE.md B4, B5 and C, each checked against the
/// sentence it comes from.
struct MasteryRuleTests {
  @Test("attempt score: 1 on a clean first try, 0.6 on a second, hints and reveals lower it")
  func attemptScore() {
    func score(try n: Int, hints: Int = 0, revealed: Bool = false, correct: Bool = true) -> Double {
      Mastery.attemptScore(tryNumber: n, hintsUsed: hints, revealed: revealed, correct: correct)
    }
    #expect(score(try: 1) == 1)
    #expect(score(try: 2) == 0.6)
    #expect(score(try: 9) == 0.6)
    #expect(score(try: 1, hints: 1) == 0.8)
    // 1 - 0.2 * 3 is 0.3999999999999999 in IEEE 754, on both platforms.
    #expect(abs(score(try: 1, hints: 3) - 0.4) < 1e-12)
    // The floor is 0.2, however many hints were taken.
    #expect(score(try: 1, hints: 9) == 0.2)
    #expect(score(try: 1, revealed: true) == 0)
    // A reveal wins over everything, including a correct answer afterwards.
    #expect(score(try: 1, hints: 0, revealed: true, correct: true) == 0)
    // A wrong answer that was never hinted or revealed still scores 0.
    #expect(score(try: 1, correct: false) == 0)
  }

  @Test("alpha is higher for the families that carry more evidence")
  func alpha() {
    #expect(Mastery.alpha(.recognise) == 0.15)
    #expect(Mastery.alpha(.arrange) == 0.25)
    #expect(Mastery.alpha(.produce) == 0.35)
  }

  @Test("P moves towards the score by alpha")
  func updateSkill() {
    #expect(Mastery.updateSkill(p: 0, score: 1, family: .recognise) == 0.15)
    #expect(abs(Mastery.updateSkill(p: 0.15, score: 1, family: .recognise) - 0.2775) < 1e-12)
    #expect(Mastery.updateSkill(p: 0, score: 1, family: .produce) == 0.35)
    #expect(Mastery.updateSkill(p: 1, score: 0, family: .produce) == 0.65)
  }

  @Test("mastery is capped at 0.6 until two families pass, and at 0.8 until produce passes")
  func caps() {
    let now = Date()
    func mastery(_ families: Set<FormatFamily>, produce: Bool) -> Double {
      Mastery.mastery(
        of: .init(p: 1, familiesPassed: families, produceOrExplainPassed: produce), cards: [],
        now: now)
    }
    // raw = 0.6 * 1 = 0.6 with no memory evidence.
    #expect(mastery([], produce: false) == 0.6)
    #expect(mastery([.recognise], produce: false) == 0.6)
    #expect(mastery([.recognise, .arrange], produce: false) == 0.6)  // raw, not the cap
    #expect(mastery([.recognise, .arrange, .produce], produce: true) == 0.6)

    // With memory evidence the caps bite.
    let card = CardState(
      due: "2026-09-24T10:00:00.000Z", stability: 7, difficulty: 5, reps: 1, lapses: 0,
      state: .review, scheduledDays: 7, elapsedDays: 0, lastReview: "2026-09-17T10:00:00.000Z")
    let at = Instant.date("2026-09-17T10:00:00.000Z")!  // R = 1
    func capped(_ families: Set<FormatFamily>, produce: Bool) -> Double {
      Mastery.mastery(
        of: .init(p: 1, familiesPassed: families, produceOrExplainPassed: produce), cards: [card],
        now: at)
    }
    #expect(capped([.recognise], produce: false) == 0.6)  // raw would be 1.0
    #expect(capped([.recognise, .arrange], produce: false) == 0.8)
    #expect(capped([.recognise, .arrange], produce: true) == 1)
  }

  @Test("memory is the mean R over reviewed cards only")
  func memory() {
    let now = Instant.date("2026-09-24T10:00:00.000Z")!
    let reviewed = CardState(
      due: "2026-09-24T10:00:00.000Z", stability: 7, difficulty: 5, reps: 1, lapses: 0,
      state: .review, scheduledDays: 7, elapsedDays: 0, lastReview: "2026-09-17T10:00:00.000Z")
    let never = CardState(
      due: "2026-09-24T10:00:00.000Z", stability: 7, difficulty: 5, reps: 0, lapses: 0,
      state: .new, scheduledDays: 0, elapsedDays: 0)
    #expect(Mastery.memory(of: [reviewed], now: now) == 0.9)
    #expect(Mastery.memory(of: [reviewed, never], now: now) == 0.9)
    #expect(Mastery.memory(of: [never], now: now) == 0)
    #expect(Mastery.memory(of: [], now: now) == 0)
  }

  @Test("the mastery state table")
  func states() {
    func state(
      mastery: Double, evidence: Bool = true, assumed: Bool = false, wasSolid: Bool = false,
      stability: Double = 0, spacing: Bool = false
    ) -> MasteryState {
      Mastery.state(
        .init(
          assumed: assumed, hasEvidence: evidence, wasEverSolidOrFluent: wasSolid,
          mastery: mastery, meanStabilityDays: stability, fluentSpacingMet: spacing))
    }
    #expect(state(mastery: 0, evidence: false) == .unseen)
    #expect(state(mastery: 0, evidence: false, assumed: true) == .assumed)
    #expect(state(mastery: 0.1) == .introduced)
    #expect(state(mastery: 0.4) == .practised)
    #expect(state(mastery: 0.69) == .practised)
    #expect(state(mastery: 0.7) == .solid)
    // Fluent needs all three: mastery, mean stability and spacing.
    #expect(state(mastery: 0.85, stability: 21, spacing: true) == .fluent)
    #expect(state(mastery: 0.85, stability: 20.9, spacing: true) == .solid)
    #expect(state(mastery: 0.85, stability: 21, spacing: false) == .solid)
    // Gap wins over everything, including no evidence.
    #expect(state(mastery: 0.59, wasSolid: true) == .gap)
    #expect(state(mastery: 0.6, wasSolid: true) == .practised)
  }

  @Test("fluent spacing needs two distinct days at least seven apart")
  func fluentSpacing() {
    #expect(!Mastery.hasFluentSpacing([]))
    #expect(!Mastery.hasFluentSpacing(["2026-09-17"]))
    #expect(!Mastery.hasFluentSpacing(["2026-09-17", "2026-09-17"]))
    #expect(!Mastery.hasFluentSpacing(["2026-09-17", "2026-09-23"]))
    #expect(Mastery.hasFluentSpacing(["2026-09-17", "2026-09-24"]))
    // The span is first to last, not consecutive pairs.
    #expect(Mastery.hasFluentSpacing(["2026-09-24", "2026-09-18", "2026-09-17"]))
  }
}

struct DifficultyRuleTests {
  @Test("the item rating and the expected success curve")
  func elo() {
    #expect(Difficulty.itemRating(2) == 1_200)
    #expect(Difficulty.itemRating(5) == 1_800)
    // Printed by Scripts/print-reference-values.ts.
    #expect(Difficulty.expectedSuccess(theta: 1_200, difficulty: 2) == 0.5)
    #expect(
      abs(Difficulty.expectedSuccess(theta: 1_000, difficulty: 5) - 0.009900990099009901) < 1e-15)
    #expect(
      Difficulty.updateTheta(
        1_200, score: 1, expected: Difficulty.expectedSuccess(theta: 1_200, difficulty: 2))
        == 1_212)
  }

  @Test("the target band shifts by one step and stays inside 0 to 1")
  func band() {
    let band = Difficulty.defaultTargetBand
    #expect(band.low == 0.7 && band.high == 0.9)
    #expect(Difficulty.shiftTargetBand(band, runningFirstTryRate: 0.8) == band)
    let up = Difficulty.shiftTargetBand(band, runningFirstTryRate: 0.95)
    #expect(abs(up.low - 0.8) < 1e-12 && abs(up.high - 1) < 1e-12)
    let down = Difficulty.shiftTargetBand(band, runningFirstTryRate: 0.5)
    #expect(abs(down.low - 0.6) < 1e-12 && abs(down.high - 0.8) < 1e-12)
    #expect(Difficulty.bandFit(0.8, band: band) == 0)
    #expect(abs(Difficulty.bandFit(0.5, band: band) - 0.2) < 1e-12)
  }

  @Test("mode choice: ties go to guided, and the learner's choice always wins")
  func mode() {
    #expect(Difficulty.mode(prerequisiteMasteryMean: 0.7, openingProblemP: 0) == .challengeFirst)
    #expect(Difficulty.mode(prerequisiteMasteryMean: 0, openingProblemP: 0.5) == .challengeFirst)
    #expect(Difficulty.mode(prerequisiteMasteryMean: 0.69, openingProblemP: 0.49) == .guided)
    #expect(
      Difficulty.mode(prerequisiteMasteryMean: 1, openingProblemP: 1, override: .guided) == .guided)
  }
}

struct GamificationRuleTests {
  @Test("the XP base table")
  func baseXp() {
    #expect(XpKind.recall.baseXp == 2)
    #expect(XpKind.predictMcFill.baseXp == 4)
    #expect(XpKind.parsonsTrace.baseXp == 6)
    #expect(XpKind.labCheckpoint.baseXp == 8)
    #expect(XpKind.bugHuntAiReviewExplain.baseXp == 10)
    #expect(XpKind.codeChallenge.baseXp == 15)
    #expect(XpKind.incident.baseXp == 25)
    #expect(XpKind.testOut.baseXp == 60)
    #expect(XpKind.capstone.baseXp == 100)
    #expect(XpKind.none.baseXp == 0)
  }

  @Test("xp = round(base * s * spacingBonus), with the three exceptions")
  func xp() {
    #expect(Gamification.xp(for: .init(kind: .codeChallenge, score: 1)) == 15)
    #expect(Gamification.xp(for: .init(kind: .codeChallenge, score: 0.6)) == 9)
    // No grinding: the same item again inside 24 hours.
    #expect(
      Gamification.xp(for: .init(kind: .capstone, score: 1, withinCooldown: true)) == 0)
    // Challenge-first effort: half the base even when wrong, and it beats the cram rule.
    #expect(
      Gamification.xp(
        for: .init(kind: .codeChallenge, score: 0, challengeFirstWrongAttempt: true)) == 8)
    // No cramming: high R and not due earns nothing.
    #expect(
      Gamification.xp(
        for: .init(kind: .recall, score: 1, retrievabilityBefore: 0.96, wasScheduled: false)) == 0)
    // The same review, but scheduled, earns the spacing bonus.
    #expect(
      Gamification.xp(for: .init(kind: .recall, score: 1, retrievabilityBefore: 0.96)) == 2)
    // spacingBonus = min(1.5, 1 + (1 - R)), so a nearly forgotten card is worth more.
    #expect(
      Gamification.xp(for: .init(kind: .bugHuntAiReviewExplain, score: 1, retrievabilityBefore: 0.5))
        == 15)
    #expect(
      Gamification.xp(for: .init(kind: .bugHuntAiReviewExplain, score: 1, retrievabilityBefore: 0))
        == 15)  // the cap holds at 1.5
    #expect(Gamification.xp(for: .init(kind: .none, score: 1)) == 0)
  }

  @Test("the weekly goal: run, reserve and best run")
  func weeks() {
    func week(_ xp: Int, _ tier: GoalTier = .light) -> Gamification.WeekRecord {
      .init(weekKey: "w", xp: xp, tier: tier)
    }
    #expect(Gamification.goalXp(.light) == 150)
    #expect(Gamification.goalXp(.steady) == 300)
    #expect(Gamification.goalXp(.deep) == 600)

    // Four met weeks earn a reserve, and the counter resets.
    let four = Gamification.applyWeeks(Array(repeating: week(200), count: 4))
    #expect(four.run == 4 && four.reserve == 2 && four.metWeeksTowardsReserve == 0)
    // The reserve is capped at two.
    let eight = Gamification.applyWeeks(Array(repeating: week(200), count: 8))
    #expect(eight.reserve == 2 && eight.run == 8)
    // A missed week spends a reserve and the run continues.
    let missOnce = Gamification.applyWeeks([week(200), week(0)])
    #expect(missOnce.run == 2 && missOnce.reserve == 0 && !missOnce.lastWeekMissedWithNoReserve)
    // A second miss with no reserve ends the run, and the best run is remembered.
    let missTwice = Gamification.applyWeeks([week(200), week(0), week(0)])
    #expect(missTwice.run == 0 && missTwice.bestRun == 2 && missTwice.lastWeekMissedWithNoReserve)
  }

  @Test("ranks: reader needs placement, and a rank is met on its own terms")
  func ranks() {
    func input(
      placement: Bool = true, solid: Int = 0, capstones: Int = 0, totalCapstones: Int = 20,
      aiReviews: Int = 0, gap: Int? = nil, incidents: Int = 0, fluent: [Int] = [0, 0, 0, 0],
      concepts: Int = 600
    ) -> Gamification.RankInput {
      .init(
        placementDone: placement, solidCount: solid, capstonesCompleted: capstones,
        totalCapstones: totalCapstones, aiReviewsPassed: aiReviews, calibrationGapPoints: gap,
        incidentsResolved: incidents, fluentCountByKeyModule: fluent, totalConcepts: concepts)
    }
    #expect(Gamification.rank(for: input(placement: false)) == .reader)
    #expect(Gamification.rank(for: input()) == .reader)
    #expect(Gamification.rank(for: input(solid: 25)) == .tracer)
    #expect(Gamification.rank(for: input(solid: 60)) == .tracer)  // no capstones yet
    #expect(Gamification.rank(for: input(solid: 60, capstones: 3)) == .builder)
    // Reviewer also needs 15 passed AI reviews and a calibration gap of 15 or less.
    #expect(
      Gamification.rank(for: input(solid: 100, capstones: 3, aiReviews: 15, gap: 15)) == .reviewer)
    #expect(
      Gamification.rank(for: input(solid: 100, capstones: 3, aiReviews: 15, gap: 16)) == .builder)
    #expect(
      Gamification.rank(for: input(solid: 160, capstones: 5, aiReviews: 15, gap: 0)) == .engineer)
    #expect(
      Gamification.rank(for: input(solid: 160, capstones: 4, aiReviews: 15, gap: 0)) == .reviewer)
    #expect(
      Gamification.rank(
        for: input(
          solid: 220, capstones: 20, totalCapstones: 20, aiReviews: 15, gap: 0, incidents: 8,
          fluent: [10, 10, 10, 10])) == .architect)
    // The solid counts are capped at the number of concepts the course holds.
    #expect(Gamification.rank(for: input(solid: 5, concepts: 5)) == .tracer)
  }

  @Test("the calibration gap is mean confidence minus accuracy, in points")
  func calibration() {
    func answers(_ pairs: [(Confidence, Bool)]) -> [CalibrationAnswer] {
      pairs.map { CalibrationAnswer(confidence: $0.0, correct: $0.1) }
    }
    // Under five answers there is no number to report.
    #expect(Gamification.calibrationGap(answers([(.certain, false)])).gapPoints == nil)
    #expect(Gamification.calibrationGap(answers([(.certain, false)])).sampleSize == 1)

    // Five "certain" answers, two right: 0.95 - 0.4 = 0.55, so 55 points.
    let over = Gamification.calibrationGap(
      answers([
        (.certain, true), (.certain, true), (.certain, false), (.certain, false), (.certain, false),
      ]))
    #expect(over.gapPoints == 55)
    #expect(over.sampleSize == 5)

    // Well calibrated guessing: 0.5 stated, 0.6 right, so a negative gap.
    let under = Gamification.calibrationGap(
      answers([(.guess, true), (.guess, true), (.guess, true), (.guess, false), (.guess, false)]))
    #expect(under.gapPoints == -10)

    #expect(Gamification.confidenceValue(.guess) == 0.5)
    #expect(Gamification.confidenceValue(.fairly) == 0.75)
    #expect(Gamification.confidenceValue(.certain) == 0.95)
    #expect(
      Gamification.isHypercorrectionCandidate(.init(confidence: .certain, correct: false)))
    #expect(
      !Gamification.isHypercorrectionCandidate(.init(confidence: .fairly, correct: false)))
  }

  @Test("the gap per module leaves out modules under the minimum sample")
  func calibrationByModule() {
    var answers: [CalibrationAnswer] = []
    for _ in 0..<5 {
      answers.append(.init(confidence: .certain, correct: false, moduleId: "js"))
    }
    answers.append(.init(confidence: .certain, correct: false, moduleId: "css"))
    answers.append(.init(confidence: .guess, correct: true))  // no module
    let byModule = Gamification.calibrationGapByModule(answers)
    #expect(byModule.keys.sorted() == ["js"])
    #expect(byModule["js"]?.gapPoints == 95)
  }

  @Test("a step type maps to its XP bucket")
  func xpKinds() {
    #expect(Gamification.xpKind(for: .predictOutput) == .predictMcFill)
    #expect(Gamification.xpKind(for: .multipleChoice) == .predictMcFill)
    #expect(Gamification.xpKind(for: .fillBlank) == .predictMcFill)
    #expect(Gamification.xpKind(for: .traceTable) == .parsonsTrace)
    #expect(Gamification.xpKind(for: .parsons) == .parsonsTrace)
    #expect(Gamification.xpKind(for: .lab) == .labCheckpoint)
    #expect(Gamification.xpKind(for: .bugHunt) == .bugHuntAiReviewExplain)
    #expect(Gamification.xpKind(for: .aiReview) == .bugHuntAiReviewExplain)
    #expect(Gamification.xpKind(for: .codeChallenge) == .codeChallenge)
    #expect(Gamification.xpKind(for: .incident) == .incident)
  }

  @Test("the format family of every answered step type")
  func families() {
    #expect(AnsweredStepType.predictOutput.family == .recognise)
    #expect(AnsweredStepType.multipleChoice.family == .recognise)
    #expect(AnsweredStepType.lab.family == .recognise)
    #expect(AnsweredStepType.traceTable.family == .arrange)
    #expect(AnsweredStepType.fillBlank.family == .arrange)
    #expect(AnsweredStepType.parsons.family == .arrange)
    #expect(AnsweredStepType.bugHunt.family == .arrange)
    #expect(AnsweredStepType.aiReview.family == .arrange)
    #expect(AnsweredStepType.codeChallenge.family == .produce)
    #expect(AnsweredStepType.incident.family == .produce)
  }
}

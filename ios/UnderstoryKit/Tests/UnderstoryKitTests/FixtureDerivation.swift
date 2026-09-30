import Foundation

@testable import UnderstoryKit

/// The `expected` block of a fixture, derived from a folded `ProgressState`.
///
/// This is a port of `deriveExpected` in `tests/unit/core/progress/fixtures.test.ts`, the
/// function that wrote `contracts/fixtures/*.json`. It is deliberately not
/// `Insight.overview`: the generator stands in for catalog data it does not have
/// (`totalCapstones`, `totalConcepts`) and walks every calendar day to build week records,
/// and the fixtures record what it produced.
enum FixtureDerivation {
  struct Weeks: Equatable {
    var run: Int
    var bestRun: Int
    var reserve: Int
  }

  struct Derived: Equatable {
    var xpTotal: Int
    var weeks: Weeks
    var rank: Rank
    var masteryByConcept: [String: Double]
    var states: [String: String]
    var calibrationGap: Int?
    var adrs: [String: CapstoneAdr]
  }

  /// Walks every calendar day from the first XP-earning day to `now`, so a week with no
  /// activity becomes an explicit zero-XP record (a genuine missed week) rather than being
  /// absent from the list.
  static func weekRecords(_ state: ProgressState, now: Date, tier: GoalTier)
    -> [Gamification.WeekRecord]
  {
    let days = state.xpByLocalDate.keys.compactMap(Instant.dayNumber).sorted()
    guard let firstDay = days.first else { return [] }
    let nowMs = now.timeIntervalSince1970 * 1_000

    var xpByWeek: [String: Int] = [:]
    var order: [String] = []
    var day = firstDay
    while Double(day) * Instant.millisecondsPerDay <= nowMs {
      let key = Gamification.weekKey(dayNumber: day)
      if xpByWeek[key] == nil { order.append(key) }
      xpByWeek[key, default: 0] += state.xpByLocalDate[Instant.localDate(fromDayNumber: day)] ?? 0
      day += 1
    }
    // The TypeScript sorts the map's entries by week key before folding them.
    return order.sorted { JSMath.stringPrecedes($0, $1) }
      .map { .init(weekKey: $0, xp: xpByWeek[$0] ?? 0, tier: tier) }
  }

  static func derive(_ state: ProgressState, now: Date, goalTier: GoalTier) -> Derived {
    let weekly = Gamification.applyWeeks(weekRecords(state, now: now, tier: goalTier))

    var masteryByConcept: [String: Double] = [:]
    var states: [String: String] = [:]
    for (concept, record) in state.concepts {
      let cards = state.cards(of: concept)
      let mastery = Mastery.mastery(of: record.evidence, cards: cards, now: now)
      // The fixture rounds to 4 decimal places, so a difference in the last bits of a
      // double cannot make the two platforms disagree.
      masteryByConcept[concept] = JSMath.round(mastery * 10_000) / 10_000
      states[concept] = Mastery.state(
        .init(
          assumed: record.assumed,
          // The generator counts any card, reviewed or not, as evidence here.
          hasEvidence: record.attemptCount > 0 || !cards.isEmpty,
          wasEverSolidOrFluent: record.wasEverSolidOrFluent, mastery: mastery,
          meanStabilityDays: state.meanStabilityDays(of: concept),
          fluentSpacingMet: Mastery.hasFluentSpacing(record.successLocalDates))
      ).rawValue
    }

    let solidCount = states.values.filter { $0 == "solid" || $0 == "fluent" }.count
    let calibration = Gamification.calibrationGap(state.calibrationAnswers)
    let rank = Gamification.rank(
      for: .init(
        placementDone: !state.thetaByModule.isEmpty,
        solidCount: solidCount,
        capstonesCompleted: state.completedCapstones.count,
        totalCapstones: max(1, state.completedCapstones.count),
        aiReviewsPassed: state.aiReviewsPassed,
        calibrationGapPoints: calibration.gapPoints,
        incidentsResolved: state.resolvedIncidents.count,
        fluentCountByKeyModule: [0, 0, 0, 0],
        totalConcepts: max(1, state.concepts.count)))

    return Derived(
      xpTotal: state.xpTotal,
      weeks: Weeks(run: weekly.run, bestRun: weekly.bestRun, reserve: weekly.reserve),
      rank: rank, masteryByConcept: masteryByConcept, states: states,
      calibrationGap: calibration.gapPoints, adrs: state.capstoneAdrs)
  }
}

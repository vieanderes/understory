import Foundation

/// The read side that Today, the map and the widget show (src/core/insight/overview.ts).
/// Nothing here is stored. Mastery decays with time, so it is derived when looked at.
public enum Insight {
  /// The goal used until the learner picks one.
  public static let defaultGoalTier = GoalTier.steady
  /// Due cards whose recall has fallen under this are about to be lost.
  public static let nearlyForgottenBelow = 0.75
  /// Modules whose Fluent counts gate the Architect rank.
  public static let keyModuleIds = ["db", "scale", "arch", "cloud"]

  // MARK: Concepts

  public struct ConceptSnapshot: Sendable, Hashable {
    public var state: MasteryState
    public var mastery: Double
    /// Mean retrievability of the concept's reviewed cards, or nil with none.
    public var recall: Double?
    /// ISO instant of the earliest due card, or nil.
    public var nextDue: String?
    public var dueNow: Bool
  }

  public static func snapshot(of concept: String, in state: ProgressState, now: Date)
    -> ConceptSnapshot
  {
    let record = state.concepts[concept]
    let cards = state.cards(of: concept)
    let reviewed = cards.filter { $0.lastReview != nil }
    let mastery = state.mastery(of: concept, now: now)
    let nextDue = cards.map(\.due).min { JSMath.stringPrecedes($0, $1) }
    let nowMs = now.timeIntervalSince1970 * 1_000
    return ConceptSnapshot(
      state: Mastery.state(
        .init(
          assumed: record?.assumed ?? state.assumedConcepts.contains(concept),
          hasEvidence: (record?.attemptCount ?? 0) > 0 || !reviewed.isEmpty,
          wasEverSolidOrFluent: record?.wasEverSolidOrFluent ?? false, mastery: mastery,
          meanStabilityDays: state.meanStabilityDays(of: concept),
          fluentSpacingMet: Mastery.hasFluentSpacing(record?.successLocalDates ?? []))),
      mastery: mastery,
      recall: reviewed.isEmpty ? nil : Mastery.memory(of: reviewed, now: now),
      nextDue: nextDue,
      dueNow: nextDue.flatMap(Instant.milliseconds).map { $0 <= nowMs } ?? false)
  }

  // MARK: Due

  public struct DueSummary: Sendable, Hashable {
    public var dueNow: Int
    public var nearlyForgotten: Int
    /// ISO instant of the next card that is not yet due, or nil.
    public var nextDue: String?
    public var started: Int
  }

  /// What the widget and the "Nothing due. Next: Thursday, 12 items." line read.
  public static func dueSummary(_ state: ProgressState, now: Date) -> DueSummary {
    let nowMs = now.timeIntervalSince1970 * 1_000
    var summary = DueSummary(dueNow: 0, nearlyForgotten: 0, nextDue: nil, started: state.cards.count)
    for card in state.cards.values {
      guard let dueMs = Instant.milliseconds(card.due) else { continue }
      if dueMs <= nowMs {
        summary.dueNow += 1
        if card.lastReview != nil, Mastery.memory(of: [card], now: now) < nearlyForgottenBelow {
          summary.nearlyForgotten += 1
        }
      } else if summary.nextDue.map({ JSMath.stringPrecedes(card.due, $0) }) ?? true {
        summary.nextDue = card.due
      }
    }
    return summary
  }

  // MARK: The week

  public struct WeekView: Sendable, Hashable {
    public var summary: Gamification.WeeklyGoalSummary
    public var tier: GoalTier
    public var goal: Int
    public var xpThisWeek: Int
    public var met: Bool
  }

  /// The run counts finished weeks. The current week joins it only once its goal is met,
  /// so an unfinished week never reads as a miss. `today` is the learner's local date.
  public static func weekView(_ state: ProgressState, today: String) -> WeekView {
    let tier = state.goalTier ?? defaultGoalTier
    let goal = Gamification.goalXp(tier)
    var xpByWeek: [String: Int] = [:]
    for (date, xp) in state.xpByLocalDate {
      if let key = Gamification.weekKey(date) { xpByWeek[key, default: 0] += xp }
    }
    let thisWeek = Gamification.weekKey(today) ?? ""
    let xpThisWeek = xpByWeek[thisWeek] ?? 0
    let met = xpThisWeek >= goal

    var weeks: [Gamification.WeekRecord] = []
    let firstDay = state.xpByLocalDate.keys.compactMap(Instant.dayNumber).min()
    if let firstDay, let todayDay = Instant.dayNumber(today) {
      var day = firstDay
      while day <= todayDay + 6 {
        let key = Gamification.weekKey(dayNumber: day)
        if key == thisWeek { break }
        if weeks.last?.weekKey != key {
          weeks.append(.init(weekKey: key, xp: xpByWeek[key] ?? 0, tier: tier))
        }
        day += 7
      }
    }
    if met { weeks.append(.init(weekKey: thisWeek, xp: xpThisWeek, tier: tier)) }
    return WeekView(
      summary: Gamification.applyWeeks(weeks), tier: tier, goal: goal, xpThisWeek: xpThisWeek,
      met: met)
  }
}

import Foundation
import Testing

@testable import UnderstoryKit

/// Retrievability against values printed by `Scripts/print-reference-values.ts`, which
/// calls `retrievability` in `src/core/scheduling/fsrs.ts` (and so ts-fsrs) directly.
/// Regenerate with:
///   pnpm exec tsx ios/UnderstoryKit/Scripts/print-reference-values.ts
struct SchedulingTests {
  /// `(stabilityDays, elapsedDays, R)` as the TypeScript printed them on 2026-09-17,
  /// ts-fsrs 5.4.2, FSRS5_DEFAULT_DECAY = 0.5.
  static let pinned: [(s: Double, t: Double, r: Double)] = [
    (7, 0, 1),
    (7, 7, 0.9),
    (7, 1.0 / 12.0, 0.99860668),
    (7, 3, 0.95323336),
    (1, 1, 0.9),
    (2.5, 10, 0.7182782),
    (21, 30, 0.8654532),
    (100, 365, 0.7339911),
    (0.4, 0.05, 0.98565422),
    (7, -3, 1),
    (0, 5, 0),
    (36500, 1, 0.99999679),
  ]

  @Test("the constants are the ones the TypeScript uses")
  func constants() {
    #expect(Scheduling.fsrs5DefaultDecay == 0.5)
    #expect(Scheduling.curveExponent == -0.5)
    // ts-fsrs `computeDecayFactor`: exp(ln 0.9 / -0.5) - 1, rounded to 8 places = 19/81.
    #expect(Scheduling.curveFactor == 0.2345679)
    #expect(Scheduling.roundingPlaces == 8)
    #expect(Scheduling.requestRetention == 0.9)
  }

  @Test("retrievability matches the TypeScript to all eight published places", arguments: pinned)
  func retrievability(pin: (s: Double, t: Double, r: Double)) {
    let r = Scheduling.retrievability(stabilityDays: pin.s, elapsedDays: pin.t)
    #expect(r == pin.r, "R(S = \(pin.s), t = \(pin.t)) was \(r), the web says \(pin.r)")
  }

  @Test("R is 0.9 at t = S for any stability")
  func ninetyPercentAtStability() {
    for stability in [0.5, 1.0, 7.0, 21.0, 365.0] {
      #expect(Scheduling.retrievability(stabilityDays: stability, elapsedDays: stability) == 0.9)
    }
  }

  @Test("due cards come back earliest first")
  func dueCards() {
    func card(due: String) -> CardState {
      CardState(
        due: due, stability: 7, difficulty: 5, reps: 1, lapses: 0, state: .review,
        scheduledDays: 7, elapsedDays: 0)
    }
    let cards = [
      "b": card(due: "2026-09-16T10:00:00.000Z"),
      "a": card(due: "2026-09-15T10:00:00.000Z"),
      "c": card(due: "2026-09-20T10:00:00.000Z"),
    ]
    let now = Instant.date("2026-09-17T12:00:00.000Z")!
    #expect(Scheduling.dueCards(cards, now: now) == ["a", "b"])
  }

  @Test(
    "a score becomes an FSRS rating on the same boundaries as the web",
    arguments: [
      (0.0, nil, FsrsRating.again), (0.3, nil, .hard), (0.59, nil, .hard), (0.6, nil, .good),
      (0.99, nil, .good), (1.0, nil, .easy), (1.0, Confidence.guess, .good),
      (1.0, Confidence.certain, .easy),
    ] as [(Double, Confidence?, FsrsRating)])
  func ratingFromScore(score: Double, confidence: Confidence?, expected: FsrsRating) {
    #expect(Scheduling.rating(fromScore: score, confidence: confidence) == expected)
  }
}

/// `weekKey`, `Math.round` and the instant parser, all of which the reducer leans on.
struct JSMathAndInstantTests {
  /// Printed by the same script. ISO weeks belong to the year of their Thursday.
  static let weeks: [(String, String)] = [
    ("2026-09-17", "2026-W38"),
    ("2026-01-01", "2026-W01"),
    ("2027-01-01", "2026-W53"),
    ("2024-12-30", "2025-W01"),
    ("2021-01-03", "2020-W53"),
    ("2020-12-31", "2020-W53"),
    ("2026-12-31", "2026-W53"),
    ("2032-01-01", "2032-W01"),
  ]

  @Test("the ISO week key matches the TypeScript", arguments: weeks)
  func weekKey(localDate: String, expected: String) {
    #expect(Gamification.weekKey(localDate) == expected)
  }

  @Test("rounding sends halves towards positive infinity, as JavaScript does")
  func jsRound() {
    #expect(JSMath.round(2.5) == 3)
    #expect(JSMath.round(-2.5) == -2)
    #expect(JSMath.round(0.5) == 1)
    #expect(JSMath.round(1.5) == 2)
    #expect(JSMath.round(-0.5) == 0)
  }

  @Test("the instant parser accepts what zod accepts and refuses the rest")
  func instants() {
    #expect(Instant.milliseconds("2026-09-17T10:00:00.000Z") == 1_789_639_200_000)
    #expect(Instant.milliseconds("2026-09-17T10:00:00Z") == 1_789_639_200_000)
    #expect(Instant.milliseconds("2026-09-17T10:00Z") == 1_789_639_200_000)
    #expect(Instant.milliseconds("2026-09-17T10:00:00.123456Z") == 1_789_639_200_123)
    // No local time, no offset: the contract says ISO-8601 UTC.
    #expect(Instant.milliseconds("2026-09-17T10:00:00+01:00") == nil)
    #expect(Instant.milliseconds("2026-09-17") == nil)
    #expect(Instant.milliseconds("not a date") == nil)
  }

  @Test("an instant round-trips through the exact form toISOString writes")
  func instantRoundTrip() {
    for text in [
      "2026-09-17T10:00:00.000Z", "1970-01-01T00:00:00.000Z", "2032-02-29T23:59:59.999Z",
    ] {
      let ms = Instant.milliseconds(text)
      #expect(ms != nil)
      #expect(Instant.string(milliseconds: ms!) == text)
    }
  }

  @Test("local dates round-trip through their day number")
  func localDates() {
    for text in ["2026-09-17", "2020-02-29", "1970-01-01", "2100-03-01"] {
      let day = Instant.dayNumber(text)
      #expect(day != nil)
      #expect(Instant.localDate(fromDayNumber: day!) == text)
    }
  }
}

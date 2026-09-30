import Foundation

/// The forgetting curve and the small scheduling rules that need no FSRS engine.
///
/// Constants are read from src/core/scheduling/fsrs.ts and ts-fsrs 5.4.2, not re-derived:
/// the web calls `forgetting_curve(FSRS5_DEFAULT_DECAY, t, S)`, and ts-fsrs rounds both the
/// factor and the result to 8 decimal places. The rounding is reproduced here, because a
/// port that skipped it would differ from the web in the ninth digit for no reason.
public enum Scheduling {
  /// ts-fsrs `FSRS5_DEFAULT_DECAY`. The exponent of the curve is its negative.
  public static let fsrs5DefaultDecay = 0.5
  public static let curveExponent = -fsrs5DefaultDecay
  /// ts-fsrs `computeDecayFactor`: `exp(ln(0.9) / decay) - 1` rounded to 8 places. For a
  /// decay of -0.5 that is 19/81 = 0.23456790, which puts R = 0.9 at t = S.
  public static let curveFactor = JSMath.round(
    exp(log(0.9) / curveExponent) - 1, toPlaces: roundingPlaces)
  public static let roundingPlaces = 8
  /// LEARNING-SCIENCE.md B4: "review near R = 0.9."
  public static let requestRetention = 0.9

  /// `R(t) = (1 + factor * t / S)^decay` (LEARNING-SCIENCE.md B4). Zero stability gives 0
  /// and negative elapsed time counts as none, as in `retrievability` on the web.
  public static func retrievability(stabilityDays: Double, elapsedDays: Double) -> Double {
    if stabilityDays <= 0 { return 0 }
    let elapsed = max(0, elapsedDays)
    return JSMath.round(
      pow(1 + curveFactor * elapsed / stabilityDays, curveExponent), toPlaces: roundingPlaces)
  }

  /// Cards whose `due` has passed, earliest first (`dueCards` on the web).
  public static func dueCards(_ cards: [String: CardState], now: Date) -> [String] {
    let nowMs = now.timeIntervalSince1970 * 1_000
    var due: [(key: String, dueMs: Double)] = []
    for (key, card) in cards {
      guard let dueMs = Instant.milliseconds(card.due), dueMs <= nowMs else { continue }
      due.append((key, dueMs))
    }
    // The key breaks ties, so the order does not depend on dictionary iteration.
    due.sort { $0.dueMs != $1.dueMs ? $0.dueMs < $1.dueMs : JSMath.stringPrecedes($0.key, $1.key) }
    return due.map(\.key)
  }

  private static let ratingHardCeiling = 0.6
  private static let ratingGoodCeiling = 1.0

  /// A score of 0 is Again, a clean confident first try is Easy, anything between is Hard
  /// or Good (LEARNING-SCIENCE.md, Implementation notes, `ratingFromScore`).
  public static func rating(fromScore score: Double, confidence: Confidence? = nil) -> FsrsRating {
    if score <= 0 { return .again }
    if score < ratingHardCeiling { return .hard }
    if score < ratingGoodCeiling { return .good }
    return confidence == .guess ? .good : .easy
  }
}

import Foundation

/// Elo-style difficulty and mode choice (LEARNING-SCIENCE.md B5, src/core/mastery/difficulty.ts).
public enum Difficulty {
  /// B5: "the item rating is b = 800 + 200 * d."
  public static let baseRating = 800.0
  public static let ratingPerDifficulty = 200.0
  public static let eloScale = 400.0
  /// B5: "theta += 24 * (s - p)."
  public static let thetaK = 24.0

  public static func itemRating(_ d: Int) -> Double {
    baseRating + ratingPerDifficulty * Double(d)
  }

  /// B5: "p = 1 / (1 + 10^((b - theta) / 400))."
  public static func expectedSuccess(theta: Double, difficulty d: Int) -> Double {
    1 / (1 + pow(10, (itemRating(d) - theta) / eloScale))
  }

  public static func updateTheta(_ theta: Double, score: Double, expected p: Double) -> Double {
    theta + thetaK * (score - p)
  }

  public struct TargetBand: Sendable, Hashable {
    public var low: Double
    public var high: Double

    public init(low: Double, high: Double) {
      self.low = low
      self.high = high
    }
  }

  /// B5: "The selector prefers items with p in 0.70 to 0.90."
  public static let defaultTargetBand = TargetBand(low: 0.7, high: 0.9)
  public static let runningRateUpper = 0.9
  public static let runningRateLower = 0.65
  public static let bandShiftStep = 0.1

  public static func shiftTargetBand(_ band: TargetBand, runningFirstTryRate rate: Double)
    -> TargetBand
  {
    func clamp(_ value: Double) -> Double { min(max(value, 0), 1) }
    if rate > runningRateUpper {
      return TargetBand(low: clamp(band.low + bandShiftStep), high: clamp(band.high + bandShiftStep))
    }
    if rate < runningRateLower {
      return TargetBand(low: clamp(band.low - bandShiftStep), high: clamp(band.high - bandShiftStep))
    }
    return band
  }

  /// 0 inside the band, growing outward. Ranks candidate items for a session.
  public static func bandFit(_ p: Double, band: TargetBand) -> Double {
    if p >= band.low && p <= band.high { return 0 }
    return p < band.low ? band.low - p : p - band.high
  }

  public static let prerequisiteMasteryThreshold = 0.7
  public static let openingProblemPThreshold = 0.5

  /// Ties go to Guided. The learner's own choice always wins.
  public static func mode(
    prerequisiteMasteryMean: Double, openingProblemP: Double, override: Mode? = nil
  ) -> Mode {
    if let override { return override }
    return prerequisiteMasteryMean >= prerequisiteMasteryThreshold
      || openingProblemP >= openingProblemPThreshold ? .challengeFirst : .guided
  }

  public static let promotionFirstTryRate = 0.85
  public static let promotionStreak = 2

  public static func promotionOffered(_ recentLessons: [(firstTryRate: Double, hintsUsed: Int)])
    -> Bool
  {
    guard recentLessons.count >= promotionStreak else { return false }
    return recentLessons.suffix(promotionStreak).allSatisfy {
      $0.firstTryRate >= promotionFirstTryRate && $0.hintsUsed == 0
    }
  }

  public static let demotionScoreThreshold = 0.5
  public static let demotionStreak = 2

  public static func demotionOffered(_ recentConsolidationScores: [Double]) -> Bool {
    guard recentConsolidationScores.count >= demotionStreak else { return false }
    return recentConsolidationScores.suffix(demotionStreak).allSatisfy { $0 < demotionScoreThreshold }
  }
}

import Foundation

/// Arithmetic that must agree with JavaScript to the last digit, because the TypeScript
/// reducer wrote the golden fixtures (contracts/fixtures).
public enum JSMath {
  /// `Math.round`: halves go towards positive infinity. Swift's `rounded()` sends halves
  /// away from zero, so `-2.5` would become `-3` here and `-2` on the web.
  public static func round(_ value: Double) -> Double {
    guard value.isFinite else { return value }
    let floor = value.rounded(.down)
    return value - floor >= 0.5 ? floor + 1 : floor
  }

  /// ts-fsrs `roundTo(num, decimals)`: `Math.round(num * 10 ** decimals) / 10 ** decimals`.
  public static func round(_ value: Double, toPlaces places: Int) -> Double {
    let factor = pow(10, Double(places))
    return round(value * factor) / factor
  }

  /// JavaScript's `<` on strings compares UTF-16 code units, not Unicode collation order.
  public static func stringPrecedes(_ a: String, _ b: String) -> Bool {
    a.utf16.lexicographicallyPrecedes(b.utf16)
  }
}

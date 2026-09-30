import Foundation

/// ISO-8601 UTC instants and `YYYY-MM-DD` local dates, as the contract writes them
/// (docs/SYNC-PROTOCOL.md "JSON rules"). Events keep the original string, because the
/// reducer sorts by it; these helpers turn it into a number when arithmetic is needed.
public enum Instant {
  public static let millisecondsPerDay: Double = 86_400_000

  /// Milliseconds since 1970 for `YYYY-MM-DDTHH:MM[:SS[.fraction]]Z`, or nil. This is the
  /// set zod's `z.iso.datetime()` accepts: UTC only, no offsets, seconds and any
  /// sub-second precision optional. Like JavaScript's `Date`, precision below one
  /// millisecond is dropped.
  public static func milliseconds(_ text: String) -> Double? {
    let bytes = Array(text.utf8)
    guard bytes.count >= 17, bytes.last == UInt8(ascii: "Z") else { return nil }
    guard let day = dayNumber(bytes[0..<10]), bytes[10] == UInt8(ascii: "T") else { return nil }
    guard let hour = number(bytes[11..<13]), bytes[13] == UInt8(ascii: ":"),
      let minute = number(bytes[14..<16]), hour < 24, minute < 60
    else { return nil }

    var index = 16
    var second = 0
    var millisecond = 0.0
    if bytes[index] == UInt8(ascii: ":") {
      guard bytes.count >= index + 4, let parsed = number(bytes[(index + 1)..<(index + 3)]),
        parsed < 60
      else { return nil }
      second = parsed
      index += 3
      if bytes[index] == UInt8(ascii: ".") {
        index += 1
        let start = index
        var scale = 100.0
        while index < bytes.count - 1 {
          guard let digit = digit(bytes[index]) else { return nil }
          millisecond += Double(digit) * scale
          scale /= 10
          index += 1
        }
        guard index > start else { return nil }
        millisecond = millisecond.rounded(.down)
      }
    }
    guard index == bytes.count - 1 else { return nil }
    let seconds = Double(day) * 86_400 + Double(hour * 3_600 + minute * 60 + second)
    return seconds * 1_000 + millisecond
  }

  public static func date(_ text: String) -> Date? {
    milliseconds(text).map { Date(timeIntervalSince1970: $0 / 1_000) }
  }

  /// What JavaScript's `toISOString()` writes: always three fraction digits and `Z`. The
  /// iOS app must write `at` in exactly this form, because the reducer orders events by
  /// comparing these strings (docs/ios/CONTRACT.md, known issue K2).
  public static func string(milliseconds: Double) -> String {
    let total = Int64(milliseconds.rounded(.down))
    let dayCount = Int(floorDivide(total, 86_400_000))
    let inDay = Int(total - Int64(dayCount) * 86_400_000)
    let (year, month, day) = civil(fromDayNumber: dayCount)
    return String(
      format: "%04d-%02d-%02dT%02d:%02d:%02d.%03dZ", year, month, day, inDay / 3_600_000,
      inDay / 60_000 % 60, inDay / 1_000 % 60, inDay % 1_000)
  }

  public static func string(_ date: Date) -> String {
    string(milliseconds: (date.timeIntervalSince1970 * 1_000).rounded())
  }

  /// Days since 1970-01-01 for a `YYYY-MM-DD` string, or nil.
  public static func dayNumber(_ localDate: String) -> Int? {
    let bytes = Array(localDate.utf8)
    guard bytes.count == 10 else { return nil }
    return dayNumber(bytes[0..<10])
  }

  public static func localDate(fromDayNumber dayNumber: Int) -> String {
    let (year, month, day) = civil(fromDayNumber: dayNumber)
    return String(format: "%04d-%02d-%02d", year, month, day)
  }

  public static func isLocalDate(_ text: String) -> Bool {
    // The TypeScript check is the pattern only (`^\d{4}-\d{2}-\d{2}$`), not the calendar.
    let bytes = Array(text.utf8)
    guard bytes.count == 10 else { return false }
    for (index, byte) in bytes.enumerated() {
      if index == 4 || index == 7 {
        if byte != UInt8(ascii: "-") { return false }
      } else if digit(byte) == nil {
        return false
      }
    }
    return true
  }

  // MARK: - Calendar arithmetic (proleptic Gregorian, after Howard Hinnant's algorithms)

  static func dayNumber(year: Int, month: Int, day: Int) -> Int {
    let y = month <= 2 ? year - 1 : year
    let era = (y >= 0 ? y : y - 399) / 400
    let yearOfEra = y - era * 400
    let shiftedMonth = (month + 9) % 12
    let dayOfYear = (153 * shiftedMonth + 2) / 5 + day - 1
    let dayOfEra = yearOfEra * 365 + yearOfEra / 4 - yearOfEra / 100 + dayOfYear
    return era * 146_097 + dayOfEra - 719_468
  }

  static func civil(fromDayNumber dayNumber: Int) -> (year: Int, month: Int, day: Int) {
    let z = dayNumber + 719_468
    let era = (z >= 0 ? z : z - 146_096) / 146_097
    let dayOfEra = z - era * 146_097
    let yearOfEra = (dayOfEra - dayOfEra / 1_460 + dayOfEra / 36_524 - dayOfEra / 146_096) / 365
    let dayOfYear = dayOfEra - (365 * yearOfEra + yearOfEra / 4 - yearOfEra / 100)
    let shiftedMonth = (5 * dayOfYear + 2) / 153
    let day = dayOfYear - (153 * shiftedMonth + 2) / 5 + 1
    let month = shiftedMonth < 10 ? shiftedMonth + 3 : shiftedMonth - 9
    let year = yearOfEra + era * 400 + (month <= 2 ? 1 : 0)
    return (year, month, day)
  }

  private static func dayNumber(_ bytes: ArraySlice<UInt8>) -> Int? {
    let b = Array(bytes)
    guard b.count == 10, b[4] == UInt8(ascii: "-"), b[7] == UInt8(ascii: "-"),
      let year = number(b[0..<4]), let month = number(b[5..<7]), let day = number(b[8..<10]),
      (1...12).contains(month), (1...31).contains(day)
    else { return nil }
    return dayNumber(year: year, month: month, day: day)
  }

  private static func digit(_ byte: UInt8) -> Int? {
    byte >= 48 && byte <= 57 ? Int(byte) - 48 : nil
  }

  private static func number(_ bytes: ArraySlice<UInt8>) -> Int? {
    var value = 0
    for byte in bytes {
      guard let digit = digit(byte) else { return nil }
      value = value * 10 + digit
    }
    return value
  }

  private static func floorDivide(_ a: Int64, _ b: Int64) -> Int64 {
    let quotient = a / b
    return (a % b != 0 && (a < 0) != (b < 0)) ? quotient - 1 : quotient
  }
}

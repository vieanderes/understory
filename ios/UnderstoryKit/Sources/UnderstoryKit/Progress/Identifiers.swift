import Foundation

/// The id patterns of src/core/content/schema.ts and src/core/progress/events.ts, written
/// as small scanners so that they are cheap to call once per event.
public enum Identifiers {
  private static func isLowerOrDigit(_ c: UInt8) -> Bool { isLower(c) || isDigit(c) }
  private static func isLower(_ c: UInt8) -> Bool { c >= 97 && c <= 122 }
  private static func isDigit(_ c: UInt8) -> Bool { c >= 48 && c <= 57 }

  /// JavaScript's `\s`: the characters a `/\S/` test skips over.
  private static let jsWhitespace: Set<Unicode.Scalar> = Set(
    ([0x09, 0x0A, 0x0B, 0x0C, 0x0D, 0x20, 0xA0, 0x1680, 0x2028, 0x2029, 0x202F, 0x205F]
      + [0x3000, 0xFEFF] + Array(0x2000...0x200A))
      .compactMap { Unicode.Scalar(UInt32($0)) })

  /// `/\S/` and `.max(max)` together: some visible text, at most `max` UTF-16 code units,
  /// which is how JavaScript measures a string's length.
  public static func isWrittenText(_ text: String, max: Int) -> Bool {
    text.utf16.count <= max && text.unicodeScalars.contains { !jsWhitespace.contains($0) }
  }

  /// `^[a-z][a-z0-9]*$`: one lowercase word, for example `js`.
  public static func isModuleId(_ text: String) -> Bool {
    let bytes = Array(text.utf8)
    guard let first = bytes.first, isLower(first) else { return false }
    return bytes.allSatisfy(isLowerOrDigit)
  }

  /// `^[a-z0-9]+(-[a-z0-9]+)*$`: lowercase words joined by hyphens, for example `card-2`.
  public static func isLocalId(_ text: String) -> Bool {
    isHyphenated(Array(text.utf8)[...])
  }

  /// `^[a-z][a-z0-9]*(\.[a-z0-9]+(-[a-z0-9]+)*)+$`: dotted lowercase, for example
  /// `db.isolation-levels`.
  public static func isContentId(_ text: String) -> Bool {
    let parts = Array(text.utf8).split(separator: UInt8(ascii: "."), omittingEmptySubsequences: false)
    guard parts.count >= 2, let head = parts.first, let first = head.first, isLower(first),
      head.allSatisfy(isLowerOrDigit)
    else { return false }
    return parts.dropFirst().allSatisfy(isHyphenated)
  }

  /// `^(lesson|skill):[a-z][a-z0-9.-]*#[a-z0-9-]+$`.
  public static func isCardKey(_ text: String) -> Bool {
    let rest: Substring
    if text.hasPrefix("lesson:") {
      rest = text.dropFirst(7)
    } else if text.hasPrefix("skill:") {
      rest = text.dropFirst(6)
    } else {
      return false
    }
    let halves = rest.utf8.split(separator: UInt8(ascii: "#"), omittingEmptySubsequences: false)
    guard halves.count == 2, let first = halves[0].first, isLower(first), !halves[1].isEmpty
    else { return false }
    let dot = UInt8(ascii: "."), hyphen = UInt8(ascii: "-")
    return halves[0].allSatisfy { isLowerOrDigit($0) || $0 == dot || $0 == hyphen }
      && halves[1].allSatisfy { isLowerOrDigit($0) || $0 == hyphen }
  }

  /// `^\d{4}-W\d{2}$`.
  public static func isIsoWeek(_ text: String) -> Bool {
    let bytes = Array(text.utf8)
    guard bytes.count == 8, bytes[4] == UInt8(ascii: "-"), bytes[5] == UInt8(ascii: "W") else {
      return false
    }
    return bytes[0..<4].allSatisfy(isDigit) && bytes[6..<8].allSatisfy(isDigit)
  }

  /// A version 7 UUID in the canonical lowercase-or-uppercase hex form.
  public static func isUuidV7(_ text: String) -> Bool {
    let bytes = Array(text.utf8)
    guard bytes.count == 36 else { return false }
    for (index, byte) in bytes.enumerated() {
      switch index {
      case 8, 13, 18, 23:
        if byte != UInt8(ascii: "-") { return false }
      case 14:
        if byte != UInt8(ascii: "7") { return false }
      case 19:
        if !"89abAB".utf8.contains(byte) { return false }
      default:
        let isHex = isDigit(byte) || (byte >= 97 && byte <= 102) || (byte >= 65 && byte <= 70)
        if !isHex { return false }
      }
    }
    return true
  }

  private static func isHyphenated(_ bytes: ArraySlice<UInt8>) -> Bool {
    let words = bytes.split(separator: UInt8(ascii: "-"), omittingEmptySubsequences: false)
    return !words.isEmpty && words.allSatisfy { !$0.isEmpty && $0.allSatisfy(isLowerOrDigit) }
  }

  /// A new UUIDv7 (RFC 9562): 48 bits of Unix milliseconds, then random bits. Time-ordered,
  /// so the log's primary key clusters by time.
  public static func uuidV7(now: Date = Date()) -> String {
    var generator = SystemRandomNumberGenerator()
    return uuidV7(milliseconds: UInt64(max(0, now.timeIntervalSince1970 * 1_000)), using: &generator)
  }

  public static func uuidV7<G: RandomNumberGenerator>(milliseconds: UInt64, using generator: inout G)
    -> String
  {
    var bytes = [UInt8](repeating: 0, count: 16)
    for index in 0..<6 { bytes[index] = UInt8((milliseconds >> UInt64(8 * (5 - index))) & 0xff) }
    for index in 6..<16 { bytes[index] = UInt8.random(in: 0...255, using: &generator) }
    bytes[6] = (bytes[6] & 0x0f) | 0x70
    bytes[8] = (bytes[8] & 0x3f) | 0x80
    let hex = bytes.map { String(format: "%02x", $0) }.joined()
    let c = Array(hex)
    return [c[0..<8], c[8..<12], c[12..<16], c[16..<20], c[20..<32]].map { String($0) }.joined(separator: "-")
  }
}

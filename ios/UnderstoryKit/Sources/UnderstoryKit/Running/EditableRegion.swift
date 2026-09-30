import Foundation

/// The editable region of a code challenge: the starter lines the learner writes, with the
/// scaffold above and below locked (src/core/content/editable.ts, docs/MOBILE-EDITING.md).
///
/// The lock is anchored on text, not on line numbers: the locked head and tail must still
/// open and close the document. A draft whose scaffold changed some other way simply has
/// no lock, as on the web.

/// Starter lines, counted from 1, both ends included.
public struct LineRange: Hashable, Sendable {
  public var first: Int
  public var last: Int

  public init(first: Int, last: Int) {
    self.first = first
    self.last = last
  }

  /// `"5-9"` or `"5"`, ASCII digits with no leading zero. Anything else, a backwards
  /// range included, is nil.
  public init?(parsing text: String) {
    let parts = text.split(separator: "-", maxSplits: 2, omittingEmptySubsequences: false)
    func number(_ part: Substring) -> Int? {
      guard let head = part.first, head != "0", part.allSatisfy({ $0.isASCII && $0.isNumber })
      else { return nil }
      return Int(part)
    }
    guard (1...2).contains(parts.count), let first = number(parts[0]) else { return nil }
    let last: Int
    if parts.count == 2 {
      guard let end = number(parts[1]) else { return nil }
      last = end
    } else {
      last = first
    }
    guard last >= first else { return nil }
    self.init(first: first, last: last)
  }
}

/// The locked text before and after the editable lines, line breaks included.
public struct LockedFrame: Hashable, Sendable {
  public var head: String
  public var tail: String

  public init(head: String, tail: String) {
    self.head = head
    self.tail = tail
  }

  /// Splits the starter around the range. The head keeps the line break that ends it and
  /// the tail the one that starts it. Nil when the range reaches past the starter.
  public init?(starter: String, range: LineRange) {
    let lines = starter.split(separator: "\n", omittingEmptySubsequences: false)
    guard range.last <= lines.count else { return nil }
    let before = lines[0..<(range.first - 1)]
    let after = lines[range.last...]
    self.init(
      head: before.isEmpty ? "" : before.joined(separator: "\n") + "\n",
      tail: after.isEmpty ? "" : "\n" + after.joined(separator: "\n"))
  }

  /// Where the region sits in `document`, in UTF-16 offsets as a text view counts them,
  /// or nil when the locked text is no longer around it.
  public func locate(in document: String) -> NSRange? {
    let length = document.utf16.count
    let headLength = head.utf16.count
    let tailLength = tail.utf16.count
    guard length >= headLength + tailLength,
      document.utf16.starts(with: head.utf16),
      document.utf16.reversed().starts(with: tail.utf16.reversed())
    else { return nil }
    return NSRange(location: headLength, length: length - headLength - tailLength)
  }
}

extension CodeChallengeStep {
  /// The locked scaffold around `editable`, or nil when the step has none or its range
  /// does not fit the starter (then the whole starter is editable, as on the web).
  public var lockedFrame: LockedFrame? {
    guard let editable, let range = LineRange(parsing: editable) else { return nil }
    return LockedFrame(starter: starterCode, range: range)
  }
}

import Foundation

// The append-only event log (src/core/progress/events.ts, docs/SYNC-PROTOCOL.md).
// Events record facts only. XP, rank, mastery and the weekly run are derived by the
// reducer and never stored, so a sync merge cannot double-count.

public enum Mode: String, Codable, Sendable, CaseIterable {
  case guided
  case challengeFirst = "challenge-first"
}

/// Step types that produce a `step_answered` event. Prose earns nothing and has no
/// answer. Explain-back has its own event because it carries a rubric self-grade.
public enum AnsweredStepType: String, Codable, Sendable, CaseIterable {
  case predictOutput = "predict-output"
  case multipleChoice = "multiple-choice"
  case traceTable = "trace-table"
  case fillBlank = "fill-blank"
  case parsons
  case bugHunt = "bug-hunt"
  case aiReview = "ai-review"
  case codeChallenge = "code-challenge"
  case lab
  case incident
  case playground
  case sql

  /// `FORMAT_FAMILY` in src/core/content/schema.ts.
  public var family: FormatFamily {
    switch self {
    case .predictOutput, .multipleChoice, .lab: .recognise
    case .traceTable, .fillBlank, .parsons, .bugHunt, .aiReview: .arrange
    case .codeChallenge, .incident, .playground, .sql: .produce
    }
  }
}

public enum AnswerContext: String, Codable, Sendable {
  case lesson, practice
  case testOut = "test-out"
  case probe
}

public enum SessionKind: String, Codable, Sendable { case practice, lesson }
public enum DeviceKind: String, Codable, Sendable { case phone, desktop }

/// A setting is a string, a number or a boolean. Last writer wins per key.
public enum SettingValue: Codable, Hashable, Sendable {
  case string(String)
  case number(Double)
  case bool(Bool)

  public init(from decoder: Decoder) throws {
    let container = try decoder.singleValueContainer()
    if let value = try? container.decode(Bool.self) {
      self = .bool(value)
    } else if let value = try? container.decode(Double.self) {
      self = .number(value)
    } else {
      self = .string(try container.decode(String.self))
    }
  }

  public func encode(to encoder: Encoder) throws {
    var container = encoder.singleValueContainer()
    switch self {
    case .string(let value): try container.encode(value)
    case .number(let value):
      // A whole number goes out as `10`, not `10.0`, as JavaScript would write it.
      if let exact = Int64(exactly: value) { try container.encode(exact) } else { try container.encode(value) }
    case .bool(let value): try container.encode(value)
    }
  }
}

// MARK: - Payloads

/// A payload knows its own keys and bounds, because the web validates every event with a
/// strict schema and treats one that fails as unknown. The Swift side must make the same
/// call, or two devices holding the same log would derive different states.
protocol ValidatedPayload: Codable, Sendable {
  static var allowedKeys: Set<String> { get }
  var isValid: Bool { get }
}

public struct PlacementAnswered: Codable, Hashable, Sendable, ValidatedPayload {
  public var itemId: String
  public var moduleId: String
  public var rung: Int
  public var correct: Bool
  public var confidence: Confidence

  static let allowedKeys: Set<String> = ["itemId", "moduleId", "rung", "correct", "confidence"]
  var isValid: Bool { !itemId.isEmpty && Identifiers.isModuleId(moduleId) && rung >= 1 }
}

public struct PlacementCompleted: Codable, Hashable, Sendable, ValidatedPayload {
  public enum StartedAs: String, Codable, Sendable {
    case new
    case aiBuilder = "ai-builder"
    case experienced
  }

  public var startedAs: StartedAs
  public var thetaByModule: [String: Double]
  public var assumedConcepts: [String]

  static let allowedKeys: Set<String> = ["startedAs", "thetaByModule", "assumedConcepts"]
  var isValid: Bool {
    thetaByModule.keys.allSatisfy(Identifiers.isModuleId)
      && assumedConcepts.allSatisfy(Identifiers.isContentId)
  }
}

public struct StepAnswered: Codable, Hashable, Sendable, ValidatedPayload {
  public var lessonId: String
  public var stepId: String
  public var stepType: AnsweredStepType
  public var concept: String
  public var difficulty: Int
  public var tryNumber: Int
  public var hintsUsed: Int
  public var revealed: Bool
  public var score: Double
  public var correct: Bool
  public var confidence: Confidence?
  public var mode: Mode
  public var context: AnswerContext
  public var durationMs: Int?

  static let allowedKeys: Set<String> = [
    "lessonId", "stepId", "stepType", "concept", "difficulty", "tryNumber", "hintsUsed",
    "revealed", "score", "correct", "confidence", "mode", "context", "durationMs",
  ]
  var isValid: Bool {
    Identifiers.isContentId(lessonId) && Identifiers.isLocalId(stepId)
      && Identifiers.isContentId(concept) && (1...5).contains(difficulty) && tryNumber >= 1
      && hintsUsed >= 0 && (0...1).contains(score) && (durationMs ?? 0) >= 0
  }
}

public struct ReviewGraded: Codable, Hashable, Sendable, ValidatedPayload {
  /// `lesson:<lessonId>#<cardId>` for a fact card, `skill:<lessonId>#<stepId>` for a skill item.
  public var cardKey: String
  public var concept: String
  public var rating: FsrsRating
  public var retrievabilityBefore: Double?
  /// The card after this review, computed by the device that graded it.
  public var state: CardState

  static let allowedKeys: Set<String> = ["cardKey", "concept", "rating", "retrievabilityBefore", "state"]
  var isValid: Bool {
    Identifiers.isCardKey(cardKey) && Identifiers.isContentId(concept)
      && (retrievabilityBefore.map { (0...1).contains($0) } ?? true) && state.isValid
  }

  public var isFactCard: Bool { cardKey.hasPrefix("lesson:") }
}

public struct LessonCompleted: Codable, Hashable, Sendable, ValidatedPayload {
  public var lessonId: String

  static let allowedKeys: Set<String> = ["lessonId"]
  var isValid: Bool { Identifiers.isContentId(lessonId) }
}

public struct ExplainBackGraded: Codable, Hashable, Sendable, ValidatedPayload {
  public var lessonId: String
  public var stepId: String
  public var concept: String
  /// How many of the three rubric points the learner judged they made.
  public var rubricHits: Int
  public var text: String?

  static let allowedKeys: Set<String> = ["lessonId", "stepId", "concept", "rubricHits", "text"]
  var isValid: Bool {
    Identifiers.isContentId(lessonId) && Identifiers.isLocalId(stepId)
      && Identifiers.isContentId(concept) && (0...3).contains(rubricHits)
  }
}

public struct CapstoneCompleted: Codable, Hashable, Sendable, ValidatedPayload {
  public var moduleId: String

  static let allowedKeys: Set<String> = ["moduleId"]
  var isValid: Bool { Identifiers.isModuleId(moduleId) }
}

/// An architecture decision record for a part's capstone. Its own event rather than a field
/// on `capstone_completed`, so an older build ignores it instead of losing the capstone. A
/// later record for the same part replaces the earlier one in the state, never in the log.
public struct CapstoneAdrWritten: Codable, Hashable, Sendable, ValidatedPayload {
  /// `ADR_TITLE_MAX` and `ADR_SECTION_MAX` on the web.
  public static let titleMax = 120
  public static let sectionMax = 4000

  public var partId: String
  public var title: String
  public var context: String?
  public var decision: String
  public var alternatives: String?
  public var consequences: String?

  static let allowedKeys: Set<String> = [
    "partId", "title", "context", "decision", "alternatives", "consequences",
  ]
  var isValid: Bool {
    let section = { (text: String?) in
      text.map { Identifiers.isWrittenText($0, max: Self.sectionMax) } ?? true
    }
    return Identifiers.isModuleId(partId) && Identifiers.isWrittenText(title, max: Self.titleMax)
      && Identifiers.isWrittenText(decision, max: Self.sectionMax) && section(context)
      && section(alternatives) && section(consequences)
  }
}

public struct IncidentResolved: Codable, Hashable, Sendable, ValidatedPayload {
  public var incidentId: String
  public var concept: String
  public var score: Double

  static let allowedKeys: Set<String> = ["incidentId", "concept", "score"]
  var isValid: Bool {
    !incidentId.isEmpty && Identifiers.isContentId(concept) && (0...1).contains(score)
  }
}

public struct TestOutAttempted: Codable, Hashable, Sendable, ValidatedPayload {
  public var moduleId: String
  public var score: Double
  public var passed: Bool

  static let allowedKeys: Set<String> = ["moduleId", "score", "passed"]
  var isValid: Bool { Identifiers.isModuleId(moduleId) && (0...1).contains(score) }
}

public struct SessionStarted: Codable, Hashable, Sendable, ValidatedPayload {
  public var sessionId: String
  public var kind: SessionKind
  public var minutes: Int
  public var device: DeviceKind
  public var seed: Double

  public static let allowedMinutes: Set<Int> = [5, 10, 20, 45]
  static let allowedKeys: Set<String> = ["sessionId", "kind", "minutes", "device", "seed"]
  var isValid: Bool { !sessionId.isEmpty && Self.allowedMinutes.contains(minutes) }
}

public struct SessionFinished: Codable, Hashable, Sendable, ValidatedPayload {
  public var sessionId: String
  /// A count of items completed. Each item's facts are their own events.
  public var items: Int

  static let allowedKeys: Set<String> = ["sessionId", "items"]
  var isValid: Bool { !sessionId.isEmpty && items >= 0 }
}

public struct GoalTierSet: Codable, Hashable, Sendable, ValidatedPayload {
  public var tier: GoalTier

  static let allowedKeys: Set<String> = ["tier"]
  var isValid: Bool { true }
}

public struct ModeSet: Codable, Hashable, Sendable, ValidatedPayload {
  public var moduleId: String
  public var mode: Mode

  static let allowedKeys: Set<String> = ["moduleId", "mode"]
  var isValid: Bool { Identifiers.isModuleId(moduleId) }
}

public struct SettingChanged: Codable, Hashable, Sendable, ValidatedPayload {
  public var key: String
  public var value: SettingValue

  static let allowedKeys: Set<String> = ["key", "value"]
  var isValid: Bool { !key.isEmpty }
}

public struct AiHoursReported: Codable, Hashable, Sendable, ValidatedPayload {
  public var isoWeek: String
  public var withAi: Double
  public var withoutAi: Double

  static let allowedKeys: Set<String> = ["isoWeek", "withAi", "withoutAi"]
  var isValid: Bool { Identifiers.isIsoWeek(isoWeek) && withAi >= 0 && withoutAi >= 0 }
}

public struct ReadingCollected: Codable, Hashable, Sendable, ValidatedPayload {
  public var referenceKey: String

  static let allowedKeys: Set<String> = ["referenceKey"]
  var isValid: Bool { !referenceKey.isEmpty }
}

// MARK: - Envelope

/// Every event payload, keyed by the wire `type`.
public enum EventPayload: Hashable, Sendable {
  case placementAnswered(PlacementAnswered)
  case placementCompleted(PlacementCompleted)
  case stepAnswered(StepAnswered)
  case reviewGraded(ReviewGraded)
  case lessonCompleted(LessonCompleted)
  case explainBackGraded(ExplainBackGraded)
  case capstoneCompleted(CapstoneCompleted)
  case capstoneAdrWritten(CapstoneAdrWritten)
  case incidentResolved(IncidentResolved)
  case testOutAttempted(TestOutAttempted)
  case sessionStarted(SessionStarted)
  case sessionFinished(SessionFinished)
  case goalTierSet(GoalTierSet)
  case modeSet(ModeSet)
  case settingChanged(SettingChanged)
  case aiHoursReported(AiHoursReported)
  case readingCollected(ReadingCollected)

  public var type: String {
    switch self {
    case .placementAnswered: "placement_answered"
    case .placementCompleted: "placement_completed"
    case .stepAnswered: "step_answered"
    case .reviewGraded: "review_graded"
    case .lessonCompleted: "lesson_completed"
    case .explainBackGraded: "explain_back_graded"
    case .capstoneCompleted: "capstone_completed"
    case .capstoneAdrWritten: "capstone_adr_written"
    case .incidentResolved: "incident_resolved"
    case .testOutAttempted: "test_out_attempted"
    case .sessionStarted: "session_started"
    case .sessionFinished: "session_finished"
    case .goalTierSet: "goal_tier_set"
    case .modeSet: "mode_set"
    case .settingChanged: "setting_changed"
    case .aiHoursReported: "ai_hours_reported"
    case .readingCollected: "reading_collected"
    }
  }

  var encodable: any Encodable & Sendable {
    switch self {
    case .placementAnswered(let p): p
    case .placementCompleted(let p): p
    case .stepAnswered(let p): p
    case .reviewGraded(let p): p
    case .lessonCompleted(let p): p
    case .explainBackGraded(let p): p
    case .capstoneCompleted(let p): p
    case .capstoneAdrWritten(let p): p
    case .incidentResolved(let p): p
    case .testOutAttempted(let p): p
    case .sessionStarted(let p): p
    case .sessionFinished(let p): p
    case .goalTierSet(let p): p
    case .modeSet(let p): p
    case .settingChanged(let p): p
    case .aiHoursReported(let p): p
    case .readingCollected(let p): p
    }
  }
}

/// Every event type's current version (`LATEST_VERSION` on the web). A breaking payload
/// change bumps the number there and here, and adds an upcaster on both sides.
public let latestEventVersion: [String: Int] = [
  "placement_answered": 1, "placement_completed": 1, "step_answered": 1, "review_graded": 1,
  "lesson_completed": 1, "explain_back_graded": 1, "capstone_completed": 1,
  "capstone_adr_written": 1, "incident_resolved": 1, "test_out_attempted": 1, "session_started": 1, "session_finished": 1,
  "goal_tier_set": 1, "mode_set": 1, "setting_changed": 1, "ai_hours_reported": 1,
  "reading_collected": 1,
]

/// `{id, type, v, at, localDate, deviceId, seq, contentRev, payload}`.
public struct StoryEvent: Hashable, Sendable, Identifiable, Encodable {
  /// UUIDv7.
  public var id: String
  public var v: Int
  /// ISO-8601 UTC, written exactly as JavaScript's `toISOString()` writes it
  /// (`Instant.string`). Kept as text because the reducer orders events by it.
  public var at: String
  /// `YYYY-MM-DD` on the learner's own calendar, so the weekly goal needs no time zone.
  public var localDate: String
  public var deviceId: String
  /// This device's own counter.
  public var seq: Int
  /// The manifest's `contentRev` the answer was given against.
  public var contentRev: String
  public var payload: EventPayload

  public var type: String { payload.type }

  public init(
    id: String, at: String, localDate: String, deviceId: String, seq: Int, contentRev: String,
    payload: EventPayload
  ) {
    self.id = id
    self.v = latestEventVersion[payload.type] ?? 1
    self.at = at
    self.localDate = localDate
    self.deviceId = deviceId
    self.seq = seq
    self.contentRev = contentRev
    self.payload = payload
  }

  static let allowedKeys: Set<String> = [
    "id", "type", "v", "at", "localDate", "deviceId", "seq", "contentRev", "payload",
  ]

  private enum Keys: String, CodingKey {
    case id, type, v, at, localDate, deviceId, seq, contentRev, payload
  }

  public func encode(to encoder: Encoder) throws {
    var container = encoder.container(keyedBy: Keys.self)
    try container.encode(id, forKey: .id)
    try container.encode(type, forKey: .type)
    try container.encode(v, forKey: .v)
    try container.encode(at, forKey: .at)
    try container.encode(localDate, forKey: .localDate)
    try container.encode(deviceId, forKey: .deviceId)
    try container.encode(seq, forKey: .seq)
    try container.encode(contentRev, forKey: .contentRev)
    try payload.encodable.encode(to: container.superEncoder(forKey: .payload))
  }
}

/// An event this build cannot read: an unknown type, a newer version, or a shape that
/// fails validation. It is kept exactly as it arrived and ignored by the reducer, so an
/// older client survives a newer one and passes the event on untouched when it syncs.
public struct UnknownEvent: Hashable, Sendable, Encodable {
  public var originalType: String
  public var reason: String
  public var raw: JSONValue

  public var id: String? { raw["id"]?.stringValue }

  public func encode(to encoder: Encoder) throws { try raw.encode(to: encoder) }
}

/// What the log holds after reading: a typed event or a preserved unknown one.
public enum LoggedEvent: Hashable, Sendable, Codable {
  case known(StoryEvent)
  case unknown(UnknownEvent)

  public init(from decoder: Decoder) throws {
    self = Upcast.upcast(try JSONValue(from: decoder))
  }

  public func encode(to encoder: Encoder) throws {
    switch self {
    case .known(let event): try event.encode(to: encoder)
    case .unknown(let event): try event.encode(to: encoder)
    }
  }

  public var known: StoryEvent? {
    if case .known(let event) = self { return event }
    return nil
  }

  public var id: String? {
    switch self {
    case .known(let event): event.id
    case .unknown(let event): event.id
    }
  }
}

/// The file the web app's Settings screen exports and imports
/// (src/features/store/progress-store.ts). The same file moves progress between web and
/// iOS until sync exists.
public struct ExportFile: Codable, Sendable {
  public static let format = "understory-export"
  public static let version = 1

  public var format: String
  public var version: Int
  public var exportedAt: String
  public var events: [LoggedEvent]

  public init(exportedAt: String, events: [LoggedEvent]) {
    self.format = Self.format
    self.version = Self.version
    self.exportedAt = exportedAt
    self.events = events
  }

  public var isSupported: Bool { format == Self.format && version == Self.version }
}

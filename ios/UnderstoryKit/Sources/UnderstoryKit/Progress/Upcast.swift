import Foundation

/// Pure upcasters, chained per (type, v) up to the latest shape (src/core/progress/upcast.ts).
/// Stored events are never rewritten. This only changes the value the reducer sees.
public enum Upcast {
  /// One step in a type's history: turns a v = n event into v = n + 1. `chain[n]` is the
  /// upcaster from version n to n + 1.
  public typealias Upcaster = @Sendable ([String: JSONValue]) -> [String: JSONValue]

  /// No shipped event type has changed shape yet, so every chain is empty. When the web
  /// adds an entry to `UPCASTERS`, the same entry is added here in the same commit
  /// (docs/ios/CONTRACT.md, "Versioning").
  static let upcasters: [String: [Upcaster]] = [:]

  /// Applies `chain` from the event's own `v` (0 if absent) until `latestVersion`, or until
  /// the chain runs out. Never throws.
  public static func applyChain(
    _ raw: [String: JSONValue], chain: [Upcaster], latestVersion: Int
  ) -> [String: JSONValue] {
    var event = raw
    var v = 0
    if case .int(let stored)? = raw["v"] { v = Int(stored) }
    while v < latestVersion, v >= 0, v < chain.count {
      event = chain[v](event)
      v += 1
    }
    event["v"] = .int(Int64(v))
    return event
  }

  /// Turns a stored JSON value into a validated, latest-shape event, or an `UnknownEvent`
  /// when the type is not recognised, the version is newer than this build reads, or the
  /// shape fails validation. The checks are as strict as the zod schemas on the web:
  /// an extra key makes an event unknown here because it does there.
  public static func upcast(_ raw: JSONValue) -> LoggedEvent {
    func unknown(_ type: String, _ reason: String) -> LoggedEvent {
      .unknown(UnknownEvent(originalType: type, reason: reason, raw: raw))
    }
    guard let object = raw.objectValue else { return unknown("unknown", "not an object") }
    guard let type = object["type"]?.stringValue, let latest = latestEventVersion[type] else {
      return unknown(object["type"]?.stringValue ?? "unknown", "unknown event type")
    }
    let event = applyChain(object, chain: upcasters[type] ?? [], latestVersion: latest)

    guard Set(event.keys).isSubset(of: StoryEvent.allowedKeys) else {
      return unknown(type, "unrecognised key in the envelope")
    }
    guard case .int(let v)? = event["v"], Int(v) == latest else {
      return unknown(type, "version is not \(latest)")
    }
    guard let id = event["id"]?.stringValue, Identifiers.isUuidV7(id) else {
      return unknown(type, "id is not a UUIDv7")
    }
    guard let at = event["at"]?.stringValue, Instant.milliseconds(at) != nil else {
      return unknown(type, "at is not an ISO-8601 UTC instant")
    }
    guard let localDate = event["localDate"]?.stringValue, Instant.isLocalDate(localDate) else {
      return unknown(type, "localDate is not YYYY-MM-DD")
    }
    guard let deviceId = event["deviceId"]?.stringValue, !deviceId.isEmpty else {
      return unknown(type, "deviceId is missing")
    }
    guard case .int(let seq)? = event["seq"], seq >= 0 else {
      return unknown(type, "seq is not a non-negative integer")
    }
    guard let contentRev = event["contentRev"]?.stringValue, !contentRev.isEmpty else {
      return unknown(type, "contentRev is missing")
    }
    guard let payloadValue = event["payload"], payloadValue.objectValue != nil else {
      return unknown(type, "payload is missing")
    }
    guard let payload = decodePayload(type: type, from: payloadValue) else {
      return unknown(type, "payload does not fit \(type) v\(latest)")
    }
    var known = StoryEvent(
      id: id, at: at, localDate: localDate, deviceId: deviceId, seq: Int(seq),
      contentRev: contentRev, payload: payload)
    known.v = latest
    return .known(known)
  }

  /// Reads a whole export file or a plain array of events.
  public static func events(fromJSON data: Data) throws -> [LoggedEvent] {
    let value = try JSONDecoder().decode(JSONValue.self, from: data)
    if case .array(let items) = value { return items.map(upcast) }
    if case .array(let items)? = value["events"] { return items.map(upcast) }
    throw DecodingError.dataCorrupted(
      .init(codingPath: [], debugDescription: "Expected an array of events or an export file."))
  }

  private static func decodePayload(type: String, from value: JSONValue) -> EventPayload? {
    func read<P: ValidatedPayload>(_: P.Type, _ wrap: (P) -> EventPayload) -> EventPayload? {
      guard let object = value.objectValue, Set(object.keys).isSubset(of: P.allowedKeys),
        !containsNull(value), let payload = try? value.decode(P.self), payload.isValid
      else { return nil }
      return wrap(payload)
    }
    switch type {
    case "placement_answered": return read(PlacementAnswered.self) { .placementAnswered($0) }
    case "placement_completed": return read(PlacementCompleted.self) { .placementCompleted($0) }
    case "step_answered": return read(StepAnswered.self) { .stepAnswered($0) }
    case "review_graded":
      guard let keys = value["state"]?.objectValue?.keys,
        Set(keys).isSubset(of: CardState.allowedKeys)
      else { return nil }
      return read(ReviewGraded.self) { .reviewGraded($0) }
    case "lesson_completed": return read(LessonCompleted.self) { .lessonCompleted($0) }
    case "explain_back_graded": return read(ExplainBackGraded.self) { .explainBackGraded($0) }
    case "capstone_completed": return read(CapstoneCompleted.self) { .capstoneCompleted($0) }
    case "capstone_adr_written": return read(CapstoneAdrWritten.self) { .capstoneAdrWritten($0) }
    case "incident_resolved": return read(IncidentResolved.self) { .incidentResolved($0) }
    case "test_out_attempted": return read(TestOutAttempted.self) { .testOutAttempted($0) }
    case "session_started": return read(SessionStarted.self) { .sessionStarted($0) }
    case "session_finished": return read(SessionFinished.self) { .sessionFinished($0) }
    case "goal_tier_set": return read(GoalTierSet.self) { .goalTierSet($0) }
    case "mode_set": return read(ModeSet.self) { .modeSet($0) }
    case "setting_changed": return read(SettingChanged.self) { .settingChanged($0) }
    case "ai_hours_reported": return read(AiHoursReported.self) { .aiHoursReported($0) }
    case "reading_collected": return read(ReadingCollected.self) { .readingCollected($0) }
    default: return nil
    }
  }

  /// "Optional fields are omitted, never null." A null anywhere fails zod on the web, and
  /// `decodeIfPresent` would let it through here, so it is refused by hand.
  private static func containsNull(_ value: JSONValue) -> Bool {
    switch value {
    case .null: true
    case .array(let items): items.contains(where: containsNull)
    case .object(let object): object.values.contains(where: containsNull)
    default: false
    }
  }
}

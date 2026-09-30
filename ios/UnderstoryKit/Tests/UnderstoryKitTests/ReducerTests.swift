import Foundation
import Testing

@testable import UnderstoryKit

/// The parts of the reducer the seven fixtures do not reach: strict validation, the export
/// file, the grinding cooldown and the read side.
struct EventDecodingTests {
  static func event(type: String, payload: String, at: String = "2026-09-17T10:00:00.000Z")
    -> LoggedEvent
  {
    let json = """
      {"id":"018f0e60-0000-7000-8000-000000000001","type":"\(type)","v":1,"at":"\(at)",
       "localDate":"\(at.prefix(10))","deviceId":"device-1","seq":1,"contentRev":"rev",
       "payload":\(payload)}
      """
    return try! JSONDecoder().decode(LoggedEvent.self, from: Data(json.utf8))
  }

  @Test("a well formed event of every type decodes as known")
  func everyType() {
    let samples: [(String, String)] = [
      ("placement_answered", #"{"itemId":"i1","moduleId":"js","rung":1,"correct":true,"confidence":"fairly"}"#),
      ("placement_completed", #"{"startedAs":"ai-builder","thetaByModule":{"js":1200},"assumedConcepts":["js.types"]}"#),
      ("step_answered", #"{"lessonId":"js.coercion","stepId":"q-1","stepType":"parsons","concept":"js.types","difficulty":2,"tryNumber":1,"hintsUsed":0,"revealed":false,"score":1,"correct":true,"mode":"guided","context":"lesson"}"#),
      ("lesson_completed", #"{"lessonId":"js.coercion"}"#),
      ("explain_back_graded", #"{"lessonId":"js.coercion","stepId":"e-1","concept":"js.types","rubricHits":3}"#),
      ("capstone_completed", #"{"moduleId":"js"}"#),
      ("capstone_adr_written", #"{"partId":"servers","title":"Keep sessions in a table","decision":"A sessions table."}"#),
      ("incident_resolved", #"{"incidentId":"oversell","concept":"db.transactions","score":1}"#),
      ("test_out_attempted", #"{"moduleId":"js","score":0.9,"passed":true}"#),
      ("session_started", #"{"sessionId":"s1","kind":"practice","minutes":10,"device":"phone","seed":1}"#),
      ("session_finished", #"{"sessionId":"s1","items":7}"#),
      ("goal_tier_set", #"{"tier":"deep"}"#),
      ("mode_set", #"{"moduleId":"js","mode":"challenge-first"}"#),
      ("setting_changed", #"{"key":"reduceMotion","value":true}"#),
      ("ai_hours_reported", #"{"isoWeek":"2026-W38","withAi":4,"withoutAi":2}"#),
      ("reading_collected", #"{"referenceKey":"ecma-262"}"#),
    ]
    for (type, payload) in samples {
      let decoded = Self.event(type: type, payload: payload)
      #expect(decoded.known?.type == type, "\(type) did not decode: \(decoded)")
    }
  }

  @Test(
    "an event the web's strict schema would reject is kept as unknown, not half-applied",
    arguments: [
      // An extra key in the payload (zod uses strictObject everywhere).
      (#"{"lessonId":"js.coercion","stepId":"q-1","stepType":"parsons","concept":"js.types","difficulty":2,"tryNumber":1,"hintsUsed":0,"revealed":false,"score":1,"correct":true,"mode":"guided","context":"lesson","extra":1}"#, "extra key"),
      // A null where the contract says the field is omitted.
      (#"{"lessonId":"js.coercion","stepId":"q-1","stepType":"parsons","concept":"js.types","difficulty":2,"tryNumber":1,"hintsUsed":0,"revealed":false,"score":1,"correct":true,"mode":"guided","context":"lesson","confidence":null}"#, "null field"),
      // A score outside 0..1.
      (#"{"lessonId":"js.coercion","stepId":"q-1","stepType":"parsons","concept":"js.types","difficulty":2,"tryNumber":1,"hintsUsed":0,"revealed":false,"score":1.5,"correct":true,"mode":"guided","context":"lesson"}"#, "score out of range"),
      // A step type only the newer build knows.
      (#"{"lessonId":"js.coercion","stepId":"q-1","stepType":"whiteboard","concept":"js.types","difficulty":2,"tryNumber":1,"hintsUsed":0,"revealed":false,"score":1,"correct":true,"mode":"guided","context":"lesson"}"#, "newer step type"),
    ])
  func strictValidation(payload: String, what: String) {
    let decoded = Self.event(type: "step_answered", payload: payload)
    #expect(decoded.known == nil, "\(what) should have made the event unknown")
    #expect(Reducer.reduce([decoded]) == ProgressState())
  }

  @Test("a bad envelope makes the event unknown")
  func badEnvelope() {
    let notUuidV7 = """
      {"id":"not-a-uuid","type":"lesson_completed","v":1,"at":"2026-09-17T10:00:00.000Z",
       "localDate":"2026-09-17","deviceId":"d","seq":1,"contentRev":"r",
       "payload":{"lessonId":"js.coercion"}}
      """
    let newerVersion = """
      {"id":"018f0e60-0000-7000-8000-000000000001","type":"lesson_completed","v":2,
       "at":"2026-09-17T10:00:00.000Z","localDate":"2026-09-17","deviceId":"d","seq":1,
       "contentRev":"r","payload":{"lessonId":"js.coercion"}}
      """
    for json in [notUuidV7, newerVersion] {
      let decoded = try! JSONDecoder().decode(LoggedEvent.self, from: Data(json.utf8))
      #expect(decoded.known == nil)
    }
  }

  @Test("the export file the web writes reads here")
  func exportFile() throws {
    let json = """
      {"format":"understory-export","version":1,"exportedAt":"2026-09-17T12:00:00.000Z",
       "events":[{"id":"018f0e60-0000-7000-8000-000000000001","type":"capstone_completed",
       "v":1,"at":"2026-09-17T10:00:00.000Z","localDate":"2026-09-17","deviceId":"d",
       "seq":1,"contentRev":"r","payload":{"moduleId":"js"}}]}
      """
    let file = try JSONDecoder().decode(ExportFile.self, from: Data(json.utf8))
    #expect(file.isSupported)
    #expect(file.events.count == 1)
    #expect(Reducer.reduce(file.events).completedCapstones == ["js"])

    // The same reader takes a bare array of events.
    let bare = try Upcast.events(fromJSON: Data("[]".utf8))
    #expect(bare.isEmpty)
  }

  @Test("an unreadable event still re-encodes to exactly what arrived")
  func unknownRoundTrips() throws {
    let json = #"{"id":"x","type":"from_the_future","v":9,"payload":{"a":[1,2,{"b":null}]}}"#
    let decoded = try JSONDecoder().decode(LoggedEvent.self, from: Data(json.utf8))
    let re = try JSONEncoder().encode(decoded)
    #expect(
      NSDictionary(dictionary: try JSONSerialization.jsonObject(with: re) as! [String: Any])
        == NSDictionary(
          dictionary: try JSONSerialization.jsonObject(with: Data(json.utf8)) as! [String: Any]))
  }

  @Test("a UUIDv7 this package makes is one the web's schema accepts")
  func uuidV7() {
    let id = Identifiers.uuidV7(now: Date())
    #expect(Identifiers.isUuidV7(id), "\(id) is not a v7 UUID")
    #expect(id.count == 36)
    // Two made in the same millisecond still differ.
    #expect(Identifiers.uuidV7(now: Date()) != Identifiers.uuidV7(now: Date()))
  }
}

struct ReducerRuleTests {
  static func event(_ payload: EventPayload, at: String, id: String, seq: Int = 1)
    -> StoryEvent
  {
    StoryEvent(
      id: id, at: at, localDate: String(at.prefix(10)), deviceId: "device-1", seq: seq,
      contentRev: "rev", payload: payload)
  }

  static func answered(score: Double, correct: Bool, stepId: String) -> EventPayload {
    .stepAnswered(
      StepAnswered(
        lessonId: "js.coercion", stepId: stepId, stepType: .codeChallenge, concept: "js.types",
        difficulty: 3, tryNumber: 1, hintsUsed: 0, revealed: false, score: score, correct: correct,
        mode: .guided, context: .lesson))
  }

  @Test("the same item inside 24 hours earns nothing the second time")
  func grindingCooldown() {
    let first = Self.event(
      Self.answered(score: 1, correct: true, stepId: "s-1"), at: "2026-09-17T10:00:00.000Z",
      id: "018f0e60-0000-7000-8000-000000000001")
    let againSoon = Self.event(
      Self.answered(score: 1, correct: true, stepId: "s-1"), at: "2026-09-18T09:59:00.000Z",
      id: "018f0e60-0000-7000-8000-000000000002", seq: 2)
    let againLater = Self.event(
      Self.answered(score: 1, correct: true, stepId: "s-1"), at: "2026-09-18T10:00:01.000Z",
      id: "018f0e60-0000-7000-8000-000000000003", seq: 3)

    #expect(Reducer.reduce([first]).xpTotal == 15)
    #expect(Reducer.reduce([first, againSoon]).xpTotal == 15)
    // The window slides. `lastGradedAt` is written on every attempt, including one that
    // earned nothing, so the third attempt is still inside 24 hours of the second and
    // also earns nothing (docs/ios/CONTRACT.md, ambiguity A2).
    #expect(Reducer.reduce([first, againSoon, againLater]).xpTotal == 15)
    // Skipping the middle attempt, the third one is outside the window and earns.
    #expect(Reducer.reduce([first, againLater]).xpTotal == 30)
    // The cooldown is per item, not per concept.
    let otherItem = Self.event(
      Self.answered(score: 1, correct: true, stepId: "s-2"), at: "2026-09-17T10:01:00.000Z",
      id: "018f0e60-0000-7000-8000-000000000004", seq: 4)
    #expect(Reducer.reduce([first, otherItem]).xpTotal == 30)
  }

  @Test("a skill card review earns no XP; a fact card does")
  func cardKindsEarnDifferently() {
    func review(_ cardKey: String, id: String) -> StoryEvent {
      Self.event(
        .reviewGraded(
          ReviewGraded(
            cardKey: cardKey, concept: "js.types", rating: .good,
            state: CardState(
              due: "2026-09-24T10:00:00.000Z", stability: 7, difficulty: 5, reps: 1, lapses: 0,
              state: .review, scheduledDays: 7, elapsedDays: 0,
              lastReview: "2026-09-17T10:00:00.000Z"))),
        at: "2026-09-17T10:00:00.000Z", id: id)
    }
    #expect(
      Reducer.reduce([review("lesson:js.coercion#card-1", id: "018f0e60-0000-7000-8000-000000000001")])
        .xpTotal == 1)
    #expect(
      Reducer.reduce([review("skill:js.coercion#s-1", id: "018f0e60-0000-7000-8000-000000000002")])
        .xpTotal == 0)
  }

  @Test("once solid, a concept that decays reads as a gap")
  func gapAfterDecay() {
    // Two families and a produce pass, so nothing caps mastery, and a reviewed card so
    // there is memory evidence to lose. P is deliberately left near 0.66: see the test
    // below for why a concept drilled to P = 1 can never become a Gap.
    let events: [StoryEvent] = [
      Self.event(
        .stepAnswered(
          StepAnswered(
            lessonId: "js.coercion", stepId: "s-1", stepType: .multipleChoice, concept: "js.types",
            difficulty: 2, tryNumber: 1, hintsUsed: 0, revealed: false, score: 1, correct: true,
            mode: .guided, context: .lesson)), at: "2026-09-17T10:00:00.000Z",
        id: "018f0e60-0000-7000-8000-000000000001", seq: 1),
      Self.event(
        Self.answered(score: 1, correct: true, stepId: "s-2"), at: "2026-09-18T10:00:00.000Z",
        id: "018f0e60-0000-7000-8000-000000000002", seq: 2),
      Self.event(
        Self.answered(score: 1, correct: true, stepId: "s-3"), at: "2026-09-25T10:00:00.000Z",
        id: "018f0e60-0000-7000-8000-000000000003", seq: 3),
      Self.event(
        .reviewGraded(
          ReviewGraded(
            cardKey: "lesson:js.coercion#card-1", concept: "js.types", rating: .good,
            state: CardState(
              due: "2026-10-02T10:00:00.000Z", stability: 7, difficulty: 5, reps: 1, lapses: 0,
              state: .review, scheduledDays: 7, elapsedDays: 0,
              lastReview: "2026-09-25T10:00:00.000Z"))), at: "2026-09-25T10:00:00.000Z",
        id: "018f0e60-0000-7000-8000-000000000004", seq: 4),
    ]

    let state = Reducer.reduce(events)
    let justAfter = Instant.date("2026-09-25T10:00:00.000Z")!
    #expect(state.concepts["js.types"]?.wasEverSolidOrFluent == true)
    #expect(Insight.snapshot(of: "js.types", in: state, now: justAfter).state == .solid)

    // A year later the card's R has fallen far enough that mastery drops below 0.6.
    let muchLater = Instant.date("2027-09-25T10:00:00.000Z")!
    #expect(Insight.snapshot(of: "js.types", in: state, now: muchLater).state == .gap)
  }

  /// A property of the formula rather than of this port, recorded because it decides how
  /// reachable the Gap state is (docs/ios/CONTRACT.md, ambiguity A1). `mastery` is
  /// `0.4 * M + 0.6 * P` and `P` never decays, so mastery has a floor of `0.6 * P`. With
  /// `P` near 1 the Gap threshold of 0.6 is only crossed once `M` falls below about 0.1,
  /// which on a card with three weeks of stability takes over twenty years.
  @Test("mastery has a floor of 0.6 * P, because P never decays")
  func masteryHasAFloor() {
    var events: [StoryEvent] = [
      Self.event(
        .stepAnswered(
          StepAnswered(
            lessonId: "js.coercion", stepId: "s-0", stepType: .multipleChoice, concept: "js.types",
            difficulty: 2, tryNumber: 1, hintsUsed: 0, revealed: false, score: 1, correct: true,
            mode: .guided, context: .lesson)), at: "2026-09-17T10:00:00.000Z",
        id: "018f0e60-0000-7000-8000-000000000001", seq: 1)
    ]
    for n in 2...9 {
      events.append(
        Self.event(
          Self.answered(score: 1, correct: true, stepId: "s-\(n)"),
          at: "2026-09-\(16 + n)T10:00:00.000Z",
          id: "018f0e60-0000-7000-8000-00000000000\(n)", seq: n))
    }
    let state = Reducer.reduce(events)
    let p = state.concepts["js.types"]?.p ?? 0
    #expect(p > 0.95, "P should be near 1 after nine clean produce attempts")

    // Ten years on, with no memory evidence left at all, mastery is still 0.6 * P.
    let farFuture = Instant.date("2036-09-25T10:00:00.000Z")!
    let snapshot = Insight.snapshot(of: "js.types", in: state, now: farFuture)
    #expect(snapshot.mastery >= 0.6 * p - 1e-12)
    #expect(abs(snapshot.mastery - 0.6 * p) < 1e-6, "with no cards, mastery is exactly 0.6 * P")
    #expect(snapshot.state == .practised)

    // How forgotten a concept at this P has to be before the Gap rule could fire at all.
    let mRequired = (Mastery.gapThreshold - Mastery.skillWeight * p) / Mastery.memoryWeight
    #expect(mRequired < 0.11, "M must fall under \(mRequired) for mastery to reach the Gap line")
    // On a three-week stability that is more than twenty years of not looking.
    let daysToForget = (pow(1 / mRequired, 2) - 1) / Scheduling.curveFactor * 21
    #expect(daysToForget > 20 * 365)
  }

  @Test("the due summary counts what is due now and names what is next")
  func dueSummary() {
    func review(_ cardKey: String, due: String, lastReview: String, id: String, seq: Int)
      -> StoryEvent
    {
      Self.event(
        .reviewGraded(
          ReviewGraded(
            cardKey: cardKey, concept: "js.types", rating: .good,
            state: CardState(
              due: due, stability: 7, difficulty: 5, reps: 1, lapses: 0, state: .review,
              scheduledDays: 7, elapsedDays: 0, lastReview: lastReview))),
        at: lastReview, id: id, seq: seq)
    }
    let state = Reducer.reduce([
      review(
        "lesson:js.coercion#a", due: "2026-09-16T10:00:00.000Z",
        lastReview: "2026-08-10T10:00:00.000Z", id: "018f0e60-0000-7000-8000-000000000001", seq: 1),
      review(
        "lesson:js.coercion#b", due: "2026-09-25T10:00:00.000Z",
        lastReview: "2026-09-18T10:00:00.000Z", id: "018f0e60-0000-7000-8000-000000000002", seq: 2),
    ])
    let summary = Insight.dueSummary(state, now: Instant.date("2026-09-19T10:00:00.000Z")!)
    #expect(summary.started == 2)
    #expect(summary.dueNow == 1)
    // R of the overdue card is 0.65 after 40 days on a stability of seven.
    #expect(summary.nearlyForgotten == 1)
    #expect(summary.nextDue == "2026-09-25T10:00:00.000Z")
  }
}

struct CapstoneAdrTests {
  static func adr(_ payload: String, at: String, id: String, device: String = "device-1")
    -> LoggedEvent
  {
    let json = """
      {"id":"\(id)","type":"capstone_adr_written","v":1,"at":"\(at)",
       "localDate":"\(at.prefix(10))","deviceId":"\(device)","seq":1,"contentRev":"rev",
       "payload":\(payload)}
      """
    return try! JSONDecoder().decode(LoggedEvent.self, from: Data(json.utf8))
  }

  @Test(
    "a record the web's schema would refuse is kept as unknown",
    arguments: [
      #"{"partId":"servers","title":"   ","decision":"A table."}"#,
      #"{"partId":"servers","title":"A title","decision":" \n"}"#,
      #"{"partId":"servers","title":"A title","decision":"A table.","context":" "}"#,
      #"{"partId":"servers","title":"A title"}"#,
      #"{"partId":"Servers","title":"A title","decision":"A table."}"#,
    ])
  func refused(payload: String) {
    let event = Self.adr(
      payload, at: "2026-09-17T10:00:00.000Z", id: "018f0e60-0000-7000-8000-000000000001")
    #expect(event.known == nil)
  }

  @Test("caps the title at 120 UTF-16 code units, as JavaScript counts them")
  func caps() {
    // Each emoji is two UTF-16 code units, so 60 of them are exactly 120.
    let emoji = String(repeating: "\u{1F600}", count: 60)
    let fits = Self.adr(
      #"{"partId":"servers","title":"\#(emoji)","decision":"A table."}"#,
      at: "2026-09-17T10:00:00.000Z", id: "018f0e60-0000-7000-8000-000000000001")
    let over = Self.adr(
      #"{"partId":"servers","title":"\#(emoji)x","decision":"A table."}"#,
      at: "2026-09-17T10:00:00.000Z", id: "018f0e60-0000-7000-8000-000000000002")
    #expect(fits.known != nil)
    #expect(over.known == nil)
  }

  @Test("the latest record per part wins, in any merge order, and earns nothing")
  func lastWriterWins() {
    let first = Self.adr(
      #"{"partId":"servers","title":"In memory","decision":"A map.","context":"One process."}"#,
      at: "2026-09-17T10:00:00.000Z", id: "018f0e60-0000-7000-8000-000000000001", device: "phone")
    let edit = Self.adr(
      #"{"partId":"servers","title":"In a table","decision":"A sessions table.","consequences":"One query more."}"#,
      at: "2026-09-19T10:00:00.000Z", id: "018f0e60-0000-7000-8000-000000000002",
      device: "laptop")
    for log in [[first, edit], [edit, first], [edit, first, edit]] {
      let state = Reducer.reduce(log)
      let record = state.capstoneAdrs["servers"]
      #expect(record?.title == "In a table")
      #expect(record?.context == nil)
      #expect(record?.consequences == "One query more.")
      #expect(record?.firstWrittenOn == "2026-09-17")
      #expect(record?.updatedOn == "2026-09-19")
      #expect(record?.revisions == 2)
      #expect(state.xpTotal == 0)
      #expect(state.completedCapstones.isEmpty)
    }
  }
}

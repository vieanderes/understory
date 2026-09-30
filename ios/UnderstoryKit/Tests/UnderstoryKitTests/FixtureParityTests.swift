import Foundation
import Testing

@testable import UnderstoryKit

/// The cross-platform contract (docs/SYNC-PROTOCOL.md, "iOS reducer"). Every file in
/// `contracts/fixtures/` holds an event log and the state the TypeScript reducer derived
/// from it. The Swift reducer has to reproduce that block exactly.
///
/// The derivation below mirrors `deriveExpected` in
/// `tests/unit/core/progress/fixtures.test.ts` line for line, including the two places
/// where that function differs from `src/core/insight/overview.ts` (it walks every
/// calendar day to build week records, and it stands in for catalog data it does not
/// have). Any drift between the two is a contract break, and the point of this file is to
/// see it.
struct FixtureParityTests {

  // MARK: The fixture file

  struct Expected: Decodable {
    struct Weeks: Decodable, Equatable {
      var run: Int
      var bestRun: Int
      var reserve: Int
    }
    var xpTotal: Int
    var weeks: Weeks
    var rank: String
    var masteryByConcept: [String: Double]
    var states: [String: String]
    var calibrationGap: Int?
    /// Present only in fixtures whose log holds a decision record.
    var adrs: [String: CapstoneAdr]?
  }

  struct Fixture: Decodable {
    var name: String
    var events: [LoggedEvent]
    var now: String
    var expected: Expected
  }

  /// KNOWN ISSUE K1 (docs/ios/CONTRACT.md). A fixture's `expected.weeks` depends on the
  /// learner's goal tier, and the fixture JSON carries neither a `goalTier` field nor a
  /// `goal_tier_set` event. The TypeScript generator holds the tier in its scenario table
  /// instead. Until `contracts/fixtures/*.json` gains a `goalTier` key, the tiers are
  /// repeated here, keyed by fixture name, taken from that table.
  ///
  /// This weakens nothing for six of the seven fixtures: their XP is below every tier's
  /// goal, so the week reads as missed whichever tier applies. It matters only for
  /// `weekly-goal-run-and-miss`, which clears Light's 150 and not Steady's 300.
  static let goalTierByFixture: [String: GoalTier] = [
    "single-recall-review": .light,
    "building-mastery-from-scratch": .light,
    "challenge-first-wrong-attempt": .light,
    "capstone-and-incident": .steady,
    "calibration-overconfidence": .light,
    "weekly-goal-run-and-miss": .light,
    "capstone-decision-record": .light,
  ]

  static let files = RepoPaths.jsonFiles(in: RepoPaths.fixtures)

  @Test("contracts/fixtures holds the seven committed scenarios")
  func fixturesArePresent() throws {
    try #require(
      RepoPaths.exists(RepoPaths.fixtures),
      "contracts/fixtures is not in this checkout.")
    #expect(Self.files.count >= 7)
    for file in Self.files {
      let name = file.deletingPathExtension().lastPathComponent
      #expect(
        Self.goalTierByFixture[name] != nil,
        "\(name) has no goal tier in goalTierByFixture. See known issue K1.")
    }
  }

  @Test("the Swift reducer reproduces every fixture's expected block", arguments: files)
  func parity(file: URL) throws {
    let fixture = try JSONDecoder().decode(Fixture.self, from: try Data(contentsOf: file))
    let tier = try #require(
      Self.goalTierByFixture[fixture.name], "no goal tier for \(fixture.name), see K1")
    let now = try #require(Instant.date(fixture.now), "fixture `now` is not an instant")

    // Every event in a committed fixture must be readable. An `UnknownEvent` here would
    // mean the Swift envelope or payload validation has drifted from zod's.
    for event in fixture.events {
      #expect(event.known != nil, "\(fixture.name): an event did not decode as a known event")
    }

    let state = Reducer.reduce(fixture.events)
    let derived = FixtureDerivation.derive(state, now: now, goalTier: tier)
    let expected = fixture.expected

    #expect(derived.xpTotal == expected.xpTotal, "\(fixture.name): XP total")
    #expect(derived.weeks.run == expected.weeks.run, "\(fixture.name): weekly run")
    #expect(derived.weeks.bestRun == expected.weeks.bestRun, "\(fixture.name): best run")
    #expect(derived.weeks.reserve == expected.weeks.reserve, "\(fixture.name): reserve")
    #expect(derived.rank.rawValue == expected.rank, "\(fixture.name): rank")
    #expect(derived.masteryByConcept == expected.masteryByConcept, "\(fixture.name): mastery")
    #expect(derived.states == expected.states, "\(fixture.name): mastery states")
    #expect(derived.calibrationGap == expected.calibrationGap, "\(fixture.name): calibration gap")
    #expect(derived.adrs == (expected.adrs ?? [:]), "\(fixture.name): decision records")
  }

  @Test("reduce is order-insensitive and de-duplicates", arguments: files)
  func orderInsensitive(file: URL) throws {
    let fixture = try JSONDecoder().decode(Fixture.self, from: try Data(contentsOf: file))
    let forward = Reducer.reduce(fixture.events)
    let reversed = Reducer.reduce(fixture.events.reversed())
    let doubled = Reducer.reduce(fixture.events + fixture.events.reversed())
    #expect(forward == reversed, "\(fixture.name): reversing the log changed the state")
    #expect(forward == doubled, "\(fixture.name): merging the log with itself changed the state")
  }

  @Test("an unknown event type is kept and ignored", arguments: files)
  func unknownEventIsIgnored(file: URL) throws {
    let fixture = try JSONDecoder().decode(Fixture.self, from: try Data(contentsOf: file))
    let newer = """
      {"id":"018f0e60-0000-7000-8000-0000000000ff","type":"thought_recorded","v":1,
       "at":"2026-09-17T09:00:00.000Z","localDate":"2026-09-17","deviceId":"device-9",
       "seq":1,"contentRev":"fixture-rev","payload":{"text":"from a newer build"}}
      """
    let unknown = try JSONDecoder().decode(LoggedEvent.self, from: Data(newer.utf8))
    guard case .unknown(let preserved) = unknown else {
      Issue.record("a newer event type should decode as unknown")
      return
    }
    #expect(preserved.originalType == "thought_recorded")
    // The raw JSON survives untouched, so this build can sync it on.
    #expect(preserved.raw["payload"]?["text"]?.stringValue == "from a newer build")
    #expect(Reducer.reduce(fixture.events + [unknown]) == Reducer.reduce(fixture.events))
  }

  @Test("every fixture event re-encodes to the JSON it came from", arguments: files)
  func roundTrip(file: URL) throws {
    let data = try Data(contentsOf: file)
    let fixture = try JSONDecoder().decode(Fixture.self, from: data)
    let original = try JSONSerialization.jsonObject(with: data) as? [String: Any]
    let originalEvents = try #require(original?["events"] as? [[String: Any]])

    let encoder = JSONEncoder()
    for (index, event) in fixture.events.enumerated() {
      let encoded = try JSONSerialization.jsonObject(with: try encoder.encode(event))
      #expect(
        NSDictionary(dictionary: encoded as? [String: Any] ?? [:])
          == NSDictionary(dictionary: originalEvents[index]),
        "\(fixture.name): event \(index) did not survive a decode and encode")
    }
  }
}

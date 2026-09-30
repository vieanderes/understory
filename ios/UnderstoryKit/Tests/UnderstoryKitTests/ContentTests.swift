import Foundation
import Testing

@testable import UnderstoryKit

/// Decoding the real bundle under `public/content/v1/`. Nothing here is a hand-written
/// sample: if the web's content build changes a shape, this fails.
struct ContentTests {
  static let decoder = JSONDecoder()

  static func bundleExists() -> Bool { RepoPaths.exists(RepoPaths.contentBundle) }

  static func load<T: Decodable>(_ type: T.Type, _ relativePath: String) throws -> T {
    let url = RepoPaths.contentBundle.appending(path: relativePath)
    return try decoder.decode(type, from: try Data(contentsOf: url))
  }

  static var lessonFiles: [URL] {
    RepoPaths.jsonFiles(in: RepoPaths.contentBundle.appending(path: "lessons"))
  }

  // MARK: Manifest and catalog

  @Test("the manifest decodes, and its counts agree with the files on disk")
  func manifest() throws {
    try #require(Self.bundleExists(), Comment(rawValue: RepoPaths.missingBundle))
    let manifest = try Self.load(Manifest.self, "manifest.json")

    #expect(manifest.schema == bundleSchema)
    #expect(!manifest.contentRev.isEmpty)
    #expect(manifest.course.title == "Full-stack and AI engineering")
    #expect(manifest.modules.count == 30)
    // The bundle currently holds 370 lessons. A new lesson changes this number, and the
    // point of asserting it is that somebody has to look.
    #expect(manifest.lessons.count == 370)
    #expect(manifest.lessons.count == Self.lessonFiles.count)

    // Every file a manifest points at is on disk, and its name carries a content hash.
    for lesson in manifest.lessons {
      let url = RepoPaths.contentBundle.appending(path: lesson.file)
      #expect(RepoPaths.exists(url), "missing \(lesson.file)")
      let parts = url.deletingPathExtension().lastPathComponent.split(separator: ".")
      let hash = try #require(parts.last)
      #expect(hash.count == 12, "\(lesson.file) does not carry a 12-character hash")
      #expect(hash.allSatisfy { $0.isHexDigit })
    }
  }

  @Test("the manifest holds seven parts that count every lesson once, in journey order")
  func parts() throws {
    try #require(Self.bundleExists(), Comment(rawValue: RepoPaths.missingBundle))
    let manifest = try Self.load(Manifest.self, "manifest.json")

    #expect(manifest.parts.map(\.id) == [
      "firstcode", "languages", "interfaces", "servers", "production", "aiengineering", "senior",
    ])
    let counted = manifest.parts.flatMap(\.lessons)
    #expect(counted.count == manifest.lessons.count)
    #expect(Set(counted) == Set(manifest.lessons.map(\.id)))
    let moduleIds = Set(manifest.modules.map(\.id))
    for part in manifest.parts {
      #expect(!moduleIds.contains(part.id), "\(part.id) is also a module id")
      #expect(!part.capstone.title.isEmpty)
      #expect(!part.concepts.isEmpty)
    }
    // A woven lesson counts towards the part of the lesson it follows.
    let first = try #require(manifest.parts.first)
    #expect(first.modules == ["basics", "html", "css"])
  }

  @Test("the catalog decodes and lines up with the manifest")
  func catalog() throws {
    try #require(Self.bundleExists(), Comment(rawValue: RepoPaths.missingBundle))
    let catalog = try Self.load(CatalogFile.self, "catalog.json")
    let manifest = try Self.load(Manifest.self, "manifest.json")

    #expect(catalog.schema == bundleSchema)
    #expect(catalog.contentRev == manifest.contentRev)
    #expect(catalog.modules.count == manifest.modules.count)
    #expect(catalog.lessons.count == manifest.lessons.count)
    #expect(!catalog.concepts.isEmpty)
    #expect(!catalog.skillItems.isEmpty)
    #expect(!catalog.recallCards.isEmpty)

    // Every card key the catalog offers is a key the event schema accepts, so a review
    // recorded on iOS validates on the web.
    for item in catalog.skillItems {
      #expect(Identifiers.isCardKey(item.cardKey), "bad skill card key \(item.cardKey)")
    }
    for card in catalog.recallCards {
      #expect(Identifiers.isCardKey(card.cardKey), "bad recall card key \(card.cardKey)")
    }
    let conceptIds = Set(catalog.concepts.map(\.id))
    #expect(catalog.skillItems.allSatisfy { conceptIds.contains($0.concept) })
  }

  // MARK: Every lesson

  @Test("every lesson in the bundle decodes with no unsupported step")
  func everyLesson() throws {
    try #require(Self.bundleExists(), Comment(rawValue: RepoPaths.missingBundle))
    var stepTypes: Set<String> = []
    var stepCount = 0

    for url in Self.lessonFiles {
      let lesson = try Self.decoder.decode(CompiledLesson.self, from: try Data(contentsOf: url))
      #expect(lesson.schema == bundleSchema)
      #expect(!lesson.steps.isEmpty, "\(lesson.id) has no steps")
      stepCount += lesson.steps.count
      for step in lesson.steps {
        stepTypes.insert(step.type)
        if case .unsupported(let type, _) = step {
          Issue.record("\(lesson.id) holds a step this build cannot read: \(type)")
        }
        // A lab or an incident always carries a portable fallback, so a client without
        // the widget still has a lesson (docs/SYNC-PROTOCOL.md).
        if case .lab = step { #expect(step.portable != nil, "\(lesson.id): lab with no fallback") }
        if case .incident = step {
          #expect(step.portable != nil, "\(lesson.id): incident with no fallback")
        }
      }
    }

    #expect(stepCount > 400, "only \(stepCount) steps decoded")
    // Every type the compiled schema defines should be exercised somewhere in the bundle.
    #expect(stepTypes.isSubset(of: Self.knownStepTypes), "unexpected step types: \(stepTypes)")
  }

  static let knownStepTypes: Set<String> = [
    "prose", "predict-output", "multiple-choice", "trace-table", "fill-blank", "parsons",
    "bug-hunt", "ai-review", "code-challenge", "explain-back", "lab", "incident", "playground",
    "sql",
  ]

  @Test("a lesson re-encodes to the JSON it came from")
  func roundTrip() throws {
    try #require(Self.bundleExists(), Comment(rawValue: RepoPaths.missingBundle))
    let url = try #require(Self.lessonFiles.first { $0.lastPathComponent.hasPrefix("js.coercion.") })
    let data = try Data(contentsOf: url)
    let lesson = try Self.decoder.decode(CompiledLesson.self, from: data)

    let encoder = JSONEncoder()
    let re = try encoder.encode(lesson)
    let original = try JSONSerialization.jsonObject(with: data) as? [String: Any]
    let encoded = try JSONSerialization.jsonObject(with: re) as? [String: Any]
    #expect(
      NSDictionary(dictionary: try #require(encoded))
        == NSDictionary(dictionary: try #require(original)),
      "a decode and encode did not give the same JSON back")
  }

  // MARK: Known values from js.coercion

  @Test("js.coercion decodes with the values the web publishes")
  func jsCoercion() throws {
    try #require(Self.bundleExists(), Comment(rawValue: RepoPaths.missingBundle))
    let url = try #require(Self.lessonFiles.first { $0.lastPathComponent.hasPrefix("js.coercion.") })
    let lesson = try Self.decoder.decode(CompiledLesson.self, from: try Data(contentsOf: url))

    #expect(lesson.id == "js.coercion")
    #expect(lesson.moduleId == "js")
    #expect(lesson.moduleSlug == "javascript")
    #expect(lesson.slug == "values-types-coercion")
    #expect(lesson.title == "Values, types and coercion")
    #expect(lesson.level == .essential)
    #expect(lesson.minutes == 10)
    #expect(lesson.concepts == ["js.types", "js.coercion", "js.equality", "js.truthiness"])
    #expect(lesson.prerequisites == ["js.meets-the-page"])
    #expect(!lesson.opening.text.isEmpty)
    #expect(lesson.webPath == "/learn/javascript/values-types-coercion")
    #expect(lesson.deepDive != nil)
    #expect(lesson.references.count == 3)

    #expect(lesson.steps.count == 10)
    #expect(
      lesson.steps.map(\.type) == [
        "predict-output", "prose", "playground", "trace-table", "prose", "bug-hunt",
        "prose", "playground", "code-challenge", "explain-back",
      ])
    #expect(
      lesson.steps.compactMap(\.id) == [
        "predict-total", "strings-from-forms", "fix-form-total", "trace-operators",
        "loose-equality", "hunt-zero-reading", "truthy-and-falsy", "fix-seats-held",
        "write-cart-total", "explain-twenty-one",
      ])
    #expect(lesson.recall.map(\.id) == [
      "card-plus-string", "card-loose-equality", "card-falsy-values", "card-input-value-type",
    ])

    // Exactly one choice is marked correct, and `correct` is omitted rather than false.
    guard case .predictOutput(let predict) = lesson.steps[0] else {
      Issue.record("the first step should be predict-output")
      return
    }
    #expect(predict.id == "predict-total")
    #expect(predict.concept == "js.coercion")
    #expect((1...5).contains(predict.difficulty))
    #expect(predict.language == .js)
    #expect(!predict.code.isEmpty)
    #expect(predict.codeHtml.contains("data-line="))
    #expect(predict.choices.count >= 2)
    #expect(predict.choices.filter { $0.isCorrect }.count == 1)
    #expect(predict.choices.contains { $0.correct == nil })

    // A code challenge carries starter and test source but never the solution.
    guard case .codeChallenge(let challenge) = lesson.steps[8] else {
      Issue.record("step 9 should be code-challenge")
      return
    }
    #expect(challenge.id == "write-cart-total")
    #expect(!challenge.starterCode.isEmpty)
    #expect(!challenge.testsCode.isEmpty)
    #expect(!challenge.hints.isEmpty)
    #expect(lesson.steps[8].needsTyping)
  }

  // MARK: Forward compatibility

  @Test("a step type this build does not know decodes as unsupported")
  func unsupportedStep() throws {
    let json = """
      {"type":"whiteboard","id":"draw-the-flow","concept":"arch.queues","difficulty":3,
       "prompt":{"md":"Sketch it.","html":"<p>Sketch it.</p>"}}
      """
    let step = try Self.decoder.decode(CompiledStep.self, from: Data(json.utf8))
    guard case .unsupported(let type, let id) = step else {
      Issue.record("an unknown type should decode as .unsupported, got \(step.type)")
      return
    }
    #expect(type == "whiteboard")
    #expect(id == "draw-the-flow")
    // An older app skips the step rather than refusing the lesson.
    #expect(step.portable == nil)
    #expect(step.concept == nil)
  }

  @Test("a lesson holding a newer step type still decodes, and the step is skipped")
  func lessonWithNewerStep() throws {
    try #require(Self.bundleExists(), Comment(rawValue: RepoPaths.missingBundle))
    let url = try #require(Self.lessonFiles.first { $0.lastPathComponent.hasPrefix("js.coercion.") })
    var object = try #require(
      try JSONSerialization.jsonObject(with: try Data(contentsOf: url)) as? [String: Any])
    var steps = try #require(object["steps"] as? [[String: Any]])
    steps.insert(["type": "whiteboard", "id": "new-thing"], at: 1)
    object["steps"] = steps

    let lesson = try Self.decoder.decode(
      CompiledLesson.self, from: try JSONSerialization.data(withJSONObject: object))
    #expect(lesson.steps.count == 11)
    #expect(lesson.playableSteps.count == 10)
    #expect(!lesson.playableSteps.contains { $0.type == "whiteboard" })
  }

  @Test("a known step type with a broken shape still throws")
  func brokenKnownStep() {
    let json = #"{"type":"prose","id":"p1"}"#  // no body
    #expect(throws: (any Error).self) {
      try Self.decoder.decode(CompiledStep.self, from: Data(json.utf8))
    }
  }
}

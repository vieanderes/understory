import Foundation
import Testing

@testable import UnderstoryKit

/// The playground step, as the web's content build writes it (`CompiledPlaygroundStep`).
struct PlaygroundTests {
  static let decoder = JSONDecoder()

  @Test("a scored playground decodes with its checks, and names its concept")
  func scoredPlayground() throws {
    let json = """
      {"type":"playground","id":"build-first-heading","concept":"html.elements","difficulty":1,
       "prompt":{"md":"Change the heading.","html":"<p>Change the heading.</p>"},
       "html":"<h1>Pancakes</h1>\\n","css":"h1 { color: teal; }\\n","editable":["html","css"],
       "showTree":true,
       "checks":[{"label":"One h1","selector":"h1","count":1,"text":"Pancakes",
                  "attribute":{"name":"id"},"style":{"property":"color","value":"teal"}}],
       "solution":{"html":"<h1>Waffles</h1>\\n"},
       "hints":[{"md":"Look at the tags.","html":"<p>Look at the tags.</p>"}]}
      """
    let step = try Self.decoder.decode(CompiledStep.self, from: Data(json.utf8))
    guard case .playground(let playground) = step else {
      Issue.record("expected a playground, got \(step.type)")
      return
    }
    #expect(step.type == "playground")
    #expect(step.id == "build-first-heading")
    #expect(step.concept == "html.elements")
    #expect(playground.editable == [.html, .css])
    #expect(playground.checks?.first?.count == 1)
    #expect(playground.solution?.html == "<h1>Waffles</h1>\n")
    #expect(step.needsTyping == false)
  }

  @Test("a free playground has no concept to give evidence for")
  func freePlayground() throws {
    let json = """
      {"type":"playground","id":"explore","concept":"html.elements",
       "prompt":{"md":"Try a tag.","html":"<p>Try a tag.</p>"},"html":"","editable":["html"]}
      """
    let step = try Self.decoder.decode(CompiledStep.self, from: Data(json.utf8))
    #expect(step.concept == nil)
    #expect(step.portable == step)
  }

  @Test("a React playground decodes with no html, its jsx, and checks that act first")
  func reactPlayground() throws {
    let json = """
      {"type":"playground","id":"count-clicks","concept":"react.state","difficulty":2,
       "prompt":{"md":"Count the clicks.","html":"<p>Count the clicks.</p>"},
       "jsx":"export default function App() { return <button>0</button>; }\\n",
       "editable":["jsx"],
       "checks":[{"label":"Counts","selector":"button","text":"2",
                  "actions":[{"click":"button"},{"type":"Ada","into":"input"}]}],
       "solution":{"jsx":"export default function App() {}\\n"}}
      """
    let step = try Self.decoder.decode(CompiledStep.self, from: Data(json.utf8))
    guard case .playground(let playground) = step else {
      Issue.record("expected a playground, got \(step.type)")
      return
    }
    #expect(playground.html == nil)
    #expect(playground.jsx?.hasPrefix("export default function App()") == true)
    #expect(playground.editable == [.jsx])
    #expect(playground.checks?.first?.actions == [.click("button"), .type("Ada", into: "input")])
    #expect(playground.solution?.jsx != nil)

    // And back: what decodes also encodes to the same step.
    let again = try Self.decoder.decode(CompiledStep.self, from: JSONEncoder().encode(step))
    #expect(again == step)
  }

  @Test("a code challenge carries its editable lines")
  func editableChallenge() throws {
    let json = """
      {"type":"code-challenge","id":"write-total","concept":"js.loops","difficulty":2,
       "prompt":{"md":"Add them up.","html":"<p>Add them up.</p>"},"language":"js",
       "starterCode":"function f() {\\n}\\n","starterHtml":"<pre></pre>","testsCode":"",
       "editable":"2-3","hints":[]}
      """
    let step = try Self.decoder.decode(CompiledStep.self, from: Data(json.utf8))
    guard case .codeChallenge(let challenge) = step else {
      Issue.record("expected a code challenge, got \(step.type)")
      return
    }
    #expect(challenge.editable == "2-3")
  }

  @Test("an answered playground is produce evidence worth challenge XP")
  func answeredPlayground() {
    #expect(AnsweredStepType.playground.family == .produce)
    #expect(Gamification.xpKind(for: .playground) == .codeChallenge)
  }
}

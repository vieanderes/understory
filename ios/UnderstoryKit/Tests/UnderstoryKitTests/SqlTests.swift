import Foundation
import Testing

@testable import UnderstoryKit

/// The sql step, as the web's content build writes it (`CompiledSqlStep`).
struct SqlTests {
  static let decoder = JSONDecoder()

  @Test("a scored sql step decodes with its setup, solution and checks, and names its concept")
  func scoredSql() throws {
    let json = """
      {"type":"sql","id":"find-unshipped-orders","concept":"db.relational-model","difficulty":1,
       "prompt":{"md":"Show every order that hasn't shipped.","html":"<p>Show every order.</p>"},
       "setup":"create table orders (id int primary key, shipped boolean);\\n",
       "starter":"select * from orders;\\n",
       "solution":"select * from orders where not shipped;\\n",
       "checks":{"ordered":false,"query":"select id from orders"},
       "showSchema":true,
       "hints":[{"md":"Filter the rows.","html":"<p>Filter the rows.</p>"}]}
      """
    let step = try Self.decoder.decode(CompiledStep.self, from: Data(json.utf8))
    guard case .sql(let sql) = step else {
      Issue.record("expected a sql step, got \(step.type)")
      return
    }
    #expect(step.type == "sql")
    #expect(step.id == "find-unshipped-orders")
    #expect(step.concept == "db.relational-model")
    #expect(sql.starter == "select * from orders;\n")
    #expect(sql.checks?.ordered == false)
    #expect(sql.checks?.query == "select id from orders")
    #expect(sql.showSchema == true)
    #expect(step.needsTyping == false)
  }

  @Test("a free sql step has no concept to give evidence for, and re-encodes as it came")
  func freeSql() throws {
    let json = """
      {"type":"sql","id":"explore","prompt":{"md":"Try a query.","html":"<p>Try a query.</p>"},
       "setup":"","starter":""}
      """
    let step = try Self.decoder.decode(CompiledStep.self, from: Data(json.utf8))
    #expect(step.concept == nil)
    #expect(step.portable == step)
    let again = try Self.decoder.decode(CompiledStep.self, from: JSONEncoder().encode(step))
    #expect(again == step)
  }

  @Test("an answered sql step is produce evidence worth challenge XP")
  func answeredSql() {
    #expect(AnsweredStepType.sql.family == .produce)
    #expect(Gamification.xpKind(for: .sql) == .codeChallenge)
  }
}

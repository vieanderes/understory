import Foundation

/// A SQL run and its report, field for field as src/core/sql/report.ts declares them.
/// Values are Postgres's own text output, so comparing two results is comparing strings;
/// nil is SQL NULL.

public struct SqlRunRequest: Codable, Hashable, Sendable {
  /// Schema and seed rows, run on a fresh database before `sql`.
  public var setup: String
  /// What the learner (or the solution) typed. Split into statements and run in order.
  public var sql: String
  /// Run after `sql` to read what it changed.
  public var query: String?
  /// Describe the tables the setup made, for the schema panel.
  public var describe: Bool?

  public init(setup: String, sql: String, query: String? = nil, describe: Bool? = nil) {
    self.setup = setup
    self.sql = sql
    self.query = query
    self.describe = describe
  }
}

public struct SqlResultSet: Codable, Hashable, Sendable {
  public var columns: [String]
  public var rows: [[String?]]
  public var rowCount: Int
  public var truncated: Bool?
}

public struct SqlError: Codable, Hashable, Sendable {
  public var message: String
  public var code: String?
  public var detail: String?
  public var hint: String?
  public var line: Int?
  public var column: Int?
}

public enum SqlStatementResult: Codable, Hashable, Sendable {
  case ok(
    line: Int, text: String, command: String, result: SqlResultSet?, affected: Int?, ms: Double)
  case error(line: Int, text: String, error: SqlError)

  private enum Keys: String, CodingKey {
    case status, line, text, command, result, affected, ms, error
  }

  public init(from decoder: any Decoder) throws {
    let c = try decoder.container(keyedBy: Keys.self)
    let line = try c.decode(Int.self, forKey: .line)
    let text = try c.decode(String.self, forKey: .text)
    if try c.decode(String.self, forKey: .status) == "error" {
      self = .error(line: line, text: text, error: try c.decode(SqlError.self, forKey: .error))
    } else {
      self = .ok(
        line: line, text: text, command: try c.decode(String.self, forKey: .command),
        result: try c.decodeIfPresent(SqlResultSet.self, forKey: .result),
        affected: try c.decodeIfPresent(Int.self, forKey: .affected),
        ms: try c.decode(Double.self, forKey: .ms))
    }
  }

  public func encode(to encoder: any Encoder) throws {
    var c = encoder.container(keyedBy: Keys.self)
    switch self {
    case .ok(let line, let text, let command, let result, let affected, let ms):
      try c.encode("ok", forKey: .status)
      try c.encode(line, forKey: .line)
      try c.encode(text, forKey: .text)
      try c.encode(command, forKey: .command)
      try c.encodeIfPresent(result, forKey: .result)
      try c.encodeIfPresent(affected, forKey: .affected)
      try c.encode(ms, forKey: .ms)
    case .error(let line, let text, let error):
      try c.encode("error", forKey: .status)
      try c.encode(line, forKey: .line)
      try c.encode(text, forKey: .text)
      try c.encode(error, forKey: .error)
    }
  }
}

public struct SqlColumnInfo: Codable, Hashable, Sendable {
  public var name: String
  public var type: String
  public var notNull: Bool
  public var primaryKey: Bool
  public var references: String?
}

public struct SqlTableInfo: Codable, Hashable, Sendable {
  public var name: String
  public var columns: [SqlColumnInfo]
}

/// The query run after the SQL: its result, or its error.
public enum SqlQueryOutcome: Codable, Hashable, Sendable {
  case result(SqlResultSet)
  case error(SqlError)

  private enum Keys: String, CodingKey { case result, error }

  public init(from decoder: any Decoder) throws {
    let c = try decoder.container(keyedBy: Keys.self)
    if let result = try c.decodeIfPresent(SqlResultSet.self, forKey: .result) {
      self = .result(result)
    } else {
      self = .error(try c.decode(SqlError.self, forKey: .error))
    }
  }

  public func encode(to encoder: any Encoder) throws {
    var c = encoder.container(keyedBy: Keys.self)
    switch self {
    case .result(let result): try c.encode(result, forKey: .result)
    case .error(let error): try c.encode(error, forKey: .error)
    }
  }
}

public enum SqlRunReport: Codable, Hashable, Sendable {
  /// In order, up to and including the first statement that failed.
  case ran(
    statements: [SqlStatementResult], skipped: Int, query: SqlQueryOutcome?,
    schema: [SqlTableInfo]?)
  /// The step's own setup failed: an authoring error the gate exists to catch.
  case setupError(SqlError)
  /// The run took longer than its budget and the database was stopped.
  case timeout(limitMs: Int)
  /// The database could not be loaded or stopped answering.
  case unavailable(reason: String)

  private enum Keys: String, CodingKey {
    case status, statements, skipped, query, schema, error, limitMs, reason
  }

  public init(from decoder: any Decoder) throws {
    let c = try decoder.container(keyedBy: Keys.self)
    switch try c.decode(String.self, forKey: .status) {
    case "ran":
      self = .ran(
        statements: try c.decode([SqlStatementResult].self, forKey: .statements),
        skipped: try c.decode(Int.self, forKey: .skipped),
        query: try c.decodeIfPresent(SqlQueryOutcome.self, forKey: .query),
        schema: try c.decodeIfPresent([SqlTableInfo].self, forKey: .schema))
    case "setup-error": self = .setupError(try c.decode(SqlError.self, forKey: .error))
    case "timeout": self = .timeout(limitMs: try c.decode(Int.self, forKey: .limitMs))
    case "unavailable": self = .unavailable(reason: try c.decode(String.self, forKey: .reason))
    case let other:
      throw DecodingError.dataCorruptedError(
        forKey: .status, in: c, debugDescription: "Unknown SQL report status \(other)")
    }
  }

  public func encode(to encoder: any Encoder) throws {
    var c = encoder.container(keyedBy: Keys.self)
    switch self {
    case .ran(let statements, let skipped, let query, let schema):
      try c.encode("ran", forKey: .status)
      try c.encode(statements, forKey: .statements)
      try c.encode(skipped, forKey: .skipped)
      try c.encodeIfPresent(query, forKey: .query)
      try c.encodeIfPresent(schema, forKey: .schema)
    case .setupError(let error):
      try c.encode("setup-error", forKey: .status)
      try c.encode(error, forKey: .error)
    case .timeout(let limitMs):
      try c.encode("timeout", forKey: .status)
      try c.encode(limitMs, forKey: .limitMs)
    case .unavailable(let reason):
      try c.encode("unavailable", forKey: .status)
      try c.encode(reason, forKey: .reason)
    }
  }
}

/// Whether the learner's SQL gives the solution's answer (src/core/sql/verdict.ts).
public enum SqlVerdict: Codable, Hashable, Sendable {
  case match
  case mismatch(differences: [String])
  /// The learner's SQL failed, ran too long, or returned nothing to compare.
  case error(message: String)
  /// No verdict is possible. The web does not grade it, and neither does the app.
  case unavailable(reason: String)

  private enum Keys: String, CodingKey { case status, differences, message, reason }

  public init(from decoder: any Decoder) throws {
    let c = try decoder.container(keyedBy: Keys.self)
    switch try c.decode(String.self, forKey: .status) {
    case "match": self = .match
    case "mismatch": self = .mismatch(differences: try c.decode([String].self, forKey: .differences))
    case "error": self = .error(message: try c.decode(String.self, forKey: .message))
    default: self = .unavailable(reason: try c.decode(String.self, forKey: .reason))
    }
  }

  public func encode(to encoder: any Encoder) throws {
    var c = encoder.container(keyedBy: Keys.self)
    switch self {
    case .match: try c.encode("match", forKey: .status)
    case .mismatch(let differences):
      try c.encode("mismatch", forKey: .status)
      try c.encode(differences, forKey: .differences)
    case .error(let message):
      try c.encode("error", forKey: .status)
      try c.encode(message, forKey: .message)
    case .unavailable(let reason):
      try c.encode("unavailable", forKey: .status)
      try c.encode(reason, forKey: .reason)
    }
  }
}

/// The verdict and, when there is one to record, the grade.
public struct SqlJudgement: Hashable, Sendable {
  public var verdict: SqlVerdict
  /// Nil for `unavailable`: the web submits no answer then, so the app records none.
  public var grade: StepGrade?
}

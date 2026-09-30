import Foundation

/// Any JSON value. Used where the contract allows open data (`lab.preset`), and to keep an
/// event this build does not understand exactly as it arrived, so it survives a round trip
/// through an older app (docs/SYNC-PROTOCOL.md, "Unknown event types are kept and ignored").
public enum JSONValue: Sendable, Hashable, Codable {
  case null
  case bool(Bool)
  /// A number with no fractional part that fits in 64 bits. Kept apart from `double` so
  /// that `seq: 12` does not come back as `12.0`.
  case int(Int64)
  case double(Double)
  case string(String)
  case array([JSONValue])
  case object([String: JSONValue])

  public init(from decoder: Decoder) throws {
    if let container = try? decoder.container(keyedBy: AnyKey.self) {
      var object: [String: JSONValue] = [:]
      for key in container.allKeys {
        object[key.stringValue] = try container.decode(JSONValue.self, forKey: key)
      }
      self = .object(object)
      return
    }
    if var container = try? decoder.unkeyedContainer() {
      var array: [JSONValue] = []
      while !container.isAtEnd { array.append(try container.decode(JSONValue.self)) }
      self = .array(array)
      return
    }
    let container = try decoder.singleValueContainer()
    if container.decodeNil() {
      self = .null
    } else if let value = try? container.decode(Bool.self) {
      self = .bool(value)
    } else if let value = try? container.decode(Int64.self) {
      self = .int(value)
    } else if let value = try? container.decode(Double.self) {
      self = .double(value)
    } else {
      self = .string(try container.decode(String.self))
    }
  }

  public func encode(to encoder: Encoder) throws {
    switch self {
    case .null:
      var container = encoder.singleValueContainer()
      try container.encodeNil()
    case .bool(let value):
      var container = encoder.singleValueContainer()
      try container.encode(value)
    case .int(let value):
      var container = encoder.singleValueContainer()
      try container.encode(value)
    case .double(let value):
      var container = encoder.singleValueContainer()
      try container.encode(value)
    case .string(let value):
      var container = encoder.singleValueContainer()
      try container.encode(value)
    case .array(let values):
      var container = encoder.unkeyedContainer()
      for value in values { try container.encode(value) }
    case .object(let object):
      var container = encoder.container(keyedBy: AnyKey.self)
      for (key, value) in object { try container.encode(value, forKey: AnyKey(key)) }
    }
  }

  public subscript(key: String) -> JSONValue? {
    if case .object(let object) = self { return object[key] }
    return nil
  }

  public var stringValue: String? {
    if case .string(let value) = self { return value }
    return nil
  }

  public var objectValue: [String: JSONValue]? {
    if case .object(let value) = self { return value }
    return nil
  }

  /// The value as a number, whichever of the two numeric cases holds it.
  public var numberValue: Double? {
    switch self {
    case .int(let value): return Double(value)
    case .double(let value): return value
    default: return nil
    }
  }

  /// Decodes a typed value out of this tree with the ordinary Codable machinery.
  public func decode<T: Decodable>(_ type: T.Type) throws -> T {
    try JSONDecoder().decode(type, from: JSONEncoder().encode(self))
  }
}

struct AnyKey: CodingKey {
  let stringValue: String
  let intValue: Int?
  init(_ string: String) {
    stringValue = string
    intValue = nil
  }
  init?(stringValue: String) { self.init(stringValue) }
  init?(intValue: Int) {
    stringValue = String(intValue)
    self.intValue = intValue
  }
}

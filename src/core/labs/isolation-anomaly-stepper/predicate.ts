import type { CompareOp, Operand, Predicate, Row, Value } from './types';

function resolve(operand: Operand, row: Row): Value | undefined {
  return typeof operand === 'object' ? row[operand.col] : operand;
}

/**
 * SQL comparison without NULLs (the lab's tables have none). Values of different types
 * never compare as equal or ordered, which keeps a scenario typo from passing silently.
 */
export function compare(left: Value | undefined, op: CompareOp, right: Value | undefined): boolean {
  if (left === undefined || right === undefined || typeof left !== typeof right) return false;
  switch (op) {
    case '=':
      return left === right;
    case '<>':
      return left !== right;
    case '<':
      return left < right;
    case '<=':
      return left <= right;
    case '>':
      return left > right;
    case '>=':
      return left >= right;
  }
}

/** True when the row satisfies every comparison. The empty predicate matches all rows. */
export function matches(where: Predicate, row: Row): boolean {
  return where.every((c) => compare(row[c.col], c.op, resolve(c.value, row)));
}

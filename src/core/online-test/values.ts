/*
 * The values a task's function takes and returns, and the two ways they are written down:
 * canonical JSON, which is hashed to compare a result with the expected one, and the
 * platform's display form (`[1, 3, 6]`, `'abc'`, `([3, 8], 3)`), which the Test Output and
 * the report print (docs/ONLINE-TEST.md, "Output").
 *
 * The types are the few whose canonical JSON is the same in JavaScript and Python, so one
 * expected hash, computed at build time, judges a solution in either language.
 */

export const VALUE_TYPES = ['int', 'bool', 'string', 'int[]', 'string[]', 'int[][]'] as const;
export type ValueType = (typeof VALUE_TYPES)[number];

export type Value = number | boolean | string | number[] | string[] | number[][];

export function isValueOf(type: ValueType, value: unknown): value is Value {
  switch (type) {
    case 'int':
      return typeof value === 'number' && Number.isInteger(value);
    case 'bool':
      return typeof value === 'boolean';
    case 'string':
      return typeof value === 'string';
    case 'int[]':
      return (
        Array.isArray(value) && value.every((v) => typeof v === 'number' && Number.isInteger(v))
      );
    case 'string[]':
      return Array.isArray(value) && value.every((v) => typeof v === 'string');
    case 'int[][]':
      return Array.isArray(value) && value.every((row) => isValueOf('int[]', row));
  }
}

/** `JSON.stringify` with the one gap a returned value can hit filled in. */
export function canonicalJson(value: unknown): string {
  return value === undefined ? 'undefined' : JSON.stringify(value);
}

function utf8(text: string): number[] {
  const bytes: number[] = [];
  for (const char of text) {
    const code = char.codePointAt(0) ?? 0;
    if (code < 0x80) bytes.push(code);
    else if (code < 0x800) bytes.push(0xc0 | (code >> 6), 0x80 | (code & 63));
    else if (code < 0x10000) {
      bytes.push(0xe0 | (code >> 12), 0x80 | ((code >> 6) & 63), 0x80 | (code & 63));
    } else {
      bytes.push(
        0xf0 | (code >> 18),
        0x80 | ((code >> 12) & 63),
        0x80 | ((code >> 6) & 63),
        0x80 | (code & 63),
      );
    }
  }
  return bytes;
}

function fnv1a(bytes: readonly number[], basis: number): string {
  let hash = basis >>> 0;
  for (const byte of bytes) hash = Math.imul(hash ^ byte, 16777619) >>> 0;
  return hash.toString(16).padStart(8, '0');
}

/*
 * Two FNV-1a runs with different offset bases: 64 bits, so two different results do not
 * collide in practice, while the sandbox copies (program.ts) stay a dozen lines each.
 */
export const HASH_BASES = [0x811c9dc5, 0x01000193] as const;

export function hashJson(json: string): string {
  const bytes = utf8(json);
  return fnv1a(bytes, HASH_BASES[0]) + fnv1a(bytes, HASH_BASES[1]);
}

export const hashValue = (value: unknown): string => hashJson(canonicalJson(value));

// ---- Display form ------------------------------------------------------------------

function quote(text: string): string {
  return `'${text.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
}

/** How the platform prints a value: `[1, 3, 6]`, `'abc'`, `true`. */
export function formatValue(value: unknown): string {
  if (typeof value === 'string') return quote(value);
  if (Array.isArray(value)) return `[${value.map(formatValue).join(', ')}]`;
  if (value === undefined) return 'undefined';
  if (value === null) return 'null';
  if (typeof value === 'object') return canonicalJson(value);
  return String(value);
}

/** One argument prints bare, several as a tuple: `[1, 2]` or `([3, 8], 3)`. */
export function formatArgs(args: readonly unknown[]): string {
  const parts = args.map(formatValue);
  return args.length === 1 ? (parts[0] ?? '') : `(${parts.join(', ')})`;
}

/**
 * A result arrives as canonical JSON, cut short when it is long. Whole JSON prints in the
 * display form; a cut one prints as far as it goes, with a space after each comma that
 * sits outside a string, and an ellipsis.
 */
export function formatJson(json: string, complete: boolean): string {
  if (complete) {
    if (json === 'undefined') return 'undefined';
    try {
      return formatValue(JSON.parse(json));
    } catch {
      return json;
    }
  }
  let out = '';
  let inString = false;
  for (let i = 0; i < json.length; i++) {
    const char = json[i];
    if (inString) {
      if (char === '\\') {
        out += char + (json[i + 1] ?? '');
        i += 1;
        continue;
      }
      if (char === '"') {
        inString = false;
        out += "'";
        continue;
      }
      out += char;
      continue;
    }
    if (char === '"') {
      inString = true;
      out += "'";
    } else if (char === ',') out += ', ';
    else out += char;
  }
  return `${out}...`;
}

/** A long value in a verdict is cut, as the platform cuts it, so a line stays readable. */
export function clipDisplay(text: string, max = 200): string {
  return text.length > max ? `${text.slice(0, max - 3)}...` : text;
}

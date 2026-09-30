import { isValueOf, type Value, type ValueType } from './values';
import type { Param } from './signature';

/*
 * `test-input.txt`: the candidate's own cases, one per line, in the platform's format.
 * `[1, 3, 6, 4, 1, 2]` for one argument, `([3, 8, 9, 7, 6], 3)` for several. At most ten.
 * A bad line becomes a runtime error on that case with the platform's wording, not a
 * failure of the whole run.
 */

export const MAX_CUSTOM_CASES = 10;

export type ParsedLine =
  { ok: true; source: string; args: Value[] } | { ok: false; source: string; message: string };

export interface ParsedInput {
  cases: ParsedLine[];
  /** Lines past the tenth, which the platform ignores. */
  ignored: number;
}

class InputError extends Error {}

/** A small reader for the literal syntax: numbers, quoted strings, booleans, lists, tuples. */
class Reader {
  private i = 0;
  constructor(private readonly text: string) {}

  private skip(): void {
    while (this.i < this.text.length && /\s/.test(this.text[this.i] ?? '')) this.i += 1;
  }

  private peek(): string {
    this.skip();
    return this.text[this.i] ?? '';
  }

  private token(): string {
    this.skip();
    const rest = this.text.slice(this.i);
    return /^[^\s,()[\]]+/.exec(rest)?.[0] ?? rest[0] ?? 'end of line';
  }

  private fail(expecting: string): never {
    throw new InputError(`invalid input, unexpected '${this.token()}', expecting ${expecting}`);
  }

  done(): boolean {
    return this.peek() === '';
  }

  expectEnd(): void {
    if (!this.done()) this.fail('end of line');
  }

  expect(char: string, expecting: string): void {
    if (this.peek() !== char) this.fail(expecting);
    this.i += 1;
  }

  tryChar(char: string): boolean {
    if (this.peek() !== char) return false;
    this.i += 1;
    return true;
  }

  read(type: ValueType): Value {
    switch (type) {
      case 'int':
        return this.int();
      case 'bool':
        return this.bool();
      case 'string':
        return this.string();
      case 'int[]':
        return this.list(() => this.int());
      case 'string[]':
        return this.list(() => this.string());
      case 'int[][]':
        return this.list(() => this.list(() => this.int()));
    }
  }

  private int(): number {
    this.skip();
    const match = /^[-−]?\d+/.exec(this.text.slice(this.i));
    if (!match) this.fail('integer');
    this.i += match[0].length;
    const value = Number(match[0].replace('−', '-'));
    if (!Number.isSafeInteger(value)) {
      throw new InputError(`invalid input, integer out of range: ${match[0]}`);
    }
    return value;
  }

  private bool(): boolean {
    const word = this.token();
    if (word === 'true' || word === 'True') {
      this.i = this.text.indexOf(word, this.i) + word.length;
      return true;
    }
    if (word === 'false' || word === 'False') {
      this.i = this.text.indexOf(word, this.i) + word.length;
      return false;
    }
    return this.fail('boolean');
  }

  private string(): string {
    const open = this.peek();
    if (open !== "'" && open !== '"') this.fail('string');
    this.i += 1;
    let out = '';
    while (this.i < this.text.length) {
      const char = this.text[this.i] ?? '';
      this.i += 1;
      if (char === '\\') {
        out += this.text[this.i] ?? '';
        this.i += 1;
      } else if (char === open) return out;
      else out += char;
    }
    throw new InputError('invalid input, unterminated string');
  }

  private list<T>(item: () => T): T[] {
    this.expect('[', "'['");
    const out: T[] = [];
    if (this.tryChar(']')) return out;
    for (;;) {
      out.push(item());
      if (this.tryChar(']')) return out;
      this.expect(',', "',' or ']'");
    }
  }
}

export function parseLine(source: string, params: readonly Param[]): ParsedLine {
  const reader = new Reader(source);
  try {
    const args: Value[] = [];
    if (params.length === 1) {
      const [only] = params;
      // A lone argument may also be written as a one-element tuple.
      const wrapped = reader.tryChar('(');
      if (only) args.push(reader.read(only.type));
      if (wrapped) reader.expect(')', "')'");
    } else {
      reader.expect('(', "'('");
      params.forEach((param, index) => {
        if (index > 0) reader.expect(',', "','");
        args.push(reader.read(param.type));
      });
      reader.expect(')', "')'");
    }
    reader.expectEnd();
    // The reader only builds values of the declared types; this keeps that promise checked.
    if (!params.every((p, i) => isValueOf(p.type, args[i]))) {
      return { ok: false, source, message: 'invalid input' };
    }
    return { ok: true, source, args };
  } catch (error) {
    if (error instanceof InputError) return { ok: false, source, message: error.message };
    throw error;
  }
}

export function parseInput(text: string, params: readonly Param[]): ParsedInput {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
  return {
    cases: lines.slice(0, MAX_CUSTOM_CASES).map((line) => parseLine(line, params)),
    ignored: Math.max(0, lines.length - MAX_CUSTOM_CASES),
  };
}

/** The tooltip of the `test-input.txt` tab, which is also the file's placeholder. */
export function inputHint(example: string): string {
  return `Type your test input below (${MAX_CUSTOM_CASES} maximum). Each line is a separate test case in this format: ${example}`;
}

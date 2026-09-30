import { z } from 'zod';
import type { Value } from './values';

/*
 * Large inputs for performance tests, described instead of stored. A 100,000-element array
 * written out is several hundred kilobytes, past the runner's source cap, so the program
 * (program.ts) rebuilds it inside the sandbox from a seed and a spec.
 *
 * The same spec must give the same input in JavaScript and in Python, or the expected
 * hash, computed once at build time, would judge a Python solution against another input.
 * Both copies use mulberry32 on unsigned 32-bit arithmetic and turn a draw into an integer
 * the same way. This file holds the reference copy in TypeScript; the unit tests compare
 * the sandbox copies with it.
 */

const int = z.number().int();
const count = z.number().int().min(0).max(1_000_000);
const ascii = z
  .string()
  .min(1)
  .regex(/^[\x20-\x7e]+$/, 'ASCII characters only, so both languages index it the same way');

export const argSpecSchema = z.discriminatedUnion('kind', [
  z.strictObject({
    kind: z.literal('value'),
    value: z.union([
      int,
      z.boolean(),
      z.string(),
      z.array(int),
      z.array(z.string()),
      z.array(z.array(int)),
    ]),
  }),
  z.strictObject({ kind: z.literal('int'), min: int, max: int }),
  z.strictObject({ kind: z.literal('ints'), n: count, min: int, max: int }),
  z.strictObject({ kind: z.literal('sorted'), n: count, min: int, max: int }),
  z.strictObject({ kind: z.literal('permutation'), n: count, drop: count.optional() }),
  z.strictObject({ kind: z.literal('constant'), n: count, value: int }),
  z.strictObject({ kind: z.literal('range'), n: count, start: int, step: int }),
  z.strictObject({ kind: z.literal('string'), n: count, alphabet: ascii }),
  z.strictObject({
    kind: z.literal('repeat'),
    times: count,
    unit: z.union([ascii, z.array(int).min(1)]),
  }),
  z.strictObject({ kind: z.literal('pairs'), n: count, min: int, max: int }),
]);

export type ArgSpec = z.infer<typeof argSpecSchema>;

export interface Generated {
  seed: number;
  args: ArgSpec[];
}

export const MASK = 0xffffffff;

/** mulberry32, one draw in [0, 1). */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a) >>> 0;
    t = (((t + Math.imul(t ^ (t >>> 7), 61 | t)) >>> 0) ^ t) >>> 0;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function between(next: () => number, min: number, max: number): number {
  return Math.floor(next() * (max - min + 1)) + min;
}

function one(spec: ArgSpec, next: () => number): Value {
  switch (spec.kind) {
    case 'value':
      return spec.value;
    case 'int':
      return between(next, spec.min, spec.max);
    case 'ints':
      return Array.from({ length: spec.n }, () => between(next, spec.min, spec.max));
    case 'sorted':
      return Array.from({ length: spec.n }, () => between(next, spec.min, spec.max)).sort(
        (x, y) => x - y,
      );
    case 'permutation': {
      const out = Array.from({ length: spec.n }, (_, i) => i + 1);
      for (let i = out.length - 1; i > 0; i--) {
        const j = Math.floor(next() * (i + 1));
        const held = out[i] ?? 0;
        out[i] = out[j] ?? 0;
        out[j] = held;
      }
      for (let k = 0; k < (spec.drop ?? 0) && out.length > 0; k++) {
        out.splice(Math.floor(next() * out.length), 1);
      }
      return out;
    }
    case 'constant':
      return Array.from({ length: spec.n }, () => spec.value);
    case 'range':
      return Array.from({ length: spec.n }, (_, i) => spec.start + i * spec.step);
    case 'string': {
      let out = '';
      for (let i = 0; i < spec.n; i++) {
        out += spec.alphabet[Math.floor(next() * spec.alphabet.length)] ?? '';
      }
      return out;
    }
    case 'repeat': {
      if (typeof spec.unit === 'string') return spec.unit.repeat(spec.times);
      const out: number[] = [];
      for (let i = 0; i < spec.times; i++) out.push(...spec.unit);
      return out;
    }
    case 'pairs':
      return Array.from({ length: spec.n }, () => {
        const a = between(next, spec.min, spec.max);
        const b = between(next, spec.min, spec.max);
        return [Math.min(a, b), Math.max(a, b)];
      });
  }
}

/** The reference: what the sandbox copies must produce for the same spec. */
export function generateArgs({ seed, args }: Generated): Value[] {
  const next = mulberry32(seed);
  return args.map((spec) => one(spec, next));
}

/** How big an input is: its longest array or string. Detected complexity plots against it. */
export function sizeOf(args: readonly Value[]): number {
  return args.reduce<number>(
    (max, arg) => (typeof arg === 'string' || Array.isArray(arg) ? Math.max(max, arg.length) : max),
    0,
  );
}

/*
 * The sandbox copies. Plain ES5 and plain Python, no imports beyond the standard library,
 * because they run inside the harness next to learner code. Written with String.raw: no
 * backtick and no dollar-brace inside.
 */

export const JS_GENERATOR = String.raw`function __ot_gen(seed, specs) {
  var a = seed >>> 0;
  function next() {
    a = (a + 0x6d2b79f5) >>> 0;
    var t = Math.imul(a ^ (a >>> 15), 1 | a) >>> 0;
    t = (((t + Math.imul(t ^ (t >>> 7), 61 | t)) >>> 0) ^ t) >>> 0;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  function between(min, max) { return Math.floor(next() * (max - min + 1)) + min; }
  function one(s) {
    var out, i, j, held, k;
    switch (s.kind) {
      case 'value': return s.value;
      case 'int': return between(s.min, s.max);
      case 'ints': out = new Array(s.n); for (i = 0; i < s.n; i++) out[i] = between(s.min, s.max); return out;
      case 'sorted': out = new Array(s.n); for (i = 0; i < s.n; i++) out[i] = between(s.min, s.max); return out.sort(function (x, y) { return x - y; });
      case 'permutation':
        out = new Array(s.n); for (i = 0; i < s.n; i++) out[i] = i + 1;
        for (i = out.length - 1; i > 0; i--) { j = Math.floor(next() * (i + 1)); held = out[i]; out[i] = out[j]; out[j] = held; }
        for (k = 0; k < (s.drop || 0) && out.length > 0; k++) out.splice(Math.floor(next() * out.length), 1);
        return out;
      case 'constant': out = new Array(s.n); for (i = 0; i < s.n; i++) out[i] = s.value; return out;
      case 'range': out = new Array(s.n); for (i = 0; i < s.n; i++) out[i] = s.start + i * s.step; return out;
      case 'string': out = ''; for (i = 0; i < s.n; i++) out += s.alphabet.charAt(Math.floor(next() * s.alphabet.length)); return out;
      case 'repeat':
        if (typeof s.unit === 'string') return s.unit.repeat(s.times);
        out = []; for (i = 0; i < s.times; i++) for (j = 0; j < s.unit.length; j++) out.push(s.unit[j]); return out;
      case 'pairs':
        out = new Array(s.n);
        for (i = 0; i < s.n; i++) { j = between(s.min, s.max); k = between(s.min, s.max); out[i] = [Math.min(j, k), Math.max(j, k)]; }
        return out;
    }
    throw new Error('Unknown generator ' + s.kind);
  }
  return specs.map(one);
}`;

export const PY_GENERATOR = String.raw`def __ot_gen(seed, specs):
    M = 0xFFFFFFFF
    state = [seed & M]

    def nxt():
        a = (state[0] + 0x6D2B79F5) & M
        state[0] = a
        t = ((a ^ (a >> 15)) * (1 | a)) & M
        t = ((t + (((t ^ (t >> 7)) * (61 | t)) & M)) & M) ^ t
        return ((t ^ (t >> 14)) & M) / 4294967296

    def between(lo, hi):
        return int(nxt() * (hi - lo + 1) // 1) + lo

    def one(s):
        k = s['kind']
        if k == 'value':
            return s['value']
        if k == 'int':
            return between(s['min'], s['max'])
        if k == 'ints':
            return [between(s['min'], s['max']) for _ in range(s['n'])]
        if k == 'sorted':
            return sorted(between(s['min'], s['max']) for _ in range(s['n']))
        if k == 'permutation':
            out = list(range(1, s['n'] + 1))
            for i in range(len(out) - 1, 0, -1):
                j = int(nxt() * (i + 1) // 1)
                out[i], out[j] = out[j], out[i]
            for _ in range(s.get('drop', 0)):
                if not out:
                    break
                out.pop(int(nxt() * len(out) // 1))
            return out
        if k == 'constant':
            return [s['value']] * s['n']
        if k == 'range':
            return [s['start'] + i * s['step'] for i in range(s['n'])]
        if k == 'string':
            al = s['alphabet']
            return ''.join(al[int(nxt() * len(al) // 1)] for _ in range(s['n']))
        if k == 'repeat':
            return s['unit'] * s['times']
        if k == 'pairs':
            out = []
            for _ in range(s['n']):
                x = between(s['min'], s['max'])
                y = between(s['min'], s['max'])
                out.append([min(x, y), max(x, y)])
            return out
        raise ValueError('Unknown generator ' + k)

    return [one(s) for s in specs]
`;

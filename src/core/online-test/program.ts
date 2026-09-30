import { HASH_BASES } from './values';
import { JS_GENERATOR, PY_GENERATOR, type Generated } from './generate';
import type { TaskLanguage } from './signature';
import type { Value } from './values';

/*
 * The test source for one case. It runs in the ordinary harness next to the candidate's
 * code (docs/SANDBOX.md), calls `solution` once, times only that call and reports what it
 * returned: a hash of the canonical JSON for comparison, the start of the JSON for display,
 * the time and the input size.
 *
 * The report travels as the test's failure message, marked so that nothing the candidate
 * prints can pass for it. A message is the one channel the harness never truncates below
 * 2,000 characters; console output can be crowded out by a solution that prints a lot.
 *
 * The comparison happens outside the sandbox (verdict.ts), so the expected value of a
 * hidden test never has to be written into the source the candidate's code runs beside.
 */

export const RESULT_MARKER = '\u0001OT';
/** Short enough that the escaped report still fits the harness's 2,000-character message. */
export const PREVIEW_CHARS = 600;

export type CaseInput = { args: Value[] } | { generate: Generated };

const JS_REPORT = String.raw`function __ot_fnv(json, basis) {
  var h = basis >>> 0, i, c;
  function mix(b) { h = Math.imul(h ^ b, 16777619) >>> 0; }
  for (i = 0; i < json.length; i++) {
    c = json.codePointAt(i);
    if (c > 0xffff) i++;
    if (c < 0x80) mix(c);
    else if (c < 0x800) { mix(0xc0 | (c >> 6)); mix(0x80 | (c & 63)); }
    else if (c < 0x10000) { mix(0xe0 | (c >> 12)); mix(0x80 | ((c >> 6) & 63)); mix(0x80 | (c & 63)); }
    else { mix(0xf0 | (c >> 18)); mix(0x80 | ((c >> 12) & 63)); mix(0x80 | ((c >> 6) & 63)); mix(0x80 | (c & 63)); }
  }
  return ('0000000' + h.toString(16)).slice(-8);
}
function __ot_size(args) {
  var s = 0;
  for (var i = 0; i < args.length; i++) if (typeof args[i] === 'string' || Array.isArray(args[i])) s = Math.max(s, args[i].length);
  return s;
}
function __ot_report(r, ms, s) {
  var j;
  try { j = r === undefined ? 'undefined' : JSON.stringify(r); } catch (e) { j = String(r); }
  if (typeof j !== 'string') j = String(r);
  throw new Error(__OT_MARK + JSON.stringify({ h: __ot_fnv(j, __OT_B0) + __ot_fnv(j, __OT_B1), j: j.slice(0, __OT_PREVIEW), n: j.length, ms: ms, s: s }));
}`;

const PY_REPORT = String.raw`import json as __ot_json


def __ot_fnv(data, basis):
    h = basis
    for b in data:
        h = ((h ^ b) * 16777619) & 0xFFFFFFFF
    return format(h, '08x')


def __ot_size(args):
    s = 0
    for a in args:
        if isinstance(a, (str, list, tuple)):
            s = max(s, len(a))
    return s


def __ot_report(r, ms, s):
    if isinstance(r, tuple):
        r = list(r)
    try:
        j = 'None' if r is None else __ot_json.dumps(r, separators=(',', ':'), ensure_ascii=False)
    except Exception:
        j = repr(r)
    data = j.encode('utf-8')
    h = __ot_fnv(data, __OT_B0) + __ot_fnv(data, __OT_B1)
    raise AssertionError(__OT_MARK + __ot_json.dumps({'h': h, 'j': j[:__OT_PREVIEW], 'n': len(j), 'ms': ms, 's': s}, ensure_ascii=False))
`;

function constants(language: TaskLanguage): string {
  const mark = JSON.stringify(RESULT_MARKER);
  if (language === 'python') {
    return `__OT_MARK = ${mark}\n__OT_B0 = ${HASH_BASES[0]}\n__OT_B1 = ${HASH_BASES[1]}\n__OT_PREVIEW = ${PREVIEW_CHARS}\n`;
  }
  return `var __OT_MARK = ${mark}, __OT_B0 = ${HASH_BASES[0]}, __OT_B1 = ${HASH_BASES[1]}, __OT_PREVIEW = ${PREVIEW_CHARS};\n`;
}

function argsExpression(input: CaseInput, language: TaskLanguage): string {
  if ('args' in input) {
    const json = JSON.stringify(input.args);
    // A JSON string literal is also a valid Python string literal.
    return language === 'python' ? `__ot_json.loads(${JSON.stringify(json)})` : json;
  }
  const specs = JSON.stringify(JSON.stringify(input.generate.args));
  return language === 'python'
    ? `__ot_gen(${input.generate.seed}, __ot_json.loads(${specs}))`
    : `__ot_gen(${input.generate.seed}, JSON.parse(${specs}))`;
}

/** The tests source for one case, in the candidate's language. */
export function caseProgram(language: TaskLanguage, input: CaseInput): string {
  const args = argsExpression(input, language);
  if (language === 'python') {
    return [
      constants(language),
      PY_REPORT,
      PY_GENERATOR,
      '',
      "@test('case')",
      'def _():',
      '    import time as __ot_time',
      `    __ot_args = ${args}`,
      '    __ot_t0 = __ot_time.perf_counter()',
      '    __ot_r = solution(*__ot_args)',
      '    __ot_ms = (__ot_time.perf_counter() - __ot_t0) * 1000',
      '    __ot_report(__ot_r, __ot_ms, __ot_size(__ot_args))',
      '',
    ].join('\n');
  }
  return [
    constants(language),
    JS_REPORT,
    JS_GENERATOR,
    "test('case', function () {",
    `  var __ot_args = ${args};`,
    "  var __ot_clock = typeof performance !== 'undefined' && performance && typeof performance.now === 'function' ? performance : Date;",
    '  var __ot_t0 = __ot_clock.now();',
    '  var __ot_r = solution.apply(null, __ot_args);',
    '  var __ot_ms = __ot_clock.now() - __ot_t0;',
    '  __ot_report(__ot_r, __ot_ms, __ot_size(__ot_args));',
    '});',
    '',
  ].join('\n');
}

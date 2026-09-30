import type { PlaygroundCheck } from '@/core/content/schema';

/*
 * What a playground check means, as a pure function of facts gathered from a live
 * document. The facts come from the probe (probe.ts) running inside the preview frame in a
 * browser, or inside jsdom in the content gate. Keeping the judgement here, outside both,
 * gives one definition of "passed" for the checklist, the grade and the gate.
 */

export type { PlaygroundCheck };

/** What the probe found for one check. Only the parts the check asked about are present. */
export interface CheckFacts {
  /** Elements that match the selector, leaving out the playground's own. */
  readonly count: number;
  /** The selector does not parse. An authoring mistake the gate reports. */
  readonly invalid?: true;
  /** `textContent` of the first match. */
  readonly text?: string;
  /** The attribute of the first match, or null when it is absent. */
  readonly attribute?: string | null;
  /** The computed value of the property on the first match. */
  readonly style?: string;
  /** An action of the check found nothing to act on, so the page was never put in its state. */
  readonly missed?: MissedAction;
}

export interface MissedAction {
  readonly action: 'click' | 'type';
  readonly selector: string;
  /** The selector does not parse. */
  readonly invalid?: true;
  /** Typing went to an element that has no text value to type into. */
  readonly notField?: true;
}

export interface CheckResult {
  readonly passed: boolean;
  /** Plain text, shown under a failed item. Absent on a pass. */
  readonly reason?: string;
}

const MAX_QUOTED = 40;

const squash = (text: string): string => text.replace(/\s+/g, ' ').trim();

function quote(text: string): string {
  const short = text.length > MAX_QUOTED ? `${text.slice(0, MAX_QUOTED - 1)}…` : text;
  return `"${short}"`;
}

const fail = (reason: string): CheckResult => ({ passed: false, reason });
const PASS: CheckResult = { passed: true };

function countResult(check: PlaygroundCheck, count: number): CheckResult | null {
  const where = quote(check.selector);
  if (check.count === undefined) return count > 0 ? null : fail(`Nothing matches ${where} yet.`);
  if (count === check.count) return null;
  return fail(
    `Found ${count} match${count === 1 ? '' : 'es'} for ${where}. It needs ${check.count}.`,
  );
}

function textResult(check: PlaygroundCheck, facts: CheckFacts): CheckResult | null {
  if (check.text === undefined) return null;
  const actual = squash(facts.text ?? '');
  const wanted = squash(check.text);
  if (actual.toLowerCase().includes(wanted.toLowerCase())) return null;
  const first = `The first ${quote(check.selector)}`;
  return actual === ''
    ? fail(`${first} has no text. It needs ${quote(wanted)}.`)
    : fail(`${first} reads ${quote(actual)}. It needs ${quote(wanted)}.`);
}

function attributeResult(check: PlaygroundCheck, facts: CheckFacts): CheckResult | null {
  if (check.attribute === undefined) return null;
  const { name, value } = check.attribute;
  const actual = facts.attribute;
  if (actual === undefined || actual === null) {
    return fail(`The first ${quote(check.selector)} has no ${name} attribute.`);
  }
  if (value === undefined || actual === value) return null;
  return fail(`${name} is ${quote(actual)}. It needs ${quote(value)}.`);
}

/** Engines differ in the spacing and case of a computed value, inside a colour function above all. */
const normaliseStyle = (value: string): string => value.replace(/\s+/g, '').toLowerCase();

function styleResult(check: PlaygroundCheck, facts: CheckFacts): CheckResult | null {
  if (check.style === undefined) return null;
  const { property, value } = check.style;
  const actual = (facts.style ?? '').trim();
  if (actual !== '' && normaliseStyle(actual) === normaliseStyle(value)) return null;
  return actual === ''
    ? fail(`${property} has no value. It needs ${value}.`)
    : fail(`${property} is ${actual}. It needs ${value}.`);
}

function missedResult(missed: MissedAction | undefined): CheckResult | null {
  if (missed === undefined) return null;
  const where = quote(missed.selector);
  if (missed.invalid) return fail(`The selector ${where} is not valid CSS.`);
  if (missed.notField) {
    return fail(`The first ${where} is not an input or textarea, so it cannot take typing.`);
  }
  return fail(`Nothing matches ${where} to ${missed.action === 'click' ? 'click' : 'type into'}.`);
}

/** Judges one check. The first part that fails gives the reason, in the order they read. */
export function evaluateCheck(check: PlaygroundCheck, facts: CheckFacts): CheckResult {
  if (facts.invalid) return fail(`The selector ${quote(check.selector)} is not valid CSS.`);
  return (
    missedResult(facts.missed) ??
    countResult(check, facts.count) ??
    textResult(check, facts) ??
    attributeResult(check, facts) ??
    styleResult(check, facts) ??
    PASS
  );
}

/** Judges every check against the facts gathered for it, in order. */
export function evaluateChecks(
  checks: readonly PlaygroundCheck[],
  facts: readonly CheckFacts[],
): CheckResult[] {
  return checks.map((check, i) => {
    const found = facts[i];
    return found ? evaluateCheck(check, found) : fail('The preview has not been checked yet.');
  });
}

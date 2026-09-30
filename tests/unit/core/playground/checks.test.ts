import { describe, expect, it } from 'vitest';
import {
  evaluateCheck,
  evaluateChecks,
  type CheckFacts,
  type PlaygroundCheck,
} from '@/core/playground';

const h1: PlaygroundCheck = { label: 'The page has a heading', selector: 'h1' };
const facts = (over: Partial<CheckFacts> = {}): CheckFacts => ({ count: 1, ...over });

describe('evaluateCheck', () => {
  it('passes a bare selector when at least one element matches', () => {
    expect(evaluateCheck(h1, facts({ count: 3 }))).toEqual({ passed: true });
  });

  it('fails a bare selector with no match and names the selector', () => {
    expect(evaluateCheck(h1, facts({ count: 0 }))).toEqual({
      passed: false,
      reason: 'Nothing matches "h1" yet.',
    });
  });

  it('needs the exact count when one is given', () => {
    const one = { ...h1, count: 1 };
    expect(evaluateCheck(one, facts({ count: 1 })).passed).toBe(true);
    expect(evaluateCheck(one, facts({ count: 2 }))).toEqual({
      passed: false,
      reason: 'Found 2 matches for "h1". It needs 1.',
    });
    expect(evaluateCheck({ ...h1, count: 2 }, facts({ count: 1 })).reason).toBe(
      'Found 1 match for "h1". It needs 2.',
    );
  });

  it('passes a count of zero when nothing matches, so a check can forbid an element', () => {
    const none = { label: 'No font tags', selector: 'font', count: 0 };
    expect(evaluateCheck(none, facts({ count: 0 })).passed).toBe(true);
    expect(evaluateCheck(none, facts({ count: 1 })).passed).toBe(false);
  });

  it('reports an invalid selector as a failure, never a throw', () => {
    expect(evaluateCheck({ ...h1, selector: 'h1[' }, { count: 0, invalid: true })).toEqual({
      passed: false,
      reason: 'The selector "h1[" is not valid CSS.',
    });
  });

  it('matches text trimmed and case-insensitive, as a part of the first match', () => {
    const text = { ...h1, text: 'Pancakes' };
    expect(evaluateCheck(text, facts({ text: '  My PANCAKES recipe \n' })).passed).toBe(true);
    expect(evaluateCheck(text, facts({ text: 'Waffles' }))).toEqual({
      passed: false,
      reason: 'The first "h1" reads "Waffles". It needs "Pancakes".',
    });
  });

  it('collapses runs of white space before comparing text', () => {
    const text = { ...h1, text: 'Hot pancakes' };
    expect(evaluateCheck(text, facts({ text: 'Hot\n    pancakes' })).passed).toBe(true);
  });

  it('shortens long text in the reason', () => {
    const text = { ...h1, text: 'x' };
    const reason = evaluateCheck(text, facts({ text: 'a'.repeat(80) })).reason ?? '';
    expect(reason).toContain('…');
    expect(reason.length).toBeLessThan(90);
  });

  it('says when the first match has no text at all', () => {
    const text = { ...h1, text: 'Pancakes' };
    expect(evaluateCheck(text, facts({ text: '   ' })).reason).toBe(
      'The first "h1" has no text. It needs "Pancakes".',
    );
  });

  it('checks that an attribute exists, and its value when one is given', () => {
    const img = { label: 'The image has alt text', selector: 'img', attribute: { name: 'alt' } };
    expect(evaluateCheck(img, facts({ attribute: '' })).passed).toBe(true);
    expect(evaluateCheck(img, facts({ attribute: null }))).toEqual({
      passed: false,
      reason: 'The first "img" has no alt attribute.',
    });
    const exact = { ...img, attribute: { name: 'lang', value: 'en' } };
    expect(evaluateCheck(exact, facts({ attribute: 'en' })).passed).toBe(true);
    expect(evaluateCheck(exact, facts({ attribute: 'fr' }))).toEqual({
      passed: false,
      reason: 'lang is "fr". It needs "en".',
    });
  });

  it('compares a computed style ignoring case and spacing', () => {
    const colour = {
      ...h1,
      style: { property: 'color', value: 'rgb(0, 128, 128)' },
    };
    expect(evaluateCheck(colour, facts({ style: 'RGB(0,128,128)' })).passed).toBe(true);
    expect(evaluateCheck(colour, facts({ style: 'rgb(0, 0, 0)' }))).toEqual({
      passed: false,
      reason: 'color is rgb(0, 0, 0). It needs rgb(0, 128, 128).',
    });
    expect(evaluateCheck(colour, facts({ style: '' })).reason).toBe(
      'color has no value. It needs rgb(0, 128, 128).',
    );
  });

  it('fails a text, attribute or style check whose facts were not gathered', () => {
    expect(evaluateCheck({ ...h1, text: 'a' }, facts()).passed).toBe(false);
    expect(evaluateCheck({ ...h1, attribute: { name: 'id' } }, facts()).passed).toBe(false);
    expect(
      evaluateCheck({ ...h1, style: { property: 'color', value: 'red' } }, facts()).passed,
    ).toBe(false);
  });

  it('reports the first failing part of a check that combines several', () => {
    const all = { ...h1, count: 1, text: 'Pancakes', attribute: { name: 'id' } };
    expect(evaluateCheck(all, facts({ count: 2, text: 'Pancakes', attribute: 'x' })).reason).toBe(
      'Found 2 matches for "h1". It needs 1.',
    );
    expect(evaluateCheck(all, facts({ text: 'Waffles', attribute: 'x' })).reason).toContain(
      'Waffles',
    );
    expect(evaluateCheck(all, facts({ text: 'Pancakes', attribute: null })).reason).toContain(
      'no id attribute',
    );
  });
});

describe('a check with actions', () => {
  const clicked = { ...h1, actions: [{ click: 'button' }] };

  it('fails, naming the selector, when an action found nothing to act on', () => {
    expect(
      evaluateCheck(clicked, facts({ missed: { action: 'click', selector: 'button' } })),
    ).toEqual({ passed: false, reason: 'Nothing matches "button" to click.' });
    expect(
      evaluateCheck(clicked, facts({ missed: { action: 'type', selector: 'input' } })).reason,
    ).toBe('Nothing matches "input" to type into.');
  });

  it('says when typing went to something that is not a field', () => {
    expect(
      evaluateCheck(clicked, facts({ missed: { action: 'type', selector: 'p', notField: true } }))
        .reason,
    ).toBe('The first "p" is not an input or textarea, so it cannot take typing.');
  });

  it('reports an action selector that is not valid CSS', () => {
    expect(
      evaluateCheck(clicked, facts({ missed: { action: 'click', selector: 'b[', invalid: true } }))
        .reason,
    ).toBe('The selector "b[" is not valid CSS.');
  });

  it('judges the page after the actions like any other check', () => {
    expect(evaluateCheck(clicked, facts()).passed).toBe(true);
  });
});

describe('evaluateChecks', () => {
  it('pairs each check with its facts in order', () => {
    const checks = [h1, { label: 'A paragraph', selector: 'p' }];
    expect(evaluateChecks(checks, [facts(), facts({ count: 0 })]).map((r) => r.passed)).toEqual([
      true,
      false,
    ]);
  });

  it('fails a check whose facts are missing, as when the preview has not reported yet', () => {
    expect(evaluateChecks([h1], [])).toEqual([
      { passed: false, reason: 'The preview has not been checked yet.' },
    ]);
  });
});

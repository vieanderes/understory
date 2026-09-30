import { describe, expect, it } from 'vitest';
import {
  boxSize,
  collapsedGap,
  collapseMargins,
  CONTAINER_WIDTH,
  DEFAULT_SCENARIO_ID,
  px,
  run,
  SCENARIO_IDS,
  SCENARIOS,
  scenarioById,
  stackLayout,
  type BoxInput,
  type ParentKind,
  type ScenarioId,
  type StackInput,
} from '@/core/labs/box-model-explorer';
import { mulberry32 } from '@/core/util';

const CARD: BoxInput = {
  width: 200,
  height: 96,
  padding: 16,
  paddingUnit: 'px',
  border: 2,
  margin: 16,
  boxSizing: 'content-box',
  containerWidth: 320,
};

const PARAGRAPHS: StackInput = {
  marginTopA: 16,
  marginBottomA: 24,
  marginTopB: 16,
  parent: 'plain',
  parentPadding: 8,
  parentBorder: 4,
};

describe('boxSize', () => {
  it('adds padding and border outside the declared size under content-box', () => {
    const r = boxSize(CARD);
    expect(r.content).toEqual({ width: 200, height: 96 });
    expect(r.paddingBox).toEqual({ width: 232, height: 128 });
    expect(r.borderBox).toEqual({ width: 236, height: 132 });
    expect(r.marginBox).toEqual({ width: 268, height: 164 });
  });

  it('keeps the declared size as the border box under border-box', () => {
    const r = boxSize({ ...CARD, boxSizing: 'border-box' });
    expect(r.borderBox).toEqual({ width: 200, height: 96 });
    expect(r.content).toEqual({ width: 164, height: 60 });
    expect(r.marginBox).toEqual({ width: 232, height: 128 });
  });

  it('floors the content at zero and lets the border box grow when padding and border exceed it', () => {
    const r = boxSize({ ...CARD, boxSizing: 'border-box', width: 20, height: 20 });
    expect(r.content).toEqual({ width: 0, height: 0 });
    expect(r.borderBox).toEqual({ width: 36, height: 36 });
  });

  it('resolves percentage padding against the container width on all four sides', () => {
    const r = boxSize({ ...CARD, width: 160, height: 80, padding: 10, paddingUnit: 'percent' });
    expect(r.padding).toBe(32);
    expect(r.paddingBox).toEqual({ width: 224, height: 144 });
  });

  it('holds its invariants for any input (seeded)', () => {
    const rng = mulberry32(8);
    const int = (max: number) => Math.floor(rng.next() * (max + 1));
    for (let i = 0; i < 500; i += 1) {
      const input: BoxInput = {
        width: int(320),
        height: int(200),
        padding: int(40),
        paddingUnit: rng.next() < 0.5 ? 'px' : 'percent',
        border: int(16),
        margin: int(40),
        boxSizing: rng.next() < 0.5 ? 'content-box' : 'border-box',
        containerWidth: 320,
      };
      const r = boxSize(input);
      const extra = 2 * r.padding + 2 * input.border;
      expect(r.content.width).toBeGreaterThanOrEqual(0);
      expect(r.borderBox.width).toBeCloseTo(r.content.width + extra, 9);
      expect(r.borderBox.height).toBeCloseTo(r.content.height + extra, 9);
      expect(r.marginBox.width).toBeCloseTo(r.borderBox.width + 2 * input.margin, 9);
      if (input.boxSizing === 'border-box')
        expect(r.borderBox.width).toBeCloseTo(Math.max(input.width, extra), 9);
      else expect(r.content.width).toBe(input.width);
    }
  });
});

describe('collapsedGap (CSS 2.2 section 8.3.1)', () => {
  it('is the larger of two positive margins, not the sum', () => {
    expect(collapsedGap(24, 16)).toBe(24);
    expect(collapsedGap(16, 24)).toBe(24);
    expect(collapsedGap(0, 0)).toBe(0);
  });

  it('deducts the most negative margin from the largest positive one', () => {
    expect(collapsedGap(24, -8)).toBe(16);
    expect(collapsedGap(-8, 24)).toBe(16);
  });

  it('is the most negative margin when none is positive', () => {
    expect(collapsedGap(-8, -24)).toBe(-24);
  });

  it('collapses any number of adjoining margins', () => {
    expect(collapseMargins([8, 32, -4, -12])).toBe(20);
    expect(collapseMargins([])).toBe(0);
  });

  it('is symmetric and never exceeds the sum of two positive margins (seeded)', () => {
    const rng = mulberry32(83);
    for (let i = 0; i < 500; i += 1) {
      const a = Math.floor(rng.next() * 97) - 32;
      const b = Math.floor(rng.next() * 97) - 32;
      expect(collapsedGap(a, b)).toBe(collapsedGap(b, a));
      if (a >= 0 && b >= 0) {
        expect(collapsedGap(a, b)).toBe(Math.max(a, b));
        expect(collapsedGap(a, b)).toBeLessThanOrEqual(a + b);
      }
    }
  });
});

describe('stackLayout', () => {
  it('collapses siblings and lets the first margin escape a plain parent', () => {
    expect(stackLayout(PARAGRAPHS)).toEqual({
      siblingsCollapse: true,
      gap: 24,
      parentCollapses: true,
      childOffset: 0,
      parentOffset: 16,
    });
  });

  it.each<[ParentKind, number]>([
    ['padding', 8 + 16],
    ['border', 4 + 16],
    ['flow-root', 16],
  ])('keeps the first margin inside a %s parent, siblings still collapse', (parent, offset) => {
    const r = stackLayout({ ...PARAGRAPHS, parent });
    expect(r.parentCollapses).toBe(false);
    expect(r.childOffset).toBe(offset);
    expect(r.parentOffset).toBe(0);
    expect(r.gap).toBe(24);
  });

  it.each<ParentKind>(['flex', 'grid'])('sums sibling margins in a %s parent', (parent) => {
    const r = stackLayout({ ...PARAGRAPHS, parent });
    expect(r.siblingsCollapse).toBe(false);
    expect(r.gap).toBe(40);
    expect(r.childOffset).toBe(16);
    expect(r.parentOffset).toBe(0);
  });
});

describe('scenarios and frames', () => {
  it('ships four named scenarios in one 320 px column, each with a prompt', () => {
    expect(SCENARIO_IDS).toEqual([
      'profile-card',
      'percent-padding',
      'stacked-paragraphs',
      'flex-paragraphs',
    ]);
    expect(CONTAINER_WIDTH).toBe(320);
    expect(SCENARIO_IDS).toContain(DEFAULT_SCENARIO_ID);
    for (const s of SCENARIOS) expect(s.prompt).toMatch(/^Before you step: /);
  });

  it('throws on an unknown scenario id', () => {
    expect(() => scenarioById('nope' as ScenarioId)).toThrow(RangeError);
  });

  it('starts on the setup, accumulates arithmetic, and reveals only on the last frame', () => {
    for (const s of SCENARIOS) {
      const frames = run(s);
      expect(frames[0]?.focus).toBe('setup');
      expect(frames[0]?.arithmetic).toEqual([]);
      expect(frames.map((f) => f.revealed)).toEqual([...frames.slice(1).map(() => false), true]);
      for (let i = 1; i < frames.length; i += 1)
        expect(frames[i]!.arithmetic.length).toBeGreaterThanOrEqual(
          frames[i - 1]!.arithmetic.length,
        );
      for (const f of frames) expect(f.status).not.toMatch(/!|—/);
    }
  });

  it('walks a content-box card from content to margin', () => {
    const frames = run(scenarioById('profile-card'));
    expect(frames.map((f) => f.focus)).toEqual([
      'setup',
      'content',
      'padding',
      'border',
      'margin',
      'measured',
    ]);
    expect(frames.at(-1)?.arithmetic.map((l) => l.result)).toEqual([
      '200 × 96',
      '232',
      '236',
      '268',
    ]);
  });

  it('subtracts under border-box', () => {
    const base = scenarioById('profile-card');
    if (base.kind !== 'box') throw new Error('expected a box scenario');
    const frames = run({ ...base, box: { ...base.box, boxSizing: 'border-box' } });
    expect(frames[1]?.arithmetic[0]).toEqual({
      label: 'Content width',
      expression: 'max(0, 200 − 2 × 16 − 2 × 2)',
      result: '164',
    });
  });

  it('resolves the percentage first in the banner scenario', () => {
    const frames = run(scenarioById('percent-padding'));
    expect(frames[1]?.focus).toBe('padding');
    expect(frames[1]?.arithmetic[0]).toEqual({
      label: 'Padding',
      expression: '10% × 320',
      result: '32',
    });
  });

  it('explains the stacked paragraphs: larger margin, escaped first margin', () => {
    const frames = run(scenarioById('stacked-paragraphs'));
    expect(frames.map((f) => f.focus)).toEqual(['setup', 'siblings', 'parent', 'measured']);
    expect(frames.at(-1)?.arithmetic).toEqual([
      { label: 'Gap between paragraphs', expression: 'max(24, 16)', result: '24' },
      { label: 'First paragraph inside parent', expression: 'margin escapes', result: '0' },
    ]);
  });

  it('explains the flex parent: sum of margins, first margin kept inside', () => {
    const frames = run(scenarioById('flex-paragraphs'));
    expect(frames.at(-1)?.arithmetic).toEqual([
      { label: 'Gap between paragraphs', expression: '24 + 16', result: '40' },
      { label: 'First paragraph inside parent', expression: '16', result: '16' },
    ]);
  });

  it('shows padding and border of the parent in the sum, and negative margins', () => {
    const base = scenarioById('stacked-paragraphs');
    if (base.kind !== 'stack') throw new Error('expected a stack scenario');
    const padded = run({ ...base, stack: { ...base.stack, parent: 'padding' } });
    expect(padded.at(-1)?.arithmetic[1]?.expression).toBe('8 + 16');
    const bordered = run({ ...base, stack: { ...base.stack, parent: 'border' } });
    expect(bordered.at(-1)?.arithmetic[1]?.expression).toBe('4 + 16');
    const negative = run({ ...base, stack: { ...base.stack, marginTopB: -8 } });
    expect(negative.at(-1)?.arithmetic[0]).toEqual({
      label: 'Gap between paragraphs',
      expression: 'max(0, 24, −8) + min(0, 24, −8)',
      result: '16',
    });
  });
});

describe('px', () => {
  it('prints at most two decimals, no trailing zeros, a true minus sign', () => {
    expect(px(106.6666)).toBe('106.67');
    expect(px(96)).toBe('96');
    expect(px(22.4)).toBe('22.4');
    expect(px(-8)).toBe('−8');
    expect(px(-0.001)).toBe('0');
  });
});

import { describe, expect, it } from 'vitest';
import {
  CONTAINER_WIDTH,
  DEFAULT_SCENARIO_ID,
  px,
  run,
  SCENARIO_IDS,
  SCENARIOS,
  scenarioById,
  type FlexScenario,
  type GridScenario,
  type ScenarioId,
} from '@/core/labs/flex-grid-playground';

const flex = (id: ScenarioId) => scenarioById(id) as FlexScenario;
const grid = (id: ScenarioId) => scenarioById(id) as GridScenario;
const results = (s: Parameters<typeof run>[0]) =>
  run(s)
    .at(-1)!
    .arithmetic.map((l) => l.result);

describe('scenarios', () => {
  it('ships three flex and two grid scenarios in one 320 px column, each with a prompt', () => {
    expect(SCENARIO_IDS).toEqual([
      'grow-row',
      'shrink-row',
      'long-text',
      'fr-columns',
      'few-items',
    ]);
    expect(SCENARIO_IDS).toContain(DEFAULT_SCENARIO_ID);
    for (const s of SCENARIOS) {
      expect(s.containerWidth).toBe(CONTAINER_WIDTH);
      expect(s.prompt).toMatch(/^Before you step: /);
    }
  });

  it('throws on an unknown scenario id', () => {
    expect(() => scenarioById('nope' as ScenarioId)).toThrow(RangeError);
  });
});

describe('frames', () => {
  it('starts on the setup, accumulates arithmetic, and reveals only on the last frame', () => {
    for (const s of SCENARIOS) {
      const frames = run(s);
      expect(frames[0]?.focus).toBe('setup');
      expect(frames[0]?.arithmetic).toEqual([]);
      expect(frames.at(-1)?.focus).toBe('measured');
      expect(frames.filter((f) => f.revealed)).toHaveLength(1);
      for (let i = 1; i < frames.length; i += 1)
        expect(frames[i]!.arithmetic.length).toBeGreaterThanOrEqual(
          frames[i - 1]!.arithmetic.length,
        );
      for (const f of frames) expect(f.status).not.toMatch(/!|—/);
    }
  });

  it('walks growth: base sizes, free space, shares', () => {
    const frames = run(flex('grow-row'));
    expect(frames.map((f) => f.focus)).toEqual([
      'setup',
      'base',
      'free-space',
      'shares',
      'measured',
    ]);
    expect(frames.at(-1)?.arithmetic).toEqual([
      { label: 'Sum of starting sizes', expression: '80 + 80 + 80', result: '240' },
      { label: 'Free space', expression: '320 − 16 − 240', result: '64' },
      { label: 'Inbox', expression: '80 + 64 × 1 ÷ 4', result: '96' },
      { label: 'Sent', expression: '80 + 64 × 1 ÷ 4', result: '96' },
      { label: 'Archive', expression: '80 + 64 × 2 ÷ 4', result: '112' },
    ]);
    expect(frames[3]?.active).toEqual([0, 1, 2]);
    expect(frames.at(-1)?.status).toContain('96, 96, 112');
  });

  it('walks weighted shrink, the clamp, and the redistribution', () => {
    const frames = run(flex('shrink-row'));
    expect(frames.map((f) => f.focus)).toEqual([
      'setup',
      'base',
      'free-space',
      'shares',
      'clamp',
      'shares',
      'measured',
    ]);
    expect(frames[2]?.status).toContain('120 px are missing');
    expect(frames[3]?.arithmetic.at(-2)).toEqual({
      label: 'Monthly',
      expression: '120 − 120 × 102 ÷ 386',
      result: '88.29',
    });
    expect(frames[4]?.active).toEqual([1]);
    expect(frames[4]?.status).toContain('11.71 px');
    expect(frames[5]?.status).toMatch(/^Again, without the frozen items/);
    expect(results(flex('shrink-row')).slice(-2)).toEqual(['135.92', '84.08']);
  });

  it('explains the checkout row that will not shrink, and its fix', () => {
    const base = flex('long-text');
    const measured = (minWidth: 0 | 'auto'): FlexScenario => ({
      ...base,
      items: base.items.map((it, i) => (i === 0 ? { ...it, minWidth, minContent: 260 } : it)),
    });
    const stuck = run(measured('auto'));
    expect(stuck.map((f) => f.focus)).toEqual(['setup', 'base', 'free-space', 'measured']);
    expect(stuck[1]?.status).toContain('Product name cannot go below a minimum of 260');
    expect(stuck[2]?.status).toContain('No item can flex');
    expect(stuck.at(-1)?.status).toContain('overflow the row by 68 px');

    const fixed = run(measured(0));
    expect(fixed[2]?.status).toBe(
      '174 px are free, so the grow factors apply. Quantity and Price cannot flex and stay as they are.',
    );
    expect(fixed.at(-1)?.status).toContain('192, 56, 72');
    expect(fixed.at(-1)?.status).not.toContain('overflow');
  });

  it('names a single frozen item, and the case where nothing is free or missing', () => {
    const base = flex('grow-row');
    const one = run({
      ...base,
      items: base.items.map((it, i) => (i === 0 ? { ...it, grow: 0 } : it)),
    });
    expect(one[2]?.status).toContain('Inbox cannot flex and stays as it is.');
    const exact = run({ ...base, gap: 0, items: base.items.map((it) => ({ ...it, basis: 106 })) });
    expect(exact[2]?.status).toContain('2 px are free');
    const full = run({
      ...base,
      gap: 0,
      containerWidth: 240,
    });
    expect(full[2]?.status).toBe('Nothing is free and nothing is missing.');
  });

  it('walks a track list: fixed sizes first, then 1fr', () => {
    const frames = run(grid('fr-columns'));
    expect(frames.map((f) => f.focus)).toEqual(['setup', 'fixed', 'fr', 'measured']);
    expect(frames[0]?.status).toContain('96px 1fr 2fr');
    expect(frames[1]?.active).toEqual([0]);
    expect(frames[2]?.active).toEqual([1, 2]);
    expect(frames.at(-1)?.arithmetic).toEqual([
      { label: 'Left after fixed sizes', expression: '320 − 16 − 96', result: '208' },
      { label: '1fr', expression: '208 ÷ 3', result: '69.33' },
    ]);
  });

  it('adds the maximise, floor and stretch steps when the tracks need them', () => {
    const base = grid('fr-columns');
    const maximise = run({
      ...base,
      tracks: [
        { kind: 'minmax', min: 80, max: 120, maxUnit: 'px' },
        { kind: 'fr', fr: 1 },
        { kind: 'fr', fr: 2 },
      ],
    });
    expect(maximise.map((f) => f.focus)).toEqual(['setup', 'fixed', 'maximise', 'fr', 'measured']);
    expect(maximise[2]?.active).toEqual([0]);

    const floored = run({
      ...base,
      gap: 0,
      tracks: [
        { kind: 'minmax', min: 150, max: 1, maxUnit: 'fr' },
        { kind: 'fr', fr: 1 },
        { kind: 'fr', fr: 1 },
      ],
    });
    expect(floored.find((f) => f.focus === 'fr')?.status).toMatch(
      /^A flexible track whose minimum/,
    );

    const stretch = run({
      ...base,
      tracks: [
        { kind: 'auto', content: 40 },
        { kind: 'px', size: 96 },
        { kind: 'auto', content: 40 },
      ],
    });
    expect(stretch.map((f) => f.focus)).toEqual(['setup', 'fixed', 'stretch', 'measured']);
    expect(stretch[2]?.active).toEqual([0, 2]);
    expect(stretch[2]?.arithmetic.at(-1)?.result).toBe('64');
  });

  it('counts repetitions, then keeps or collapses the empty column', () => {
    const fill = run(grid('few-items'));
    expect(fill.map((f) => f.focus)).toEqual([
      'setup',
      'repeat',
      'repeat',
      'fixed',
      'fr',
      'measured',
    ]);
    expect(fill[1]?.arithmetic[0]).toEqual({
      label: 'Repetitions',
      expression: 'floor(328 ÷ (100 + 8))',
      result: '3',
    });
    expect(fill[2]?.status).toContain('auto-fill keeps the 1 empty one');
    expect(fill[2]?.active).toEqual([2]);
    expect(fill.at(-1)?.status).toContain('101.33, 101.33, 101.33');

    const base = grid('few-items');
    const fit = run({ ...base, tracks: [{ ...base.tracks[0]!, mode: 'auto-fit' } as never] });
    expect(fit[2]?.status).toContain('auto-fit collapses the 1 empty one');
    expect(fit.at(-1)?.status).toContain('156, 156, 0');

    const lone = run({
      ...base,
      itemCount: 1,
      tracks: [{ ...base.tracks[0]!, mode: 'auto-fit' } as never],
    });
    expect(lone[2]?.status).toContain('the 2 empty ones');
    const full = run({ ...base, itemCount: 5 });
    expect(full.map((f) => f.focus)).toEqual(['setup', 'repeat', 'fixed', 'fr', 'measured']);
    const wide = run({
      ...base,
      tracks: [{ kind: 'px', size: 96 }, { ...base.tracks[0]!, min: 200 } as never],
    });
    expect(wide[1]?.status).toContain('1 fits');
    expect(wide[1]?.arithmetic[0]?.expression).toBe('floor(224 ÷ (200 + 8))');
  });
});

describe('px', () => {
  it('prints at most two decimals and a true minus sign', () => {
    expect(px(69.3333)).toBe('69.33');
    expect(px(-12)).toBe('−12');
    expect(px(-0.0001)).toBe('0');
  });
});

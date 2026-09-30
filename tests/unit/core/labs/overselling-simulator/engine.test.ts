import { describe, expect, it } from 'vitest';
import {
  DEFAULT_SCENARIO,
  HOLDS_STRATEGIES,
  RESERVE_STRATEGIES,
  SCENARIOS,
  STRATEGIES,
  initialWorld,
  isHoldsStrategy,
  normalise,
  run,
  scenarioById,
  type RunConfig,
} from '@/core/labs/overselling-simulator';

const BASE: RunConfig = {
  strategy: 'check-then-act',
  buyers: 2,
  capacity: 1,
  sold: 0,
  qtyEach: 1,
  seed: 7,
};

describe('normalise', () => {
  it('clamps every parameter into the range the lab can show', () => {
    expect(normalise({ ...BASE, buyers: 99, capacity: 1e9, sold: -4, qtyEach: 9 })).toMatchObject({
      buyers: 6,
      capacity: 9999,
      sold: 0,
      qtyEach: 4,
    });
    expect(normalise({ ...BASE, buyers: 0, capacity: 0, sold: 50, qtyEach: 0 })).toMatchObject({
      buyers: 2,
      capacity: 1,
      sold: 1,
      qtyEach: 1,
    });
  });

  it('never lets capacity drop below one purchase, and drops fractions and NaN', () => {
    expect(normalise({ ...BASE, capacity: 1, qtyEach: 3 }).capacity).toBe(3);
    expect(normalise({ ...BASE, buyers: 3.9, seed: Number.NaN })).toMatchObject({
      buyers: 3,
      seed: 0,
    });
  });

  it('fixes the cast of the holds variant: A holds the last tickets', () => {
    const config = normalise({ ...BASE, strategy: 'holds-guarded', capacity: 10, sold: 2 });
    expect(config).toMatchObject({ buyers: 3, sold: 9 });
    const world = initialWorld(config);
    expect(world.actors.map((a) => [a.name, a.program, a.pc])).toEqual([
      ['A', 'confirm', 'claim'],
      ['Sweep', 'sweep', 's-claim'],
      ['B', 'reserve-then-confirm', 'reserve'],
    ]);
    expect(world.store).toMatchObject({ sold: 9, held: 1 });
    expect(world.store.holds).toEqual([
      { id: 0, owner: 'A', qty: 1, status: 'active', overdue: true },
    ]);
  });
});

describe('initialWorld', () => {
  it('names the buyers A to F and starts each at the first step of its strategy', () => {
    const world = initialWorld({ ...BASE, buyers: 6 });
    expect(world.actors.map((a) => a.name).join('')).toBe('ABCDEF');
    expect(new Set(world.actors.map((a) => a.pc))).toEqual(new Set(['select']));
    expect(initialWorld({ ...BASE, strategy: 'atomic-update' }).actors[0]?.pc).toBe('update');
    expect(initialWorld({ ...BASE, strategy: 'pessimistic-lock' }).actors[0]?.pc).toBe('lock');
    expect(initialWorld({ ...BASE, strategy: 'holds-read-then-write' }).actors[1]?.pc).toBe(
      's-select',
    );
  });
});

describe('run', () => {
  it('is reproducible: the same seed gives the same interleaving', () => {
    expect(run(BASE)).toEqual(run(BASE));
  });

  it('gives different interleavings for different seeds', () => {
    const schedules = new Set(
      Array.from({ length: 20 }, (_, seed) => run({ ...BASE, seed }).schedule.join('')),
    );
    expect(schedules.size).toBeGreaterThan(1);
  });

  it('starts with a frame in which nothing has run', () => {
    const first = run(BASE).frames[0];
    expect(first).toMatchObject({ tick: 0, event: null, waiting: [] });
    expect(first?.metrics).toMatchObject({ soldFinal: 0, ticks: 0, invariantBrokenAtTick: null });
  });

  it('has one frame per tick plus the first, and replays from its own schedule', () => {
    const result = run(BASE);
    expect(result.frames).toHaveLength(result.schedule.length + 1);
    expect(result.metrics.ticks).toBe(result.schedule.length);
    const replay = run({ ...BASE, seed: 999, schedule: result.schedule });
    expect(replay.frames).toEqual(result.frames);
  });

  it('follows a schedule prefix, then lets the seed finish the run', () => {
    const result = run({ ...BASE, schedule: [1, 1] });
    expect(result.schedule.slice(0, 2)).toEqual([1, 1]);
    expect(result.schedule.length).toBeGreaterThan(2);
    expect(result.frames.at(-1)?.world.actors.every((a) => a.status === 'done')).toBe(true);
  });

  it('drops the rest of a schedule at the first entry that names an actor who cannot move', () => {
    const schedule = [0, 1, 1, 0, 0, 0, 1, 1, 1];
    const result = run({ ...BASE, strategy: 'pessimistic-lock', schedule });
    // B is asleep on the lock at tick 3, so only A can be picked.
    expect(result.schedule.slice(0, 3)).toEqual([0, 1, 0]);
    expect(result.metrics.invariantBrokenAtTick).toBe(null);
  });

  it('measures latency from a buyer’s first step to its last', () => {
    const result = run({ ...BASE, schedule: [0, 1, 0, 1, 0, 1] });
    expect(result.frames.at(-1)?.stats).toEqual([
      { steps: 3, waits: 0, startedAtTick: 1, finishedAtTick: 5 },
      { steps: 3, waits: 0, startedAtTick: 2, finishedAtTick: 6 },
    ]);
    expect(result.metrics.latency).toBe(10);
  });

  it('records the first tick at which the invariant broke, and keeps it', () => {
    const result = run({ ...BASE, buyers: 3, schedule: [0, 1, 2, 0, 1, 2, 0, 1, 2] });
    expect(result.metrics).toMatchObject({ invariantBrokenAtTick: 8, oversoldBy: 2 });
    expect(result.frames[7]?.metrics.invariantBrokenAtTick).toBe(null);
    expect(result.frames[8]?.metrics).toMatchObject({ invariantBrokenAtTick: 8, oversoldBy: 1 });
  });

  it('reserves qtyEach tickets per buyer', () => {
    const result = run({ ...BASE, strategy: 'atomic-update', capacity: 5, qtyEach: 2, buyers: 3 });
    expect(result.metrics.soldFinal).toBe(4);
  });
});

describe('catalogue', () => {
  it('describes every strategy with a sketch, a verdict and a cost', () => {
    for (const id of [...RESERVE_STRATEGIES, ...HOLDS_STRATEGIES]) {
      const info = STRATEGIES[id];
      expect(info.id).toBe(id);
      expect(info.sketch.length).toBeGreaterThan(0);
      expect(info.summary.length).toBeGreaterThan(20);
    }
    expect(RESERVE_STRATEGIES).toHaveLength(7);
    expect(isHoldsStrategy('holds-guarded')).toBe(true);
    expect(isHoldsStrategy('optimistic')).toBe(false);
  });

  it('points every step at a line that exists in its sketch', () => {
    for (const id of [...RESERVE_STRATEGIES, ...HOLDS_STRATEGIES]) {
      for (let seed = 0; seed < 25; seed += 1) {
        const result = run({ ...BASE, strategy: id, buyers: 3, capacity: 2, seed });
        for (const frame of result.frames.slice(1)) {
          expect(STRATEGIES[id].sketch[frame.event?.line ?? -1]).toBeDefined();
        }
      }
    }
  });

  it('ships four scenarios, each with a prediction prompt and a matching strategy family', () => {
    expect(SCENARIOS.map((s) => s.id)).toEqual([
      'last-ticket',
      'on-sale',
      'four-oh-two',
      'abandoned-checkout',
    ]);
    for (const s of SCENARIOS) {
      expect(s.prediction).toMatch(/^Before you step: /);
      expect(isHoldsStrategy(s.strategy)).toBe(s.family === 'holds');
    }
    expect(scenarioById('on-sale')?.buyers).toBe(6);
    expect(scenarioById('nope')).toBeUndefined();
    expect(DEFAULT_SCENARIO.id).toBe('last-ticket');
  });

  it('opens each scenario on a seeded run that shows its point', () => {
    const final = (id: string) => {
      const s = scenarioById(id);
      if (!s) throw new Error(id);
      return run(s).metrics;
    };
    expect(final('last-ticket')).toMatchObject({ soldFinal: 101, oversoldBy: 1 });
    expect(final('four-oh-two')).toMatchObject({ soldFinal: 402, oversoldBy: 2 });
    expect(final('abandoned-checkout')).toMatchObject({ soldFinal: 401, oversoldBy: 1 });
    const onSale = final('on-sale');
    expect(onSale.soldFinal).toBe(3);
    expect(onSale.retries).toBeGreaterThan(0);
    expect(onSale.wastedSteps).toBeGreaterThan(0);
  });
});

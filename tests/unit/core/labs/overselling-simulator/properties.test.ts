import { describe, expect, it } from 'vitest';
import { intBelow, mulberry32 } from '@/core/util';
import {
  HOLDS_STRATEGIES,
  RESERVE_STRATEGIES,
  STRATEGIES,
  advance,
  countOutcomes,
  enabled,
  enumerateSchedules,
  initialWorld,
  run,
  type ReserveStrategy,
  type RunConfig,
  type Strategy,
} from '@/core/labs/overselling-simulator';

const SAFE: readonly ReserveStrategy[] = [
  'atomic-update',
  'pessimistic-lock',
  'optimistic',
  'constraint',
  'serializable',
];
const RACY: readonly ReserveStrategy[] = ['check-then-act', 'transaction'];

/**
 * A quiet shop: each buyer runs to completion before the next one starts. Always giving
 * the turn to the lowest-numbered actor that can move produces exactly that, because a
 * buyer stays the lowest that can move until it finishes.
 *
 * It is built by stepping the simulation rather than by repeating each id a fixed number
 * of times: programs differ in length, and `run` only follows a schedule while it names
 * an actor that can move.
 */
function serialSchedule(config: RunConfig): number[] {
  let world = initialWorld(config);
  const picks: number[] = [];
  for (let can = enabled(world); can.length > 0; can = enabled(world)) {
    const next = Math.min(...can);
    picks.push(next);
    world = advance(world, next).world;
  }
  return picks;
}

const lastTicket = (strategy: Strategy, extra: Partial<RunConfig> = {}): RunConfig => ({
  strategy,
  buyers: 2,
  capacity: 1,
  sold: 0,
  qtyEach: 1,
  seed: 0,
  ...extra,
});

/** Runs every interleaving there is, not a sample. */
function everyRun(config: RunConfig) {
  return enumerateSchedules(config).map((schedule) => {
    const result = run({ ...config, schedule });
    expect(result.schedule).toEqual(schedule);
    return result;
  });
}

describe('every interleaving of two buyers, enumerated', () => {
  it.each(SAFE)('%s never breaks sold ≤ capacity', (strategy) => {
    for (const capacity of [1, 2, 3]) {
      const runs = everyRun(lastTicket(strategy, { capacity }));
      expect(runs.length).toBeGreaterThan(1);
      for (const r of runs) {
        expect(r.metrics.invariantBrokenAtTick).toBe(null);
        for (const frame of r.frames) {
          expect(frame.world.store.sold).toBeLessThanOrEqual(capacity);
        }
      }
    }
  });

  it.each(SAFE)('%s sells every ticket it can: safety is not bought by refusing', (strategy) => {
    for (const capacity of [1, 2, 3]) {
      for (const r of everyRun(lastTicket(strategy, { capacity }))) {
        expect(r.metrics.soldFinal).toBe(Math.min(capacity, 2));
      }
    }
  });

  it.each(RACY)('%s breaks for some orderings and holds for others', (strategy) => {
    const runs = everyRun(lastTicket(strategy));
    const broken = runs.filter((r) => r.metrics.invariantBrokenAtTick !== null);
    expect(broken.length).toBeGreaterThan(0);
    expect(broken.length).toBeLessThan(runs.length);
  });

  it('agrees with what each strategy says about itself', () => {
    for (const id of [...RESERVE_STRATEGIES, ...HOLDS_STRATEGIES]) {
      const { oversold } = countOutcomes(id, 2);
      expect(oversold > 0n).toBe(STRATEGIES[id].verdict === 'breaks');
    }
  });

  it('only the serial orderings of check-then-act are safe: 18 of 20 oversell', () => {
    expect(countOutcomes('check-then-act', 2)).toEqual({ total: 20n, oversold: 18n });
    expect(countOutcomes('transaction', 2)).toEqual({ total: 50n, oversold: 48n });
    expect(countOutcomes('atomic-update', 2)).toEqual({ total: 6n, oversold: 0n });
  });

  it('every buyer finishes, with an outcome, and the lock ends free', () => {
    for (const strategy of RESERVE_STRATEGIES) {
      for (const r of everyRun(lastTicket(strategy))) {
        const end = r.frames.at(-1)?.world;
        expect(end?.actors.every((a) => a.status === 'done' && a.outcome !== null)).toBe(true);
        expect(end?.store.lock).toEqual({ holder: null, queue: [] });
        expect(end?.store.pendingSold).toBe(null);
      }
    }
  });

  it('counts a ticket as sold exactly when a buyer was told so', () => {
    for (const strategy of RESERVE_STRATEGIES) {
      for (const r of everyRun(lastTicket(strategy, { capacity: 2, qtyEach: 2 }))) {
        const bought = r.frames.at(-1)?.world.actors.filter((a) => a.outcome === 'bought').length;
        expect(r.metrics.soldFinal).toBe((bought ?? 0) * 2);
      }
    }
  });
});

describe('the holds variant, every interleaving of payment, sweep and new buyer', () => {
  it('guarded transitions never oversell and never corrupt held', () => {
    const runs = everyRun(lastTicket('holds-guarded', { capacity: 400 }));
    expect(runs).toHaveLength(36);
    for (const r of runs) {
      expect(r.metrics.invariantBrokenAtTick).toBe(null);
      for (const frame of r.frames) {
        const { sold, held, capacity } = frame.world.store;
        expect(held).toBeGreaterThanOrEqual(0);
        expect(sold + held).toBeLessThanOrEqual(capacity);
      }
      // The last ticket is never sold twice. It can still be sold to nobody: see below.
      const winners = r.frames.at(-1)?.world.actors.filter((a) => a.outcome === 'bought');
      expect(winners?.length).toBeLessThanOrEqual(1);
    }
  });

  it('loses the sale when the sweep wins the race, without ever overselling', () => {
    // The guarded transitions keep the invariant, and they are still not the whole answer.
    // One ordering: the sweep locks the hold row, A's payment waits behind it, B reads the
    // hold as live and is told the event is sold out, then the sweep commits and A's
    // payment finds no hold to confirm. A is refunded, B has gone, and the ticket returns
    // to stock unsold. The failure is availability, not correctness.
    const runs = everyRun(lastTicket('holds-guarded', { capacity: 400 }));
    const lost = runs.filter(
      (r) => r.frames.at(-1)?.world.actors.every((a) => a.outcome !== 'bought') ?? false,
    );
    expect(lost.length).toBeGreaterThan(0);
    for (const r of lost) {
      expect(r.metrics.invariantBrokenAtTick).toBe(null);
      const outcomes = r.frames.at(-1)?.world.actors.map((a) => a.outcome);
      expect(outcomes).toContain('refunded');
      expect(outcomes).toContain('sold-out');
      // The capacity came back, so the shop could have sold it to someone still waiting.
      expect(r.frames.at(-1)?.world.store.held).toBe(0);
    }
  });

  it('read-then-write oversells for some orderings and holds for others', () => {
    const runs = everyRun(lastTicket('holds-read-then-write', { capacity: 400 }));
    const broken = runs.filter((r) => r.metrics.invariantBrokenAtTick !== null);
    expect(runs).toHaveLength(103);
    expect(broken).toHaveLength(48);
  });
});

describe('countOutcomes', () => {
  it('matches the written-out enumeration', () => {
    for (const strategy of [...RESERVE_STRATEGIES, ...HOLDS_STRATEGIES]) {
      for (const buyers of [2, 3]) {
        if (buyers === 3 && (strategy === 'optimistic' || strategy === 'serializable')) continue;
        const config = lastTicket(strategy, { buyers, capacity: 2 });
        const runs = enumerateSchedules(config, 1_000_000).map((s) =>
          run({ ...config, schedule: s }),
        );
        const counted = countOutcomes(strategy, buyers, { capacity: 2 });
        expect(counted.total).toBe(BigInt(runs.length));
        expect(counted.oversold).toBe(
          BigInt(runs.filter((r) => r.metrics.invariantBrokenAtTick !== null).length),
        );
      }
    }
  });

  it('counts six buyers without listing them', () => {
    const racy = countOutcomes('check-then-act', 6, { capacity: 3 });
    expect(racy.total).toBe(129_768_912_000n);
    expect(racy.oversold).toBeLessThan(racy.total);
    expect(countOutcomes('serializable', 6, { capacity: 3 }).oversold).toBe(0n);
    expect(countOutcomes('optimistic', 6, { capacity: 3 }).oversold).toBe(0n);
  });

  it('starts from the given sold and capacity', () => {
    expect(countOutcomes('check-then-act', 3, { capacity: 400, sold: 399 })).toEqual(
      countOutcomes('check-then-act', 3),
    );
  });
});

describe('enumerateSchedules', () => {
  it('refuses to list more than its limit', () => {
    expect(() => enumerateSchedules(lastTicket('optimistic', { buyers: 4 }), 50)).toThrow(
      /More than 50/,
    );
  });
});

describe('many seeds, two to six buyers, random parameters', () => {
  const rng = mulberry32(20260917);
  const cases = Array.from({ length: 400 }, (_, i) => {
    const qtyEach = 1 + intBelow(rng, 3);
    const capacity = qtyEach + intBelow(rng, 12);
    return {
      buyers: 2 + intBelow(rng, 5),
      capacity,
      sold: intBelow(rng, capacity + 1),
      qtyEach,
      seed: i,
    };
  });

  it.each(SAFE)('%s holds the invariant and sells all it can', (strategy) => {
    for (const c of cases) {
      const r = run({ strategy, ...c });
      expect(r.metrics.invariantBrokenAtTick).toBe(null);
      expect(r.metrics.oversoldBy).toBe(0);
      const room = Math.floor((c.capacity - c.sold) / c.qtyEach);
      expect(r.metrics.soldFinal).toBe(c.sold + Math.min(room, c.buyers) * c.qtyEach);
    }
  });

  it.each(RACY)('%s is found out by some seeds and passes others', (strategy) => {
    // Tight timing, where every buyer is mid-flight together, finds the bug at once. A
    // quiet shop, where buyers rarely overlap, is the serial schedule: it always passes.
    const tight = cases.map((c) => run({ strategy, ...c, sold: c.capacity - c.qtyEach }));
    expect(tight.some((r) => r.metrics.oversoldBy > 0)).toBe(true);
    const serial = cases.map((c) => {
      const config = { strategy, ...c };
      return run({ ...config, schedule: serialSchedule(config) });
    });
    expect(serial.every((r) => r.metrics.oversoldBy === 0)).toBe(true);
  });

  it('only waits where there is a lock, only retries where there is a loop', () => {
    for (const c of cases.slice(0, 120)) {
      const by = (strategy: Strategy) => run({ strategy, ...c }).metrics;
      expect(by('atomic-update')).toMatchObject({ waits: 0, retries: 0, aborts: 0, errors: 0 });
      expect(by('optimistic')).toMatchObject({ waits: 0, aborts: 0, errors: 0 });
      expect(by('pessimistic-lock')).toMatchObject({ retries: 0, aborts: 0, errors: 0 });
      expect(by('constraint')).toMatchObject({ waits: 0, retries: 0, aborts: 0 });
      const ssi = by('serializable');
      expect(ssi.retries).toBe(ssi.aborts);
      expect(ssi.errors).toBe(0);
    }
  });
});

import { describe, expect, it } from 'vitest';
import {
  advance,
  initialWorld,
  run,
  type RunConfig,
  type Strategy,
} from '@/core/labs/overselling-simulator';

/** Two buyers and one ticket left unless a test says otherwise. */
function play(strategy: Strategy, schedule: number[], overrides: Partial<RunConfig> = {}) {
  const result = run({
    strategy,
    buyers: 2,
    capacity: 1,
    sold: 0,
    qtyEach: 1,
    seed: 1,
    schedule,
    ...overrides,
  });
  // A test scripts the interleaving it cares about. Most script the whole run; a test
  // that only inspects the opening scripts a prefix and lets the seeded scheduler finish.
  expect(result.schedule.slice(0, schedule.length)).toEqual(schedule);
  return result;
}

const labels = (r: ReturnType<typeof run>) => r.frames.slice(1).map((f) => f.event?.label);
const outcomes = (r: ReturnType<typeof run>) => r.frames.at(-1)?.world.actors.map((a) => a.outcome);

describe('1 check-then-act', () => {
  it('oversells when both buyers read before either writes', () => {
    const r = play('check-then-act', [0, 1, 0, 1, 0, 1]);
    expect(labels(r)).toEqual([
      'SELECT → 0',
      'SELECT → 0',
      'check: room',
      'check: room',
      'UPDATE → 1',
      'UPDATE → 2',
    ]);
    expect(r.metrics).toMatchObject({ soldFinal: 2, oversoldBy: 1, invariantBrokenAtTick: 6 });
    expect(outcomes(r)).toEqual(['bought', 'bought']);
    expect(r.frames.at(-1)?.event?.message).toContain('The event is oversold');
  });

  it('holds when one buyer finishes before the other starts, which is why tests pass', () => {
    const r = play('check-then-act', [0, 0, 0, 1, 1]);
    expect(r.metrics).toMatchObject({ soldFinal: 1, oversoldBy: 0, invariantBrokenAtTick: null });
    expect(outcomes(r)).toEqual(['bought', 'sold-out']);
    expect(r.frames.at(-1)?.event).toMatchObject({ kind: 'app', label: 'check: sold out' });
  });

  it('marks database steps and application steps, and the sketch line each one runs', () => {
    const r = play('check-then-act', [0, 0, 0, 1, 1]);
    expect(r.frames.slice(1, 4).map((f) => [f.event?.kind, f.event?.line])).toEqual([
      ['db', 0],
      ['app', 1],
      ['db', 2],
    ]);
  });
});

describe('2 one transaction at READ COMMITTED', () => {
  const racing = [0, 1, 0, 1, 0, 1, 0, 1, 1];

  it('still oversells: both read the same committed count', () => {
    const r = play('transaction', racing);
    expect(r.metrics).toMatchObject({ soldFinal: 2, oversoldBy: 1, invariantBrokenAtTick: 9 });
    expect(outcomes(r)).toEqual(['bought', 'bought']);
  });

  it('keeps an uncommitted write invisible until COMMIT', () => {
    const r = play('transaction', racing);
    const afterUpdate = r.frames[5]?.world.store;
    expect(afterUpdate).toMatchObject({ sold: 0, pendingSold: 1, lock: { holder: 0 } });
    const afterCommit = r.frames[7]?.world.store;
    expect(afterCommit).toMatchObject({ sold: 1, pendingSold: null });
  });

  it('makes the second writer sleep on the row lock, then hands the lock over at COMMIT', () => {
    const r = play('transaction', racing);
    expect(r.frames[6]?.event).toMatchObject({ blocked: true, label: 'UPDATE blocked' });
    expect(r.frames[6]?.world.actors[1]?.status).toBe('blocked');
    expect(r.frames[6]?.world.store.lock).toEqual({ holder: 0, queue: [1] });
    expect(r.frames[7]?.waiting).toEqual([1]);
    expect(r.frames[7]?.world.store.lock).toEqual({ holder: 1, queue: [] });
    expect(r.frames[7]?.event?.message).toContain('The row lock passes to B');
    expect(r.metrics.waits).toBe(1);
  });

  it('re-reads the row after the wait but does not repeat the check', () => {
    const r = play('transaction', racing);
    expect(r.frames[8]?.event?.label).toBe('UPDATE → 2');
    expect(r.frames[8]?.event?.message).toContain('READ COMMITTED re-reads the row');
    expect(r.frames[8]?.event?.message).toContain('is not repeated');
  });

  it('ends without a write when the check fails', () => {
    const r = play('transaction', [0, 0, 0, 0, 1, 1]);
    expect(outcomes(r)).toEqual(['bought', 'sold-out']);
    expect(r.frames.at(-1)?.world.store.lock).toEqual({ holder: null, queue: [] });
  });
});

describe('3 atomic conditional update', () => {
  it('lets one statement win and reports 0 rows to the other', () => {
    const r = play('atomic-update', [0, 1, 0, 1]);
    expect(labels(r)).toEqual([
      'UPDATE → 1',
      'UPDATE: 0 rows',
      'rows 1: bought',
      'rows 0: sold out',
    ]);
    expect(r.metrics).toMatchObject({ soldFinal: 1, waits: 0, retries: 0, errors: 0 });
    expect(outcomes(r)).toEqual(['bought', 'sold-out']);
  });
});

describe('4 pessimistic lock', () => {
  it('queues the second buyer behind SELECT FOR UPDATE and gives it a fresh read', () => {
    const r = play('pessimistic-lock', [0, 1, 0, 0, 0, 1, 1, 1]);
    expect(labels(r)).toEqual([
      'FOR UPDATE → 0',
      'SELECT FOR UPDATE blocked',
      'check: room',
      'UPDATE → 1',
      'COMMIT',
      'FOR UPDATE → 1',
      'check: sold out',
      'ROLLBACK',
    ]);
    expect(r.frames[6]?.event?.message).toContain('wakes with the row lock');
    expect(r.metrics).toMatchObject({ soldFinal: 1, waits: 3, invariantBrokenAtTick: null });
    expect(r.frames.at(-1)?.stats[1]).toMatchObject({ waits: 3, steps: 4 });
    expect(outcomes(r)).toEqual(['bought', 'sold-out']);
    expect(r.frames.at(-1)?.world.store.lock).toEqual({ holder: null, queue: [] });
  });

  it('serves the queue first in, first out', () => {
    const r = play('pessimistic-lock', [0, 2, 1, 0, 0, 0], { buyers: 3, capacity: 3 });
    expect(r.frames[3]?.world.store.lock).toEqual({ holder: 0, queue: [2, 1] });
    expect(r.frames[6]?.world.store.lock).toEqual({ holder: 2, queue: [1] });
    // C asked for the lock before B, so C is served first and B is still waiting.
    expect(r.frames[6]?.world.actors.map((a) => a.status)).toEqual(['done', 'blocked', 'ready']);
  });

  it('passes the lock on when a sold-out buyer rolls back', () => {
    const r = play('pessimistic-lock', [0, 1, 2, 0, 0, 0, 1, 1, 1, 2, 2, 2], { buyers: 3 });
    expect(r.frames[9]?.event?.message).toContain('The row lock passes to C');
    expect(outcomes(r)).toEqual(['bought', 'sold-out', 'sold-out']);
  });
});

describe('5 optimistic concurrency', () => {
  it('makes the loser retry, and the retry sees the truth', () => {
    const r = play('optimistic', [0, 1, 0, 1, 0, 1, 0, 1, 1, 1]);
    expect(labels(r)).toEqual([
      'SELECT → 0, v1',
      'SELECT → 0, v1',
      'check: room',
      'check: room',
      'UPDATE → 1, v2',
      'UPDATE: 0 rows',
      'rows 1: bought',
      'rows 0: retry',
      'SELECT → 1, v2',
      'check: sold out',
    ]);
    expect(r.metrics).toMatchObject({ soldFinal: 1, retries: 1, wastedSteps: 4, waits: 0 });
    expect(outcomes(r)).toEqual(['bought', 'sold-out']);
  });

  it('lets the retry buy when there is still room', () => {
    const r = play('optimistic', [0, 1, 0, 1, 0, 1, 0, 1, 1, 1, 1, 1], { capacity: 2 });
    expect(r.metrics).toMatchObject({ soldFinal: 2, retries: 1, wastedSteps: 4 });
    expect(outcomes(r)).toEqual(['bought', 'bought']);
    expect(r.frames.at(-1)?.world.store.version).toBe(3);
  });
});

describe('6 CHECK constraint', () => {
  it('rejects the second write with 23514 and leaves the row alone', () => {
    const r = play('constraint', [0, 1, 0, 1, 0, 1]);
    const last = r.frames.at(-1);
    expect(last?.event).toMatchObject({ errored: true, label: 'ERROR 23514', line: 3 });
    expect(last?.event?.message).toContain('violates check constraint "sold_within_capacity"');
    expect(r.metrics).toMatchObject({ soldFinal: 1, errors: 1, invariantBrokenAtTick: null });
    expect(outcomes(r)).toEqual(['bought', 'error']);
  });
});

describe('7 SERIALIZABLE', () => {
  it('aborts the writer that waited, once the first writer commits', () => {
    const r = play('serializable', [0, 1, 0, 1, 0, 1, 0, 1, 1, 1, 1]);
    expect(labels(r)).toEqual([
      'SELECT → 0',
      'SELECT → 0',
      'check: room',
      'check: room',
      'UPDATE → 1',
      'UPDATE blocked',
      'COMMIT',
      'ERROR 40001',
      'catch 40001: retry',
      'SELECT → 1',
      'check: sold out',
    ]);
    expect(r.frames[8]?.event).toMatchObject({ aborted: true, attemptFailed: true });
    expect(r.frames[8]?.event?.message).toContain(
      'could not serialize access due to concurrent update',
    );
    expect(r.frames[8]?.world.store.lock).toEqual({ holder: null, queue: [] });
    expect(r.metrics).toMatchObject({
      soldFinal: 1,
      aborts: 1,
      retries: 1,
      waits: 1,
      wastedSteps: 4,
    });
  });

  it('aborts at once, without waiting, when the row changed after the snapshot', () => {
    const r = play('serializable', [0, 1, 0, 0, 0, 1, 1, 1, 1, 1]);
    expect(r.frames[7]?.event).toMatchObject({ aborted: true, blocked: false });
    expect(r.metrics).toMatchObject({ waits: 0, aborts: 1, soldFinal: 1 });
  });

  it('aborts every queued writer in turn', () => {
    const schedule = [0, 1, 2, 0, 1, 2, 0, 1, 2, 0, 1, 2, 1, 1, 1, 2, 2, 2];
    const r = play('serializable', schedule, { buyers: 3 });
    expect(r.frames[11]?.event?.message).toContain('The row lock passes to C');
    expect(r.frames[11]?.event?.aborted).toBe(true);
    expect(r.frames[12]?.event?.aborted).toBe(true);
    expect(r.metrics).toMatchObject({ aborts: 2, retries: 2, soldFinal: 1 });
  });

  it('lets a transaction that starts after the commit run clean', () => {
    const r = play('serializable', [0, 0, 0, 0, 1, 1, 1, 1], { capacity: 2 });
    expect(r.metrics).toMatchObject({ aborts: 0, soldFinal: 2 });
  });
});

describe('holds with expiry: read, then write', () => {
  const config = { capacity: 400, sold: 399 };

  it('sells the last ticket twice when the sweep races the late payment', () => {
    const r = play('holds-read-then-write', [1, 0, 1, 2, 2, 0, 2, 2, 0], config);
    expect(labels(r)).toEqual([
      "SELECT → A's hold",
      'SELECT → active',
      'expire → held 0',
      'reserve → held 1',
      'SELECT → active',
      'check: active',
      'check: active',
      'confirm → sold 400',
      'confirm → sold 401',
    ]);
    const last = r.frames.at(-1);
    expect(last?.world.store).toMatchObject({ sold: 401, held: -1 });
    expect(last?.event?.message).toContain('The hold was expired');
    expect(last?.event?.message).toContain('sold = 401 is more than capacity 400');
    expect(last?.event?.message).toContain('held = -1: the hold was released twice');
    expect(r.metrics).toMatchObject({ oversoldBy: 1, invariantBrokenAtTick: 9 });
  });

  it('lets a late sweep expire a hold that was already confirmed', () => {
    const r = play('holds-read-then-write', [1, 0, 0, 0, 1, 2, 2, 2, 2], config);
    expect(r.frames[5]?.event?.message).toContain('The hold was confirmed');
    expect(r.frames[5]?.world.store).toMatchObject({ sold: 400, held: -1 });
    expect(r.metrics.soldFinal).toBe(401);
  });

  it('honours the payment when it arrives before the sweep', () => {
    const r = play('holds-read-then-write', [0, 0, 0, 1, 2], config);
    expect(outcomes(r)).toEqual(['bought', 'nothing-to-sweep', 'sold-out']);
    expect(r.frames.at(-1)?.world.store).toMatchObject({ sold: 400, held: 0 });
  });

  it('returns the capacity to the next buyer when the sweep runs first', () => {
    const r = play('holds-read-then-write', [1, 1, 0, 0, 2, 2, 2, 2], config);
    expect(outcomes(r)).toEqual(['refunded', 'swept', 'bought']);
    expect(r.frames.at(-1)?.world.store.holds.map((h) => h.status)).toEqual([
      'expired',
      'confirmed',
    ]);
    expect(r.metrics).toMatchObject({ soldFinal: 400, invariantBrokenAtTick: null });
  });
});

describe('holds with expiry: guarded transitions', () => {
  const config = { capacity: 400, sold: 399 };

  it('lets the payment win and gives the sweep 0 rows', () => {
    const r = play('holds-guarded', [0, 1, 0, 1, 1, 2], config);
    expect(labels(r)).toEqual([
      'UPDATE: 1 row',
      'UPDATE blocked',
      'COMMIT → sold 400',
      'UPDATE: 0 rows',
      'rows 0: nothing to do',
      'reserve: 0 rows',
    ]);
    expect(r.frames[4]?.event?.message).toContain('wakes and the WHERE clause is tested again');
    expect(outcomes(r)).toEqual(['bought', 'nothing-to-sweep', 'sold-out']);
    expect(r.metrics).toMatchObject({ soldFinal: 400, waits: 1 });
  });

  it('lets the sweep win, refunds the late payer and sells the ticket once', () => {
    const r = play('holds-guarded', [1, 0, 1, 2, 2, 2, 0, 0], config);
    expect(r.frames[3]?.event?.message).toContain('The row lock passes to A');
    // B confirms its own hold while A still has the lock on the old one.
    expect(r.frames[5]?.event).toMatchObject({ blocked: false, label: 'UPDATE: 1 row' });
    expect(r.frames[6]?.world.store.lock.holder).toBe(0);
    expect(r.frames[7]?.world.store.lock.holder).toBe(null);
    expect(outcomes(r)).toEqual(['refunded', 'swept', 'bought']);
    expect(r.frames.at(-1)?.world.store).toMatchObject({ sold: 400, held: 0 });
  });

  it('gives 0 rows without a wait when the other side has already committed', () => {
    const r = play('holds-guarded', [1, 1, 0, 0, 2, 2, 2], config);
    expect(r.frames[3]?.event).toMatchObject({ label: 'UPDATE: 0 rows', blocked: false });
    expect(r.frames[3]?.event?.message).toContain('runs its guarded UPDATE');
    expect(r.metrics.waits).toBe(0);
  });
});

describe('advance', () => {
  it('refuses to move an actor that is asleep, finished or unknown', () => {
    const world = initialWorld({
      strategy: 'pessimistic-lock',
      buyers: 2,
      capacity: 1,
      sold: 0,
      qtyEach: 1,
      seed: 1,
    });
    const locked = advance(world, 0).world;
    const blocked = advance(locked, 1).world;
    expect(() => advance(blocked, 1)).toThrow(/cannot move/);
    expect(() => advance(world, 9)).toThrow(/cannot move/);
  });

  it('does not change the world it was given', () => {
    const world = initialWorld({
      strategy: 'check-then-act',
      buyers: 2,
      capacity: 1,
      sold: 0,
      qtyEach: 1,
      seed: 1,
    });
    const copy = structuredClone(world);
    advance(advance(world, 0).world, 0);
    expect(world).toEqual(copy);
  });
});

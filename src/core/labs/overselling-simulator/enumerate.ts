import { enabled, initialWorld, invariantHolds } from './engine';
import { advance } from './programs';
import { isHoldsStrategy } from './strategies';
import type { Actor, RunConfig, Strategy, World } from './types';

export interface OutcomeCount {
  /** Every complete interleaving: every order in which the actors' steps can run. */
  readonly total: bigint;
  /** Those in which `sold` went above `capacity` at some tick. */
  readonly oversold: bigint;
}

/**
 * Every complete schedule, written out. Exponential, so for small casts only: the property
 * tests use it to assert an invariant over all interleavings of two buyers.
 */
export function enumerateSchedules(config: RunConfig, limit = 100_000): number[][] {
  const out: number[][] = [];
  const walk = (world: World, prefix: number[]): void => {
    const can = enabled(world);
    if (can.length === 0) {
      if (out.length >= limit) throw new Error(`More than ${limit} interleavings.`);
      out.push(prefix);
      return;
    }
    for (const id of can) walk(advance(world, id).world, [...prefix, id]);
  };
  walk(initialWorld(config), []);
  return out;
}

function actorKey(actor: Actor, world: World): string {
  if (actor.status === 'done') return 'done';
  const { lock } = world.store;
  const role = lock.holder === actor.id ? 'H' : `Q${lock.queue.indexOf(actor.id)}`;
  return [
    actor.pc,
    actor.status,
    actor.resumed,
    actor.seen,
    actor.seenVersion,
    actor.seenStatus,
    actor.snapshot,
    actor.rows,
    actor.holdId,
    role,
  ].join(',');
}

/**
 * Two worlds with the same key have the same futures. Buyers who run the same program are
 * interchangeable, so their states are sorted: that symmetry is what keeps six buyers
 * countable. The holds cast is not interchangeable and keeps its order.
 */
function worldKey(world: World): string {
  const { store } = world;
  const actors = world.actors.map((a) => actorKey(a, world));
  if (!isHoldsStrategy(world.strategy)) actors.sort();
  return [
    store.sold,
    store.held,
    store.version,
    store.commits,
    store.pendingSold,
    store.holds.map((h) => h.status).join('/'),
    actors.join(';'),
  ].join('|');
}

/**
 * Counts interleavings without listing them: the number of ways to finish from a world is
 * the sum over the actors that can move, and equal worlds are counted once.
 */
export function countOutcomes(
  strategy: Strategy,
  buyers: number,
  options: Partial<Pick<RunConfig, 'capacity' | 'sold' | 'qtyEach'>> = {},
): OutcomeCount {
  const memo = new Map<string, OutcomeCount>();
  const count = (world: World): OutcomeCount => {
    const can = enabled(world);
    if (can.length === 0) return { total: 1n, oversold: 0n };
    const key = worldKey(world);
    const known = memo.get(key);
    if (known) return known;
    let total = 0n;
    let oversold = 0n;
    for (const id of can) {
      const next = advance(world, id).world;
      const rest = count(next);
      total += rest.total;
      // Once broken, every way of finishing is an oversold ordering.
      oversold += invariantHolds(next) ? rest.oversold : rest.total;
    }
    const result = { total, oversold };
    memo.set(key, result);
    return result;
  };
  return count(
    initialWorld({
      strategy,
      buyers,
      capacity: options.capacity ?? 1,
      sold: options.sold ?? 0,
      qtyEach: options.qtyEach ?? 1,
      seed: 0,
    }),
  );
}

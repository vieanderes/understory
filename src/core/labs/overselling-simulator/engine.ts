import { intBelow, mulberry32 } from '@/core/util';
import { advance, entryPc } from './programs';
import { isHoldsStrategy } from './strategies';
import type {
  Actor,
  ActorStats,
  Frame,
  Metrics,
  Program,
  RunConfig,
  RunResult,
  StepEvent,
  World,
} from './types';

export const MIN_BUYERS = 2;
export const MAX_BUYERS = 6;
export const MAX_CAPACITY = 9999;
export const MAX_QTY = 4;

const NAMES = ['A', 'B', 'C', 'D', 'E', 'F'] as const;

function clampInt(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, Math.trunc(value)));
}

/** Brings any input into the range the lab can show. The engine never trusts its caller. */
export function normalise(config: RunConfig): Required<RunConfig> {
  const holds = isHoldsStrategy(config.strategy);
  const qtyEach = clampInt(config.qtyEach, 1, MAX_QTY);
  const capacity = clampInt(config.capacity, qtyEach, MAX_CAPACITY);
  return {
    strategy: config.strategy,
    // The holds variant has a fixed cast: A's late payment, the sweep and buyer B.
    buyers: holds ? 3 : clampInt(config.buyers, MIN_BUYERS, MAX_BUYERS),
    capacity,
    // In the holds variant A's hold covers the last tickets, so capacity can only come
    // back through the sweep.
    sold: holds ? capacity - qtyEach : clampInt(config.sold, 0, capacity),
    qtyEach,
    seed: clampInt(config.seed, 0, 0xffffffff),
    schedule: config.schedule ?? [],
  };
}

function actor(
  strategy: World['strategy'],
  id: number,
  name: string,
  program: Program,
  holdId: number | null,
): Actor {
  return {
    id,
    name,
    program,
    pc: entryPc({ strategy }, program),
    status: 'ready',
    resumed: false,
    seen: null,
    seenVersion: null,
    seenStatus: null,
    snapshot: null,
    rows: null,
    holdId,
    outcome: null,
  };
}

export function initialWorld(input: RunConfig): World {
  const config = normalise(input);
  const { strategy, capacity, sold, qtyEach } = config;
  const holds = isHoldsStrategy(strategy);
  return {
    strategy,
    qtyEach,
    store: {
      capacity,
      sold,
      held: holds ? qtyEach : 0,
      version: 1,
      commits: 0,
      pendingSold: null,
      lock: { holder: null, queue: [] },
      holds: holds ? [{ id: 0, owner: 'A', qty: qtyEach, status: 'active', overdue: true }] : [],
    },
    actors: holds
      ? [
          actor(strategy, 0, 'A', 'confirm', 0),
          actor(strategy, 1, 'Sweep', 'sweep', null),
          actor(strategy, 2, 'B', 'reserve-then-confirm', null),
        ]
      : Array.from({ length: config.buyers }, (_, id) =>
          actor(strategy, id, NAMES[id] as string, 'reserve', null),
        ),
  };
}

/** Actors that can take a step now: not finished, and not asleep on the lock. */
export function enabled(world: World): number[] {
  return world.actors.filter((a) => a.status === 'ready').map((a) => a.id);
}

/** The invariant of the whole lab. Only committed state counts. */
export function invariantHolds(world: World): boolean {
  return world.store.sold <= world.store.capacity;
}

const ZERO_STATS: ActorStats = { steps: 0, waits: 0, startedAtTick: null, finishedAtTick: null };

function zeroMetrics(world: World): Metrics {
  return {
    soldFinal: world.store.sold,
    oversoldBy: 0,
    invariantBrokenAtTick: null,
    waits: 0,
    retries: 0,
    aborts: 0,
    errors: 0,
    wastedSteps: 0,
    latency: 0,
    ticks: 0,
  };
}

interface Tally {
  readonly stats: readonly ActorStats[];
  /** Steps each actor has taken in its current attempt. Thrown away when it fails. */
  readonly attempt: readonly number[];
  readonly metrics: Metrics;
}

function tally(
  before: Tally,
  tick: number,
  world: World,
  event: StepEvent,
  waiting: readonly number[],
): Tally {
  const attemptSteps = (before.attempt[event.actor] as number) + 1;
  const finished = (world.actors[event.actor] as Actor).status === 'done';
  const stats = before.stats.map((s, id) => {
    if (id === event.actor) {
      return {
        ...s,
        steps: s.steps + 1,
        startedAtTick: s.startedAtTick ?? tick,
        finishedAtTick: finished ? tick : null,
      };
    }
    return waiting.includes(id) ? { ...s, waits: s.waits + 1 } : s;
  });
  const mine = stats[event.actor] as ActorStats;
  const m = before.metrics;
  const broken = !invariantHolds(world);
  return {
    stats,
    attempt: before.attempt.map((n, id) =>
      id === event.actor ? (event.attemptFailed ? 0 : attemptSteps) : n,
    ),
    metrics: {
      soldFinal: world.store.sold,
      oversoldBy: Math.max(0, world.store.sold - world.store.capacity),
      invariantBrokenAtTick: m.invariantBrokenAtTick ?? (broken ? tick : null),
      waits: m.waits + waiting.length,
      retries: m.retries + (event.retried ? 1 : 0),
      aborts: m.aborts + (event.aborted ? 1 : 0),
      errors: m.errors + (event.errored ? 1 : 0),
      wastedSteps: m.wastedSteps + (event.attemptFailed ? attemptSteps : 0),
      latency: m.latency + (finished ? tick - (mine.startedAtTick as number) + 1 : 0),
      ticks: tick,
    },
  };
}

/**
 * Runs the scenario to the end and returns every frame. One actor moves per tick. The
 * schedule is followed while it names actors that can move. From the first entry that does
 * not, the seeded scheduler picks uniformly among the actors that can.
 */
export function run(input: RunConfig): RunResult {
  const config = normalise(input);
  const rng = mulberry32(config.seed);
  let world = initialWorld(config);
  let state: Tally = {
    stats: world.actors.map(() => ZERO_STATS),
    attempt: world.actors.map(() => 0),
    metrics: zeroMetrics(world),
  };
  const frames: Frame[] = [
    { tick: 0, world, event: null, waiting: [], stats: state.stats, metrics: state.metrics },
  ];
  const schedule: number[] = [];
  let scripted = true;

  for (let can = enabled(world); can.length > 0; can = enabled(world)) {
    const tick = frames.length;
    const wanted: number | undefined = scripted ? config.schedule[tick - 1] : undefined;
    scripted = wanted !== undefined && can.includes(wanted);
    const pick = scripted ? (wanted as number) : (can[intBelow(rng, can.length)] as number);
    const waiting = world.actors.filter((a) => a.status === 'blocked').map((a) => a.id);
    const step = advance(world, pick);
    world = step.world;
    state = tally(state, tick, world, step.event, waiting);
    schedule.push(pick);
    frames.push({
      tick,
      world,
      event: step.event,
      waiting,
      stats: state.stats,
      metrics: state.metrics,
    });
  }

  return { config, frames, schedule, metrics: state.metrics };
}

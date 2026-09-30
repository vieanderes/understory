import {
  advance,
  enabled,
  initialWorld,
  isHoldsStrategy,
  type RunConfig,
  type StepEvent,
  type World,
} from '@/core/labs/overselling-simulator';

/**
 * One tick, as the view needs it. `run` computes these for a whole scheduled run; by hand
 * the view records its own, so that stepping back stays free in both modes.
 */
export interface ShownFrame {
  readonly tick: number;
  readonly world: World;
  /** Null in frame 0, before anything has run. */
  readonly event: StepEvent | null;
  readonly waiting: readonly number[];
}

export function freshHand(config: RunConfig): ShownFrame[] {
  return [{ tick: 0, world: initialWorld(config), event: null, waiting: [] }];
}

/**
 * Records one hand-picked step. Frames after `index` are dropped: stepping back and then
 * giving the turn to someone else is a different run, not a branch of the old one.
 */
export function stepHand(
  frames: readonly ShownFrame[],
  index: number,
  actorId: number,
): ShownFrame[] {
  const kept = frames.slice(0, index + 1);
  const current = kept[index] as ShownFrame;
  // Counted the way the engine counts: who was asleep when the tick began.
  const waiting = current.world.actors.filter((a) => a.status === 'blocked').map((a) => a.id);
  const { world, event } = advance(current.world, actorId);
  return [...kept, { tick: index + 1, world, event, waiting }];
}

export function movable(frame: ShownFrame): number[] {
  return enabled(frame.world);
}

/** The tick at which `sold` first went above capacity, or null while the invariant holds. */
export function brokenAtTick(frames: readonly ShownFrame[], index: number): number | null {
  const broken = frames
    .slice(0, index + 1)
    .find((frame) => frame.world.store.sold > frame.world.store.capacity);
  return broken ? broken.tick : null;
}

/**
 * The subtle outcome of the guarded holds variant: the sweep won the race, the late
 * payment was refunded, the waiting buyer had already been told the event was sold out,
 * and the ticket went back into stock with nobody left to buy it. Nothing was oversold and
 * the shop still lost the sale.
 */
export function lostTheSale(world: World): boolean {
  if (!isHoldsStrategy(world.strategy)) return false;
  if (!world.actors.every((actor) => actor.status === 'done')) return false;
  const outcomes = world.actors.map((actor) => actor.outcome);
  return (
    !outcomes.includes('bought') &&
    outcomes.includes('refunded') &&
    outcomes.includes('sold-out') &&
    world.store.held === 0
  );
}

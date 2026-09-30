import { allFinished, canRun, initialState, step } from './engine';
import type { EngineState, Level, Scenario, TxId } from './types';

/** What this model leaves out, on purpose. The view lists these under "What this leaves out". */
export const LEFT_OUT: readonly string[] = [
  'More than two transactions, and with them read-only anomalies and longer cycles.',
  'Deadlock timing. PostgreSQL waits deadlock_timeout, then picks a victim. Here the transaction that closes the cycle fails at once.',
  'SIREAD locks on pages and whole tables. Real SERIALIZABLE can fail a transaction that did nothing dangerous, and this model never does.',
  'Savepoints, FOR SHARE and the weaker row locks, and advisory locks.',
  'Unique constraints, and the waits they cause on INSERT.',
  'NULLs, joins, and one session running two statements at once.',
  'Other databases. MySQL, for one, means something else by REPEATABLE READ.',
];

export interface Run {
  /** `frames[0]` is the initial state; `frames[i]` is the state after `schedule[i - 1]`. */
  readonly frames: readonly EngineState[];
  /** The interleaving that was actually run: one entry per statement. */
  readonly schedule: readonly TxId[];
}

/**
 * Runs a whole interleaving up front, so the view is a function of `frames[index]`.
 *
 * The wanted schedule is a wish: a transaction that waits for a row lock cannot take its
 * turn, so the next entry of a transaction that can run goes first, and whatever the
 * wish leaves unfinished is completed (T1 before T2). The result always has exactly one
 * entry per statement, at every isolation level.
 */
export function run(scenario: Scenario, level: Level, wanted: readonly TxId[]): Run {
  let state = initialState(scenario, level);
  const frames: EngineState[] = [state];
  const schedule: TxId[] = [];
  const queue = [...wanted];
  while (!allFinished(state)) {
    const current = state;
    const at = queue.findIndex((tx) => canRun(current, tx));
    // Both cannot wait at once: the engine breaks a deadlock when it forms.
    const tx = at >= 0 ? (queue.splice(at, 1)[0] as TxId) : canRun(current, 1) ? 1 : 2;
    state = step(scenario, state, tx);
    frames.push(state);
    schedule.push(tx);
  }
  return { frames, schedule };
}

/**
 * The schedule after the learner runs `tx` at position `index`: what has happened stays,
 * `tx` goes next, and the rest of the plan keeps its order.
 */
export function runNext(schedule: readonly TxId[], index: number, tx: TxId): TxId[] {
  const rest = schedule.slice(index);
  const at = rest.indexOf(tx);
  if (at >= 0) rest.splice(at, 1);
  return [...schedule.slice(0, index), tx, ...rest];
}

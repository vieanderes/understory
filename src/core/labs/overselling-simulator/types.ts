/*
 * Overselling simulator: the vocabulary.
 *
 * The lab models one `events` row (`sold`, `capacity`, optionally `version`) and a small
 * `holds` table, and several actors that each run a short program of atomic steps against
 * them. One actor advances per tick, so an interleaving is a list of actor ids.
 */

/** The seven ways to write `reserve(qty)` that the lab compares. */
export type ReserveStrategy =
  | 'check-then-act'
  | 'transaction'
  | 'atomic-update'
  | 'pessimistic-lock'
  | 'optimistic'
  | 'constraint'
  | 'serializable';

/** The two ways to write the hold transitions (expire, confirm) in the holds variant. */
export type HoldsStrategy = 'holds-read-then-write' | 'holds-guarded';

export type Strategy = ReserveStrategy | HoldsStrategy;

export type HoldStatus = 'active' | 'expired' | 'confirmed';

export interface Hold {
  readonly id: number;
  /** Name of the buyer who owns the hold. */
  readonly owner: string;
  readonly qty: number;
  readonly status: HoldStatus;
  /** True once `expires_at <= now()`. The lab has no clock, so lateness is a given fact. */
  readonly overdue: boolean;
}

/** One row lock with a first-in, first-out queue of waiters. */
export interface RowLock {
  readonly holder: number | null;
  readonly queue: readonly number[];
}

export interface Store {
  readonly capacity: number;
  /** Committed value of `events.sold`. Plain reads see only this. */
  readonly sold: number;
  /** Committed value of `events.held`: tickets inside active holds. */
  readonly held: number;
  readonly version: number;
  /** How many commits have changed the row. A snapshot remembers this number. */
  readonly commits: number;
  /** A value written inside an open transaction. Invisible to others until COMMIT. */
  readonly pendingSold: number | null;
  readonly lock: RowLock;
  readonly holds: readonly Hold[];
}

export type Program = 'reserve' | 'confirm' | 'sweep' | 'reserve-then-confirm';

export type Outcome = 'bought' | 'sold-out' | 'error' | 'refunded' | 'swept' | 'nothing-to-sweep';

export type ActorStatus = 'ready' | 'blocked' | 'done';

export interface Actor {
  readonly id: number;
  readonly name: string;
  readonly program: Program;
  /** Program counter: the step this actor runs next. */
  readonly pc: string;
  readonly status: ActorStatus;
  /** True between being granted a lock it waited for and running the statement again. */
  readonly resumed: boolean;
  /** What the actor read, and may now be acting on although it is stale. */
  readonly seen: number | null;
  readonly seenVersion: number | null;
  readonly seenStatus: HoldStatus | null;
  /** `Store.commits` when the transaction took its snapshot. */
  readonly snapshot: number | null;
  /** Row count of the last guarded statement. */
  readonly rows: number | null;
  readonly holdId: number | null;
  readonly outcome: Outcome | null;
}

export interface World {
  readonly strategy: Strategy;
  readonly qtyEach: number;
  readonly store: Store;
  readonly actors: readonly Actor[];
}

/** What one tick did. `message` says it in words for the status line. */
export interface StepEvent {
  readonly actor: number;
  readonly pc: string;
  /** `db` touches the shared store. `app` is application code working on local values. */
  readonly kind: 'db' | 'app';
  /** Index of the line in the strategy's sketch that this step runs. */
  readonly line: number;
  /** Short text for a timeline cell. */
  readonly label: string;
  readonly message: string;
  /** The statement could not get the row lock. The actor sleeps until it is granted. */
  readonly blocked: boolean;
  /** The database raised an error the application did not plan for (23514). */
  readonly errored: boolean;
  /** A transaction was aborted with a serialisation failure (40001). */
  readonly aborted: boolean;
  /** The application started its attempt again. */
  readonly retried: boolean;
  /** The steps of this attempt bought nothing and are counted as wasted work. */
  readonly attemptFailed: boolean;
}

export interface Metrics {
  readonly soldFinal: number;
  readonly oversoldBy: number;
  readonly invariantBrokenAtTick: number | null;
  /** Ticks that some actor spent asleep on a row lock. */
  readonly waits: number;
  readonly retries: number;
  readonly aborts: number;
  readonly errors: number;
  /** Steps taken inside attempts that were thrown away. */
  readonly wastedSteps: number;
  /** Sum over finished actors of the ticks from their first step to their last. */
  readonly latency: number;
  readonly ticks: number;
}

export interface ActorStats {
  readonly steps: number;
  readonly waits: number;
  readonly startedAtTick: number | null;
  readonly finishedAtTick: number | null;
}

export interface Frame {
  readonly tick: number;
  readonly world: World;
  /** Null only in frame 0, before anything has run. */
  readonly event: StepEvent | null;
  /** Actors that spent this tick asleep on the lock. */
  readonly waiting: readonly number[];
  readonly stats: readonly ActorStats[];
  /** Running totals up to and including this tick. */
  readonly metrics: Metrics;
}

export interface RunConfig {
  readonly strategy: Strategy;
  /** 2 to 6. The holds variant always has three actors: A's late payment, the sweep, B. */
  readonly buyers: number;
  readonly capacity: number;
  readonly sold: number;
  readonly qtyEach: number;
  readonly seed: number;
  /**
   * Actor ids to advance, tick by tick. Followed for as long as each entry names an actor
   * that can move. After that the seeded scheduler picks.
   */
  readonly schedule?: readonly number[];
}

export interface RunResult {
  readonly config: Required<RunConfig>;
  readonly frames: readonly Frame[];
  /** The interleaving that actually ran. Feeding it back as `schedule` reproduces the run. */
  readonly schedule: readonly number[];
  readonly metrics: Metrics;
}

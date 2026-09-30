import type { Actor, Hold, Outcome, StepEvent, Store, World } from './types';

/*
 * The programs. Each actor runs a short list of atomic steps. `advance` runs exactly one
 * step of one actor and returns the next world. Nothing here chooses who moves: that is the
 * scheduler's job (engine.ts), and the learner's.
 *
 * What is modelled, and where it comes from (PostgreSQL 17 documentation):
 *
 *  - A plain SELECT takes no row lock and sees only committed data (13.2.1 Read Committed).
 *  - UPDATE and SELECT ... FOR UPDATE take the row lock and keep it until the transaction
 *    ends. A second writer sleeps until then (13.3.2 Row-Level Locks).
 *  - At READ COMMITTED a writer that slept re-reads the row as it is after the first
 *    commit, and applies its own change to that newer version (13.2.1). Nothing re-runs
 *    the application's earlier check.
 *  - At REPEATABLE READ and SERIALIZABLE a writer that finds the row changed by a
 *    transaction that committed after its snapshot fails with SQLSTATE 40001, "could not
 *    serialize access due to concurrent update" (13.2.2, 13.2.3).
 *  - A CHECK constraint is tested against every new row version. A violation raises
 *    SQLSTATE 23514 and the statement changes nothing (5.5.1 Check Constraints).
 *
 * Simplifications, also listed in the view: one statement is one tick, a statement outside
 * BEGIN and COMMIT is its own transaction, the lock queue is strictly first-in first-out,
 * and SERIALIZABLE is modelled through the concurrent-update rule only. Every transaction
 * here writes the same row, so that rule decides every conflict. Predicate locks, which
 * Postgres needs for the `SELECT count(*)` then `INSERT` form of this bug, are left out.
 */

type Mutable<T> = { -readonly [K in keyof T]: T[K] };

interface Draft {
  store: Mutable<Store>;
  actors: Mutable<Actor>[];
  qty: number;
}

export interface StepResult {
  readonly world: World;
  readonly event: StepEvent;
}

const FLAGS = {
  blocked: false,
  errored: false,
  aborted: false,
  retried: false,
  attemptFailed: false,
} as const;

/** The first step of each program, per strategy family. */
export function entryPc(world: Pick<World, 'strategy'>, program: Actor['program']): string {
  const guarded = world.strategy === 'holds-guarded';
  if (program === 'confirm') return guarded ? 'claim' : 'c-select';
  if (program === 'sweep') return guarded ? 's-claim' : 's-select';
  if (program === 'reserve-then-confirm') return 'reserve';
  if (world.strategy === 'atomic-update') return 'update';
  if (world.strategy === 'pessimistic-lock') return 'lock';
  return 'select';
}

function finish(me: Mutable<Actor>, outcome: Outcome): void {
  me.status = 'done';
  me.pc = 'done';
  me.outcome = outcome;
}

/** True when `me` now holds the row lock. Otherwise `me` joins the queue and sleeps. */
function acquire(draft: Draft, me: Mutable<Actor>): boolean {
  const { lock } = draft.store;
  if (lock.holder === null || lock.holder === me.id) {
    draft.store.lock = { holder: me.id, queue: lock.queue };
    me.resumed = false;
    return true;
  }
  draft.store.lock = { holder: lock.holder, queue: [...lock.queue, me.id] };
  me.status = 'blocked';
  return false;
}

/** Ends the holder's claim. The head of the queue is granted the lock and wakes. */
function release(draft: Draft): void {
  const [next, ...rest] = draft.store.lock.queue;
  draft.store.lock = { holder: next ?? null, queue: rest };
  if (next === undefined) return;
  const woken = draft.actors[next] as Mutable<Actor>;
  woken.status = 'ready';
  woken.resumed = true;
}

function releaseIfHeld(draft: Draft, me: Mutable<Actor>): void {
  if (draft.store.lock.holder === me.id) {
    me.resumed = false;
    release(draft);
  }
}

function holderName(draft: Draft): string {
  return (draft.actors[draft.store.lock.holder as number] as Actor).name;
}

function wakeNote(draft: Draft): string {
  const next = draft.store.lock.holder;
  return next === null ? '' : ` The row lock passes to ${(draft.actors[next] as Actor).name}.`;
}

type Emit = Pick<StepEvent, 'kind' | 'line' | 'label' | 'message'> &
  // FLAGS supplies the defaults, all false; an emit may raise any of them.
  Partial<Record<keyof typeof FLAGS, boolean>>;

/** Runs one step of one actor. The actor must be ready: a sleeping actor cannot move. */
export function advance(world: World, actorId: number): StepResult {
  const draft: Draft = {
    store: { ...world.store },
    actors: world.actors.map((actor) => ({ ...actor })),
    qty: world.qtyEach,
  };
  const me = draft.actors[actorId];
  if (!me || me.status !== 'ready') {
    throw new Error(`Actor ${actorId} cannot move: it is asleep, finished or unknown.`);
  }
  const pc = me.pc;
  const emit = runStep(world.strategy, draft, me);
  return {
    world: { ...world, store: draft.store, actors: draft.actors },
    event: { actor: actorId, pc, ...FLAGS, ...emit },
  };
}

function runStep(strategy: World['strategy'], draft: Draft, me: Mutable<Actor>): Emit {
  switch (strategy) {
    case 'check-then-act':
      return checkThenAct(draft, me, 0, false);
    case 'constraint':
      return checkThenAct(draft, me, 1, true);
    case 'transaction':
      return transaction(draft, me);
    case 'atomic-update':
      return atomicUpdate(draft, me);
    case 'pessimistic-lock':
      return pessimistic(draft, me);
    case 'optimistic':
      return optimistic(draft, me);
    case 'serializable':
      return serializable(draft, me);
    case 'holds-read-then-write':
      return holdsReadThenWrite(draft, me);
    case 'holds-guarded':
      return holdsGuarded(draft, me);
  }
}

/* ---------------------------------------------------------------- shared reserve steps */

function plainSelect(draft: Draft, me: Mutable<Actor>, line: number, opens: string): Emit {
  me.seen = draft.store.sold;
  me.pc = 'check';
  return {
    kind: 'db',
    line,
    label: `SELECT → ${me.seen}`,
    message: `${opens}${me.name} reads sold = ${me.seen}. A plain SELECT takes no lock and sees only committed rows, so any other buyer can read the same value.`,
  };
}

function check(
  draft: Draft,
  me: Mutable<Actor>,
  line: number,
  onFail: 'finish' | 'rollback',
): Emit {
  const seen = me.seen as number;
  const { capacity } = draft.store;
  const sum = `${seen} + ${draft.qty} ≤ ${capacity}`;
  if (seen + draft.qty <= capacity) {
    me.pc = 'update';
    return {
      kind: 'app',
      line,
      label: 'check: room',
      message: `${me.name} checks ${sum} in application code. True, so it goes on. The check used the value ${me.name} read, which may be stale by now.`,
    };
  }
  if (onFail === 'rollback') {
    me.pc = 'rollback';
    return {
      kind: 'app',
      line,
      label: 'check: sold out',
      message: `${me.name} checks ${sum}. False. It still holds the row lock and must roll back to let the queue move.`,
    };
  }
  finish(me, 'sold-out');
  return {
    kind: 'app',
    line,
    label: 'check: sold out',
    message: `${me.name} checks ${sum}. False: ${me.name} is told the event is sold out and stops.`,
  };
}

function commit(draft: Draft, me: Mutable<Actor>, line: number): Emit {
  const value = draft.store.pendingSold as number;
  draft.store.sold = value;
  draft.store.pendingSold = null;
  draft.store.commits += 1;
  release(draft);
  finish(me, 'bought');
  const verdict =
    value > draft.store.capacity
      ? ` That is ${value - draft.store.capacity} more than capacity.`
      : '';
  return {
    kind: 'db',
    line,
    label: 'COMMIT',
    message: `${me.name} commits. sold = ${value} is now visible to everyone.${verdict}${wakeNote(draft)}`,
  };
}

function blockedOn(draft: Draft, me: Actor, line: number, statement: string): Emit {
  return {
    kind: 'db',
    line,
    label: `${statement} blocked`,
    message: `${me.name} runs ${statement}, but ${holderName(draft)} holds the row lock. ${me.name} sleeps until that transaction ends.`,
    blocked: true,
  };
}

/* ------------------------------------------------ 1 check-then-act, 6 CHECK constraint */

function checkThenAct(
  draft: Draft,
  me: Mutable<Actor>,
  offset: number,
  constrained: boolean,
): Emit {
  if (me.pc === 'select') return plainSelect(draft, me, offset, '');
  if (me.pc === 'check') return check(draft, me, offset + 1, 'finish');
  const before = draft.store.sold;
  const after = before + draft.qty;
  if (constrained && after > draft.store.capacity) {
    finish(me, 'error');
    return {
      kind: 'db',
      line: offset + 2,
      label: 'ERROR 23514',
      message: `${me.name} runs UPDATE. The new row would have sold = ${after}, so the CHECK constraint rejects it: ERROR 23514, new row for relation "events" violates check constraint "sold_within_capacity". sold stays ${before}. The application must catch this and tell ${me.name} the event is sold out.`,
      errored: true,
    };
  }
  draft.store.sold = after;
  draft.store.commits += 1;
  finish(me, 'bought');
  const verdict =
    after > draft.store.capacity
      ? ` ${me.name} decided on sold = ${me.seen}, and nothing checked again. The event is oversold.`
      : '';
  return {
    kind: 'db',
    line: offset + 2,
    label: `UPDATE → ${after}`,
    message: `${me.name} runs UPDATE: sold goes from ${before} to ${after}.${verdict}`,
  };
}

/* ------------------------------------------------------ 2 transaction, READ COMMITTED */

function transaction(draft: Draft, me: Mutable<Actor>): Emit {
  if (me.pc === 'select') return plainSelect(draft, me, 1, `${me.name} begins a transaction. `);
  if (me.pc === 'check') return check(draft, me, 2, 'finish');
  if (me.pc === 'commit') return commit(draft, me, 4);
  const resumed = me.resumed;
  if (!acquire(draft, me)) return blockedOn(draft, me, 3, 'UPDATE');
  const base = draft.store.sold;
  draft.store.pendingSold = base + draft.qty;
  me.pc = 'commit';
  return {
    kind: 'db',
    line: 3,
    label: `UPDATE → ${base + draft.qty}`,
    message: resumed
      ? `${me.name} wakes with the row lock. READ COMMITTED re-reads the row: sold is now ${base}, so the UPDATE writes ${base + draft.qty}. ${me.name}'s check ran before the wait, on sold = ${me.seen}, and is not repeated.`
      : `${me.name} runs UPDATE and takes the row lock: sold = ${base + draft.qty}, not yet committed. Others still read ${base}.`,
  };
}

/* ------------------------------------------------------ 3 atomic conditional update */

function atomicUpdate(draft: Draft, me: Mutable<Actor>): Emit {
  if (me.pc === 'rows') {
    const won = me.rows === 1;
    finish(me, won ? 'bought' : 'sold-out');
    return {
      kind: 'app',
      line: 2,
      label: won ? 'rows 1: bought' : 'rows 0: sold out',
      message: won
        ? `${me.name} reads the row count: 1. The tickets are ${me.name}'s.`
        : `${me.name} reads the row count: 0. No error was raised, so this check is the only way ${me.name} learns it is sold out.`,
    };
  }
  const before = draft.store.sold;
  const fits = before + draft.qty <= draft.store.capacity;
  if (fits) {
    draft.store.sold = before + draft.qty;
    draft.store.commits += 1;
  }
  me.rows = fits ? 1 : 0;
  me.pc = 'rows';
  return {
    kind: 'db',
    line: 0,
    label: fits ? `UPDATE → ${before + draft.qty}` : 'UPDATE: 0 rows',
    message: fits
      ? `${me.name} runs the guarded UPDATE. The database tests ${before} + ${draft.qty} ≤ ${draft.store.capacity} and writes ${before + draft.qty} under one row lock, in one step. 1 row changed.`
      : `${me.name} runs the guarded UPDATE. ${before} + ${draft.qty} ≤ ${draft.store.capacity} is false for the current row, so the WHERE clause matches nothing. 0 rows changed.`,
  };
}

/* ------------------------------------------------------ 4 pessimistic lock */

function pessimistic(draft: Draft, me: Mutable<Actor>): Emit {
  if (me.pc === 'check') return check(draft, me, 2, 'rollback');
  if (me.pc === 'commit') return commit(draft, me, 4);
  if (me.pc === 'rollback') {
    release(draft);
    finish(me, 'sold-out');
    return {
      kind: 'db',
      line: 2,
      label: 'ROLLBACK',
      message: `${me.name} rolls back and is told the event is sold out.${wakeNote(draft)}`,
    };
  }
  if (me.pc === 'update') {
    const value = (me.seen as number) + draft.qty;
    draft.store.pendingSold = value;
    me.pc = 'commit';
    return {
      kind: 'db',
      line: 3,
      label: `UPDATE → ${value}`,
      message: `${me.name} runs UPDATE: sold = ${value}, not yet committed. Nobody else could have changed the row since ${me.name} read it.`,
    };
  }
  const resumed = me.resumed;
  if (!acquire(draft, me)) return blockedOn(draft, me, 1, 'SELECT FOR UPDATE');
  me.seen = draft.store.sold;
  me.pc = 'check';
  return {
    kind: 'db',
    line: 1,
    label: `FOR UPDATE → ${me.seen}`,
    message: resumed
      ? `${me.name} wakes with the row lock and reads the row as it is now: sold = ${me.seen}. The wait is the price of a fresh value.`
      : `${me.name} begins a transaction and runs SELECT FOR UPDATE: it takes the row lock and reads sold = ${me.seen}. Until ${me.name} commits, no other writer or locking reader can enter this row.`,
  };
}

/* ------------------------------------------------------ 5 optimistic concurrency */

function optimistic(draft: Draft, me: Mutable<Actor>): Emit {
  if (me.pc === 'select') {
    me.seen = draft.store.sold;
    me.seenVersion = draft.store.version;
    me.pc = 'check';
    return {
      kind: 'db',
      line: 0,
      label: `SELECT → ${me.seen}, v${me.seenVersion}`,
      message: `${me.name} reads sold = ${me.seen} and version = ${me.seenVersion}. No lock is taken.`,
    };
  }
  if (me.pc === 'check') return check(draft, me, 1, 'finish');
  if (me.pc === 'rows') {
    if (me.rows === 1) {
      finish(me, 'bought');
      return {
        kind: 'app',
        line: 4,
        label: 'rows 1: bought',
        message: `${me.name} reads the row count: 1. The tickets are ${me.name}'s.`,
      };
    }
    me.pc = 'select';
    me.rows = null;
    return {
      kind: 'app',
      line: 4,
      label: 'rows 0: retry',
      message: `${me.name} reads the row count: 0. Someone else wrote first. ${me.name} throws its work away and starts again from the SELECT.`,
      retried: true,
      attemptFailed: true,
    };
  }
  const current = draft.store.version;
  const matches = current === me.seenVersion;
  const value = (me.seen as number) + draft.qty;
  if (matches) {
    draft.store.sold = value;
    draft.store.version = current + 1;
    draft.store.commits += 1;
  }
  me.rows = matches ? 1 : 0;
  me.pc = 'rows';
  return {
    kind: 'db',
    line: 2,
    label: matches ? `UPDATE → ${value}, v${current + 1}` : 'UPDATE: 0 rows',
    message: matches
      ? `${me.name} runs UPDATE WHERE version = ${me.seenVersion}. The version still matches, so the value ${me.name} read is still true: sold = ${value}, version = ${current + 1}.`
      : `${me.name} runs UPDATE WHERE version = ${me.seenVersion}, but the row is at version ${current}. 0 rows changed, and sold stays ${draft.store.sold}.`,
  };
}

/* ------------------------------------------------------ 7 SERIALIZABLE */

function serializable(draft: Draft, me: Mutable<Actor>): Emit {
  if (me.pc === 'select') {
    me.snapshot = draft.store.commits;
    return plainSelect(
      draft,
      me,
      1,
      `${me.name} begins a SERIALIZABLE transaction. Its snapshot is taken now. `,
    );
  }
  if (me.pc === 'check') return check(draft, me, 2, 'finish');
  if (me.pc === 'commit') return commit(draft, me, 4);
  if (me.pc === 'retry') {
    me.pc = 'select';
    me.seen = null;
    me.snapshot = null;
    return {
      kind: 'app',
      line: 5,
      label: 'catch 40001: retry',
      message: `${me.name} catches 40001 and runs the whole transaction again. A fresh snapshot will see what the winner committed.`,
      retried: true,
    };
  }
  if (draft.store.commits !== me.snapshot) {
    // First updater wins: the row changed after this snapshot, so the write cannot stand.
    releaseIfHeld(draft, me);
    me.pc = 'retry';
    return {
      kind: 'db',
      line: 3,
      label: 'ERROR 40001',
      message: `${me.name} runs UPDATE, but a transaction that committed after ${me.name}'s snapshot has changed the row. ERROR 40001: could not serialize access due to concurrent update. The transaction is aborted and nothing is written.${wakeNote(draft)}`,
      aborted: true,
      attemptFailed: true,
    };
  }
  if (!acquire(draft, me)) return blockedOn(draft, me, 3, 'UPDATE');
  const value = (me.seen as number) + draft.qty;
  draft.store.pendingSold = value;
  me.pc = 'commit';
  return {
    kind: 'db',
    line: 3,
    label: `UPDATE → ${value}`,
    message: `${me.name} runs UPDATE and takes the row lock: sold = ${value}, not yet committed. Nobody has committed a change since ${me.name}'s snapshot.`,
  };
}

/* ------------------------------------------------------ holds with expiry */

/** Only A's overdue hold can be reached by two actors at once, so only it needs the lock. */
const CONTENDED_HOLD = 0;

function setHold(draft: Draft, id: number, status: Hold['status']): Hold {
  const hold = draft.store.holds[id] as Hold;
  draft.store.holds = draft.store.holds.map((h) => (h.id === id ? { ...h, status } : h));
  return hold;
}

function reserveHold(draft: Draft, me: Mutable<Actor>, line: number, next: string): Emit {
  const { sold, held, capacity } = draft.store;
  const sum = `${sold} + ${held} + ${draft.qty} ≤ ${capacity}`;
  if (sold + held + draft.qty > capacity) {
    finish(me, 'sold-out');
    return {
      kind: 'db',
      line,
      label: 'reserve: 0 rows',
      message: `${me.name} tries to reserve. ${sum} is false: the ticket is still held or sold, so 0 rows change and ${me.name} is told it is sold out.`,
    };
  }
  const id = draft.store.holds.length;
  draft.store.held = held + draft.qty;
  draft.store.holds = [
    ...draft.store.holds,
    { id, owner: me.name, qty: draft.qty, status: 'active', overdue: false },
  ];
  me.holdId = id;
  me.pc = next;
  return {
    kind: 'db',
    line,
    label: `reserve → held ${held + draft.qty}`,
    message: `${me.name} reserves with a guarded UPDATE. ${sum} is true, so held = ${held + draft.qty} and ${me.name} gets a hold. Capacity came back because the old hold was released.`,
  };
}

function corruptNote(draft: Draft): string {
  const { sold, held, capacity } = draft.store;
  const notes: string[] = [];
  if (sold > capacity) notes.push(` sold = ${sold} is more than capacity ${capacity}.`);
  if (held < 0) notes.push(` held = ${held}: the hold was released twice.`);
  return notes.join('');
}

function holdsReadThenWrite(draft: Draft, me: Mutable<Actor>): Emit {
  if (me.pc === 'reserve') return reserveHold(draft, me, 5, 'c-select');
  if (me.pc === 'c-select') {
    const hold = draft.store.holds[me.holdId as number] as Hold;
    me.seenStatus = hold.status;
    me.pc = 'c-check';
    return {
      kind: 'db',
      line: 0,
      label: `SELECT → ${hold.status}`,
      message: `${me.name}'s payment arrives. The webhook reads the hold: status = ${hold.status}.`,
    };
  }
  if (me.pc === 'c-check') {
    if (me.seenStatus === 'active') {
      me.pc = 'c-write';
      return {
        kind: 'app',
        line: 1,
        label: 'check: active',
        message: `The webhook checks the status it read: active, so it goes on to confirm. The status may have changed since.`,
      };
    }
    finish(me, 'refunded');
    return {
      kind: 'app',
      line: 1,
      label: 'check: gone, refund',
      message: `The webhook checks the status it read: ${me.seenStatus}. The hold is gone, so ${me.name}'s payment is refunded.`,
    };
  }
  if (me.pc === 'c-write') {
    const hold = setHold(draft, me.holdId as number, 'confirmed');
    draft.store.sold += hold.qty;
    draft.store.held -= hold.qty;
    draft.store.commits += 1;
    finish(me, 'bought');
    return {
      kind: 'db',
      line: 2,
      label: `confirm → sold ${draft.store.sold}`,
      message: `The webhook confirms ${me.name}'s hold without naming the status it expects. The hold was ${hold.status}. sold = ${draft.store.sold}, held = ${draft.store.held}.${corruptNote(draft)}`,
    };
  }
  if (me.pc === 's-select') {
    const found = draft.store.holds.find((h) => h.status === 'active' && h.overdue);
    if (!found) {
      finish(me, 'nothing-to-sweep');
      return {
        kind: 'db',
        line: 3,
        label: 'SELECT → none',
        message: 'The sweep looks for active holds past their expiry and finds none. It stops.',
      };
    }
    me.holdId = found.id;
    me.seenStatus = found.status;
    me.pc = 's-write';
    return {
      kind: 'db',
      line: 3,
      label: `SELECT → ${found.owner}'s hold`,
      message: `The sweep looks for active holds past their expiry and finds ${found.owner}'s.`,
    };
  }
  const hold = setHold(draft, me.holdId as number, 'expired');
  draft.store.held -= hold.qty;
  finish(me, 'swept');
  return {
    kind: 'db',
    line: 4,
    label: `expire → held ${draft.store.held}`,
    message: `The sweep expires ${hold.owner}'s hold without naming the status it expects. The hold was ${hold.status}. held = ${draft.store.held}.${corruptNote(draft)}`,
  };
}

function holdsGuarded(draft: Draft, me: Mutable<Actor>): Emit {
  if (me.pc === 'reserve') return reserveHold(draft, me, 4, 'claim');
  const sweeping = me.program === 'sweep';
  const who = sweeping ? 'The sweep' : `${me.name}'s payment webhook`;

  if (me.pc === 'claim' || me.pc === 's-claim') {
    const target = sweeping
      ? draft.store.holds.find((h) => h.status === 'active' && h.overdue)
      : draft.store.holds.find((h) => h.id === me.holdId && h.status === 'active');
    const line = sweeping ? 2 : 0;
    if (!target) {
      const woke = me.resumed;
      releaseIfHeld(draft, me);
      me.rows = 0;
      me.pc = sweeping ? 's-settle' : 'settle';
      return {
        kind: 'db',
        line,
        label: 'UPDATE: 0 rows',
        message: `${who} ${woke ? 'wakes and the WHERE clause is tested again on the committed row' : 'runs its guarded UPDATE'}. No hold is still active${sweeping ? ' and overdue' : ''}, so 0 rows change.${wakeNote(draft)}`,
      };
    }
    if (target.id === CONTENDED_HOLD && !acquire(draft, me)) {
      return {
        kind: 'db',
        line,
        label: 'UPDATE blocked',
        message: `${who} runs its guarded UPDATE, but ${holderName(draft)} holds the lock on that hold. It sleeps until that transaction ends.`,
        blocked: true,
      };
    }
    me.rows = 1;
    me.holdId = target.id;
    me.pc = sweeping ? 's-settle' : 'settle';
    return {
      kind: 'db',
      line,
      label: 'UPDATE: 1 row',
      message: `${who} runs its guarded UPDATE. The hold is active, so 1 row changes and the hold's row is locked until COMMIT. Whoever comes second will find the status changed.`,
    };
  }

  const line = sweeping ? 3 : 1;
  if (me.rows !== 1) {
    finish(me, sweeping ? 'nothing-to-sweep' : 'refunded');
    return {
      kind: 'app',
      line,
      label: sweeping ? 'rows 0: nothing to do' : 'rows 0: refund',
      message: sweeping
        ? 'The sweep reads the row count: 0. It releases no capacity, because it expired nothing.'
        : `The webhook reads the row count: 0. The hold is gone, so ${me.name}'s payment is refunded. That is the cost: ${me.name} paid and has no ticket.`,
    };
  }
  const hold = setHold(draft, me.holdId as number, sweeping ? 'expired' : 'confirmed');
  if (!sweeping) draft.store.sold += hold.qty;
  draft.store.held -= hold.qty;
  draft.store.commits += 1;
  releaseIfHeld(draft, me);
  finish(me, sweeping ? 'swept' : 'bought');
  return {
    kind: 'db',
    line,
    label: sweeping ? `COMMIT → held ${draft.store.held}` : `COMMIT → sold ${draft.store.sold}`,
    message: sweeping
      ? `The sweep releases the capacity and commits: ${hold.owner}'s hold is expired, held = ${draft.store.held}.${wakeNote(draft)}`
      : `The webhook moves the ticket from held to sold and commits: sold = ${draft.store.sold}, held = ${draft.store.held}.${wakeNote(draft)}`,
  };
}

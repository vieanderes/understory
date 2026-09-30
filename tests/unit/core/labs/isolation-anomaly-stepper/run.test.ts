import { describe, expect, it } from 'vitest';
import { canRun, initialState, step } from '@/core/labs/isolation-anomaly-stepper/engine';
import {
  committedTables,
  isVisible,
  rowId,
  takeSnapshot,
} from '@/core/labs/isolation-anomaly-stepper/mvcc';
import { compare, matches } from '@/core/labs/isolation-anomaly-stepper/predicate';
import { run, runNext } from '@/core/labs/isolation-anomaly-stepper/run';
import { buildScenario } from '@/core/labs/isolation-anomaly-stepper/scenarios';
import type { TxId, Version } from '@/core/labs/isolation-anomaly-stepper/types';

describe('run', () => {
  it('finishes both transactions whatever the wish leaves out', () => {
    const built = buildScenario('write-skew');
    const { frames, schedule } = run(built.scenario, 'read-committed', [1]);
    expect(schedule.filter((tx) => tx === 1).length).toBe(4);
    expect(schedule.filter((tx) => tx === 2).length).toBe(4);
    expect(frames[frames.length - 1]?.txs[2].status).toBe('committed');
  });

  it('ignores a wish for a transaction that is waiting, and comes back to it', () => {
    const built = buildScenario('lost-update', 'atomic');
    // Ask for T2 twice in a row: its second turn is absorbed by the wake.
    const { schedule } = run(built.scenario, 'read-committed', [1, 1, 2, 2, 2, 2, 1, 1]);
    expect(schedule).toEqual([1, 1, 2, 2, 1, 2]);
  });

  it('runs a whole transaction first when the wish asks for nothing', () => {
    const built = buildScenario('phantom-read');
    const { schedule } = run(built.scenario, 'read-committed', []);
    expect(schedule).toEqual([1, 1, 1, 1, 2, 2, 2]);
  });
});

describe('runNext', () => {
  it('moves the next turn of one transaction to the front of what is left', () => {
    expect(runNext([1, 1, 2, 2], 1, 2)).toEqual([1, 2, 1, 2]);
    expect(runNext([1, 1, 2, 2], 0, 1)).toEqual([1, 1, 2, 2]);
  });

  it('adds a turn when the plan had none left for that transaction', () => {
    expect(runNext([1, 1], 2, 2)).toEqual([1, 1, 2]);
  });
});

describe('mvcc', () => {
  const version = (xmin: number, xmax: number | null): Version => ({
    table: 't',
    key: 1,
    values: { id: 1 },
    xmin,
    xmax,
  });

  it('names a row by table and key', () => {
    expect(rowId('bookings', 3)).toBe('bookings/3');
  });

  it('lists the committed transactions, in order', () => {
    expect(takeSnapshot({ 0: 'committed', 1: 'in-progress', 2: 'committed' })).toEqual([0, 2]);
    expect(takeSnapshot({ 0: 'committed', 1: 'aborted' })).toEqual([0]);
  });

  it('shows a version when its creator is visible and its deleter is not', () => {
    expect(isVisible(version(0, null), [0], 1)).toBe(true);
    expect(isVisible(version(2, null), [0], 1)).toBe(false);
    expect(isVisible(version(1, null), [0], 1)).toBe(true);
    expect(isVisible(version(0, 2), [0, 2], 1)).toBe(false);
    expect(isVisible(version(0, 2), [0], 1)).toBe(true);
    expect(isVisible(version(0, 1), [0], 1)).toBe(false);
  });

  it('sorts the committed rows by key, whatever the key type is', () => {
    const tables = [{ name: 't', columns: ['k'], key: 'k' }];
    const versions: Version[] = [
      { table: 't', key: 'b', values: { k: 'b' }, xmin: 0, xmax: null },
      { table: 't', key: 'a', values: { k: 'a' }, xmin: 0, xmax: null },
    ];
    expect(committedTables(tables, versions, { 0: 'committed' })).toEqual({
      t: [{ k: 'a' }, { k: 'b' }],
    });
  });
});

describe('predicate', () => {
  it('compares only values of the same type, and never an unset one', () => {
    expect(compare(1, '=', 1)).toBe(true);
    expect(compare(1, '<>', 2)).toBe(true);
    expect(compare(1, '<', 2)).toBe(true);
    expect(compare(2, '<=', 2)).toBe(true);
    expect(compare(3, '>', 2)).toBe(true);
    expect(compare(3, '>=', 3)).toBe(true);
    expect(compare('1', '=', 1)).toBe(false);
    expect(compare(undefined, '=', 1)).toBe(false);
    expect(compare(1, '=', undefined)).toBe(false);
  });

  it('matches every row on the empty predicate and compares columns to columns', () => {
    expect(matches([], { a: 1 })).toBe(true);
    expect(matches([{ col: 'a', op: '<', value: { col: 'b' } }], { a: 1, b: 2 })).toBe(true);
    expect(matches([{ col: 'a', op: '<', value: { col: 'b' } }], { a: 2, b: 2 })).toBe(false);
  });
});

describe('stepping by hand', () => {
  it('gives the same frames as run for the same order', () => {
    const built = buildScenario('check-then-insert');
    const byRun = run(built.scenario, 'serializable', built.schedule);
    let state = initialState(built.scenario, 'serializable');
    const frames = [state];
    for (const tx of byRun.schedule as readonly TxId[]) {
      expect(canRun(state, tx)).toBe(true);
      state = step(built.scenario, state, tx);
      frames.push(state);
    }
    expect(frames).toEqual(byRun.frames);
  });
});

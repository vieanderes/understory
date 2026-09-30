import { describe, expect, it } from 'vitest';
import { buildScenario } from '@/core/labs/isolation-anomaly-stepper/scenarios';
import {
  ANOMALY_LABEL,
  LEVEL_LABEL,
  LEVEL_NOTE,
  applicationLine,
  invariantText,
  sawText,
  serialText,
  stepStatus,
  verdictHeadline,
} from '@/core/labs/isolation-anomaly-stepper/summary';
import { LEVELS } from '@/core/labs/isolation-anomaly-stepper/types';
import { finish } from './helpers';

describe('labels', () => {
  it('names every level and every anomaly in words', () => {
    expect(LEVELS.map((l) => LEVEL_LABEL[l])).toEqual([
      'READ COMMITTED',
      'REPEATABLE READ',
      'SERIALIZABLE',
    ]);
    expect(LEVEL_NOTE['read-committed']).toContain('new snapshot');
    expect(ANOMALY_LABEL['write-skew']).toBe('write skew');
  });
});

describe('sawText', () => {
  const at = (id: string, level: 'read-committed' | 'serializable', tx: 1 | 2, i: number) => {
    const { built, end } = finish(id, level);
    return sawText(built.lines[tx][i]!, end.txs[tx].outcomes[i]);
  };

  it('says what a statement did, in one sentence each', () => {
    expect(at('non-repeatable-read', 'read-committed', 1, 0)).toBe(
      'The transaction is open. Its snapshot is taken by the first query.',
    );
    expect(at('non-repeatable-read', 'read-committed', 1, 1)).toBe('It saw balance 100.');
    expect(at('non-repeatable-read', 'read-committed', 2, 1)).toBe('It changed 1 row.');
    expect(at('non-repeatable-read', 'read-committed', 1, 3)).toBe('The transaction committed.');
    expect(at('phantom-read', 'read-committed', 1, 1)).toBe('It saw count 2.');
    expect(at('phantom-read', 'read-committed', 2, 1)).toBe('It inserted 1 row.');
  });

  it('names the failure and the ignored statements after it', () => {
    const { built, end } = finish('check-then-insert', 'serializable');
    expect(sawText(built.lines[2][2]!, end.txs[2].outcomes[2])).toBe(
      'It failed with SQLSTATE 40001: could not serialize access due to read/write dependencies among transactions.',
    );
    expect(sawText(built.lines[2][3]!, end.txs[2].outcomes[3])).toBe(
      'The transaction was already aborted, so COMMIT rolled it back.',
    );
  });

  it('says nothing has run yet for a statement with no outcome', () => {
    const built = buildScenario('check-then-insert');
    expect(sawText(built.lines[1][1]!, undefined)).toBe('Not run yet.');
  });

  it('names the wait and the re-evaluated WHERE clause', () => {
    const { built, result } = finish('lost-update', 'read-committed', 'atomic');
    const blocked = result.frames[4]!;
    expect(sawText(built.lines[2][1]!, blocked.txs[2].outcomes[1])).toBe(
      'It waits for T1 to release the lock on products id 1.',
    );
    const { end } = finish('lost-update', 'read-committed', 'atomic');
    expect(sawText(built.lines[2][1]!, end.txs[2].outcomes[1])).toBe(
      'It waited for T1, then re-read the row and changed 1 row.',
    );
  });

  it('says when the application never sent the statement', () => {
    const { built, end } = finish('check-then-insert', 'serializable');
    const skipped = { ...built.lines[1][2]!, stmt: built.lines[1][2]!.stmt };
    expect(sawText(skipped, { ...end.txs[1].outcomes[2]!, status: 'skipped' })).toBe(
      'The application did not send it.',
    );
  });
});

describe('stepStatus', () => {
  it('opens with an invitation and then reports each step', () => {
    const { built, result } = finish('write-skew', 'serializable');
    expect(stepStatus(built, result.frames[0]!)).toBe(
      'Nothing has run yet. Choose which transaction runs next.',
    );
    expect(stepStatus(built, result.frames[2]!)).toBe(
      'T1 ran SELECT count(*) FROM doctors WHERE on_call; It saw count 2.',
    );
    expect(stepStatus(built, result.frames[7]!)).toContain('is now marked to fail');
  });

  it('reports the statement that woke as part of the same step', () => {
    const { built, result } = finish('lost-update', 'read-committed', 'atomic');
    expect(stepStatus(built, result.frames[5]!)).toContain('T2 stopped waiting and ran');
  });
});

describe('the verdict in words', () => {
  it('names the serial order the run matches', () => {
    const { built, end, verdict } = finish('non-repeatable-read', 'repeatable-read');
    expect(verdictHeadline(verdict)).toBe('Same as running T1 then T2. Serialisable.');
    expect(serialText(built, end, verdict.serial[0]!)).toBe('T1 then T2 gives exactly this run.');
    expect(serialText(built, end, verdict.serial[1]!)).toBe(
      'T2 then T1 leaves the same rows, but T1 would have read different results.',
    );
  });

  it('names the anomaly and the rows the serial orders would have left', () => {
    const lost = finish('lost-update', 'read-committed');
    expect(verdictHeadline(lost.verdict)).toBe(
      'Neither serial order gives this. Anomaly: lost update.',
    );
    expect(serialText(lost.built, lost.end, lost.verdict.serial[0]!)).toBe(
      'T1 then T2 leaves products: id 1, stock 3.',
    );
    const skew = finish('write-skew', 'read-committed');
    expect(verdictHeadline(skew.verdict)).toBe(
      'Neither serial order gives this. Anomaly: write skew.',
    );
    expect(serialText(skew.built, skew.end, skew.verdict.serial[0]!)).toBe(
      'T1 then T2 leaves doctors: name bob, on_call true.',
    );
    const booked = finish('check-then-insert', 'read-committed');
    expect(serialText(booked.built, booked.end, booked.verdict.serial[0]!)).toBe(
      'T1 then T2 leaves bookings: no id 4.',
    );
  });

  it('names a run where only one transaction committed', () => {
    const { built, end, verdict } = finish('check-then-insert', 'serializable');
    expect(verdictHeadline(verdict)).toBe('Same as running T1 alone. Serialisable.');
    expect(serialText(built, end, verdict.serial[0]!)).toBe('T1 alone gives exactly this run.');
  });

  it('says what the application saw and what it must do about a failure', () => {
    const { built, end } = finish('lost-update', 'repeatable-read');
    expect(applicationLine(built, end, 2)).toBe('T2 committed. It saw stock 5.');
    expect(applicationLine(built, end, 1)).toBe(
      'T1 was rolled back with SQLSTATE 40001. The application has to retry the whole transaction.',
    );
  });

  it('reports the rule the scenario is about', () => {
    expect(invariantText(finish('write-skew', 'repeatable-read').verdict)).toBe(
      'Broken: at least one doctor on call. The count is 0.',
    );
    expect(invariantText(finish('write-skew', 'serializable').verdict)).toBe(
      'Holds: at least one doctor on call. The count is 1.',
    );
    expect(invariantText(finish('phantom-read', 'read-committed').verdict)).toBeNull();
  });
});

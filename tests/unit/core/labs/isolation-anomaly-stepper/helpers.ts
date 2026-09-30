import { committedTables } from '@/core/labs/isolation-anomaly-stepper/mvcc';
import { run, type Run } from '@/core/labs/isolation-anomaly-stepper/run';
import { buildScenario, type Built } from '@/core/labs/isolation-anomaly-stepper/scenarios';
import type {
  EngineState,
  Level,
  Row,
  Scenario,
  TxId,
} from '@/core/labs/isolation-anomaly-stepper/types';
import { verdict, type Verdict } from '@/core/labs/isolation-anomaly-stepper/verdict';

export interface Finished {
  built: Built;
  result: Run;
  end: EngineState;
  tables: Record<string, Row[]>;
  verdict: Verdict;
}

/** Runs a shipped scenario's preset interleaving at one level, to its end. */
export function finish(id: string, level: Level, variant?: string): Finished {
  const built = buildScenario(id, variant);
  return { built, ...play(built.scenario, level, built.schedule) };
}

/** Runs any scenario and a wished interleaving to its end. */
export function play(
  scenario: Scenario,
  level: Level,
  schedule: readonly TxId[],
): Omit<Finished, 'built'> {
  const result = run(scenario, level, schedule);
  const end = result.frames[result.frames.length - 1] as EngineState;
  return {
    result,
    end,
    tables: committedTables(scenario.tables, end.versions, end.clog),
    verdict: verdict(scenario, end) as Verdict,
  };
}

/** The SQLSTATE of each statement of one transaction, or null where it did not fail. */
export function errors(end: EngineState, tx: TxId): (string | null)[] {
  return end.txs[tx].outcomes.map((o) => o.error?.sqlstate ?? null);
}

export function statuses(end: EngineState, tx: TxId): string[] {
  return end.txs[tx].outcomes.map((o) => o.status);
}

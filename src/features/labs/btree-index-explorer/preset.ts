import { z } from 'zod';
import {
  DEFAULT_SCENARIO_ID,
  QUERIES,
  SCENARIOS,
  scenarioById,
  type QueryDef,
  type Scenario,
} from '@/core/labs/btree-index-explorer';

/** The cost model is only interesting over a table too big to read twice. */
export const ROWS_MIN = 1_000;
export const ROWS_MAX = 10_000_000;
/** Ten stops per decade on the slider, so the whole range is 41 steps. */
const STOPS_PER_DECADE = 10;
export const ROWS_STOP_MIN = 3 * STOPS_PER_DECADE;
export const ROWS_STOP_MAX = 7 * STOPS_PER_DECADE;

/** A slider stop as a row count, rounded to two figures so the label stays readable. */
export function rowsAtStop(stop: number): number {
  return Number((10 ** (stop / STOPS_PER_DECADE)).toPrecision(2));
}

export function stopForRows(rows: number): number {
  const stop = Math.round(Math.log10(rows) * STOPS_PER_DECADE);
  return Math.min(ROWS_STOP_MAX, Math.max(ROWS_STOP_MIN, stop));
}

const SCENARIO_IDS = SCENARIOS.map((s) => s.id) as [string, ...string[]];
const QUERY_IDS = QUERIES.map((q) => q.id) as [string, ...string[]];

/** What a lesson may set: `{ scenario: 'page-splits', rows: 1000000, hideSwitcher: true }`. */
const presetSchema = z.object({
  scenario: z.enum(SCENARIO_IDS).optional(),
  rows: z.number().int().min(ROWS_MIN).max(ROWS_MAX).optional(),
  query: z.enum(QUERY_IDS).optional(),
  hideSwitcher: z.boolean().optional(),
});

export interface Preset {
  scenario: Scenario;
  rowsStop: number;
  queryId: string;
  /** The index the query starts on: the scenario's, when the query is the scenario's own. */
  indexId: string;
  hideSwitcher: boolean;
}

/**
 * The first index a query offers that is not "no index". It is often the one that reads
 * as the obvious choice and is not, which is the whole point of the second part.
 */
export function defaultIndexId(query: QueryDef): string {
  return (query.indexes[1] ?? query.indexes[0]!).id;
}

/** A lesson author's typo must not break the lesson: anything invalid gives the default lab. */
export function parsePreset(preset: Record<string, unknown> | undefined): Preset {
  const parsed = presetSchema.safeParse(preset ?? {});
  const data = parsed.success ? parsed.data : {};
  const scenario = scenarioById(data.scenario ?? DEFAULT_SCENARIO_ID);
  const queryId = data.query ?? scenario.queryId;
  const query = QUERIES.find((q) => q.id === queryId)!;
  return {
    scenario,
    rowsStop: stopForRows(data.rows ?? scenario.rows),
    queryId,
    indexId: queryId === scenario.queryId ? scenario.indexId : defaultIndexId(query),
    hideSwitcher: data.hideSwitcher ?? false,
  };
}

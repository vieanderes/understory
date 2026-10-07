import * as z from '@/core/zod';
import {
  DEFAULT_SCENARIO,
  HOLDS_STRATEGIES,
  MAX_BUYERS,
  MAX_CAPACITY,
  MAX_QTY,
  MIN_BUYERS,
  RESERVE_STRATEGIES,
  SCENARIOS,
  scenarioById,
  type Scenario,
  type Strategy,
} from '@/core/labs/overselling-simulator';

export interface Params {
  buyers: number;
  capacity: number;
  sold: number;
  qtyEach: number;
}

export interface Preset {
  scenario: Scenario;
  strategy: Strategy;
  params: Params;
  /** A lesson that has already chosen the case hides the switchers. */
  hideSwitcher: boolean;
}

const SCENARIO_IDS = SCENARIOS.map((scenario) => scenario.id) as [string, ...string[]];
const STRATEGY_IDS = [...RESERVE_STRATEGIES, ...HOLDS_STRATEGIES] as [string, ...string[]];

/** What a lesson may set: `{ scenario: 'last-ticket', strategy: 'atomic-update', sold: 99 }`. */
const presetSchema = z.object({
  scenario: z.enum(SCENARIO_IDS).optional(),
  strategy: z.enum(STRATEGY_IDS).optional(),
  buyers: z.number().int().min(MIN_BUYERS).max(MAX_BUYERS).optional(),
  capacity: z.number().int().min(1).max(MAX_CAPACITY).optional(),
  sold: z.number().int().min(0).max(MAX_CAPACITY).optional(),
  qtyEach: z.number().int().min(1).max(MAX_QTY).optional(),
  hideSwitcher: z.boolean().optional(),
});

export function paramsOf(scenario: Scenario): Params {
  return {
    buyers: scenario.buyers,
    capacity: scenario.capacity,
    sold: scenario.sold,
    qtyEach: scenario.qtyEach,
  };
}

/**
 * A lesson author's typo must not teach the wrong race: anything the schema rejects gives
 * the default scenario whole, rather than half a case.
 */
export function parsePreset(preset: Record<string, unknown> | undefined): Preset {
  const parsed = presetSchema.safeParse(preset ?? {});
  if (!parsed.success) {
    return {
      scenario: DEFAULT_SCENARIO,
      strategy: DEFAULT_SCENARIO.strategy,
      params: paramsOf(DEFAULT_SCENARIO),
      hideSwitcher: false,
    };
  }
  const data = parsed.data;
  const scenario = (data.scenario ? scenarioById(data.scenario) : undefined) ?? DEFAULT_SCENARIO;
  const base = paramsOf(scenario);
  return {
    scenario,
    strategy: (data.strategy as Strategy | undefined) ?? scenario.strategy,
    params: {
      buyers: data.buyers ?? base.buyers,
      capacity: data.capacity ?? base.capacity,
      sold: data.sold ?? base.sold,
      qtyEach: data.qtyEach ?? base.qtyEach,
    },
    hideSwitcher: data.hideSwitcher ?? false,
  };
}

import * as z from '@/core/zod';
import {
  DEFAULT_SCENARIO,
  SCENARIOS,
  scenarioById,
  type JourneyInput,
  type Scenario,
} from '@/core/labs/request-journey';

export const RTT_MIN = 10;
export const RTT_MAX = 300;
export const RTT_STEP = 10;

const SCENARIO_IDS = SCENARIOS.map((scenario) => scenario.id) as [string, ...string[]];

/** A lesson may pick a scenario and override any of its conditions. */
const presetSchema = z.object({
  scenario: z.enum(SCENARIO_IDS).optional(),
  url: z.string().max(200).optional(),
  rttMs: z.number().int().min(RTT_MIN).max(RTT_MAX).optional(),
  edgeRttMs: z.number().int().min(1).max(RTT_MAX).optional(),
  dnsCached: z.boolean().optional(),
  connectionReused: z.boolean().optional(),
  tlsResumed: z.boolean().optional(),
  http: z.enum(['1.1', '2', '3']).optional(),
  cdn: z.enum(['hit', 'miss', 'none']).optional(),
  httpCache: z.enum(['empty', 'stale', 'fresh']).optional(),
  serverMs: z.number().int().min(0).max(10_000).optional(),
  htmlKb: z.number().min(1).max(5_000).optional(),
  bandwidthMbps: z.number().min(0.1).max(1_000).optional(),
  renderBlockingCss: z.boolean().optional(),
});

export interface Start {
  scenario: Scenario;
  input: JourneyInput;
}

/** An invalid preset is ignored whole: a half-applied preset would teach the wrong run. */
export function startFrom(preset: Record<string, unknown> | undefined): Start {
  const parsed = presetSchema.safeParse(preset ?? {});
  if (!parsed.success) return { scenario: DEFAULT_SCENARIO, input: DEFAULT_SCENARIO.input };
  const { scenario: id, ...overrides } = parsed.data;
  const scenario = (id ? scenarioById(id) : undefined) ?? DEFAULT_SCENARIO;
  const given = Object.fromEntries(
    Object.entries(overrides).filter(([, value]) => value !== undefined),
  ) as Partial<JourneyInput>;
  return { scenario, input: { ...scenario.input, ...given } };
}

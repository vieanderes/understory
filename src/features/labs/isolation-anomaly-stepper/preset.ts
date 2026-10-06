import * as z from '@/core/zod';
import {
  DEFAULT_SCENARIO_ID,
  LEVELS,
  SCENARIO_IDS,
  scenarioDef,
  variantOf,
  type Level,
  type ScenarioDef,
  type ScenarioId,
} from '@/core/labs/isolation-anomaly-stepper';

export interface Preset {
  scenario: ScenarioId;
  variant: string;
  level: Level;
  /** A lesson that has already chosen the case hides the scenario and variant pickers. */
  hideSwitcher: boolean;
}

/** What a lesson may set: `{ scenario: 'write-skew', level: 'serializable' }`. */
const presetSchema = z.object({
  scenario: z.enum(SCENARIO_IDS).optional(),
  variant: z.string().optional(),
  level: z.enum(LEVELS as [Level, ...Level[]]).optional(),
  hideSwitcher: z.boolean().optional(),
});

/** A typo in a lesson gives the default case whole, never half of one. */
export function parsePreset(preset: Record<string, unknown> | undefined): Preset {
  const parsed = presetSchema.safeParse(preset ?? {});
  const data = parsed.success ? parsed.data : {};
  const scenario = data.scenario ?? DEFAULT_SCENARIO_ID;
  return {
    scenario,
    variant: variantOf(scenarioDef(scenario) as ScenarioDef, data.variant),
    level: data.level ?? 'read-committed',
    hideSwitcher: data.hideSwitcher ?? false,
  };
}

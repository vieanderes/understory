import * as z from '@/core/zod';
import { DEFAULT_SCENARIO_ID, SCENARIO_IDS, type ScenarioId } from '@/core/labs/event-loop-stepper';

/** What a lesson may set: `{ scenario: 'async-await', value: 3, hideSwitcher: true }`. */
const presetSchema = z.object({
  scenario: z.enum(SCENARIO_IDS).optional(),
  /** The scenario's one parameter. A value that is not offered falls back to the default. */
  value: z.number().optional(),
  hideSwitcher: z.boolean().optional(),
});

export interface Preset {
  scenario: ScenarioId;
  value: number | undefined;
  hideSwitcher: boolean;
}

/** A lesson author's typo must not break the lesson: anything invalid gives the default lab. */
export function parsePreset(preset: Record<string, unknown> | undefined): Preset {
  const parsed = presetSchema.safeParse(preset ?? {});
  const data = parsed.success ? parsed.data : {};
  return {
    scenario: data.scenario ?? DEFAULT_SCENARIO_ID,
    value: data.value,
    hideSwitcher: data.hideSwitcher ?? false,
  };
}

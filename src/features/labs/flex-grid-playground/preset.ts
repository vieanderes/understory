import * as z from '@/core/zod';
import {
  DEFAULT_SCENARIO_ID,
  SCENARIO_IDS,
  SCENARIOS,
  scenarioById,
  type FlexItem,
  type Scenario,
  type Track,
} from '@/core/labs/flex-grid-playground';

/** What the controls allow: enough to overflow the row, not enough to leave the stage. */
export const RANGE = {
  containerWidth: { min: 160, max: 320 },
  gap: { min: 0, max: 32 },
  factor: { min: 0, max: 6 },
  basis: { min: 0, max: 320 },
  minWidth: { min: 0, max: 320 },
  itemCount: { min: 1, max: 6 },
  trackPx: { min: 0, max: 320 },
  trackFr: { min: 0, max: 6 },
  repeatMin: { min: 40, max: 240 },
} as const;

const number = (range: { min: number; max: number }) => z.number().min(range.min).max(range.max);

const itemSchema = z.object({
  grow: number(RANGE.factor).optional(),
  shrink: number(RANGE.factor).optional(),
  basis: number(RANGE.basis).optional(),
  minWidth: z.union([z.literal('auto'), number(RANGE.minWidth)]).optional(),
});

/** A lesson may pick a scenario, override its figures and hide the switcher. */
const presetSchema = z.object({
  scenario: z.enum(SCENARIO_IDS).optional(),
  containerWidth: number(RANGE.containerWidth).optional(),
  gap: number(RANGE.gap).optional(),
  items: z.array(itemSchema).max(4).optional(),
  itemCount: number(RANGE.itemCount).optional(),
  repeatMode: z.enum(['auto-fill', 'auto-fit']).optional(),
  repeatMin: number(RANGE.repeatMin).optional(),
  hideSwitcher: z.boolean().optional(),
});

export interface FlexState {
  containerWidth: number;
  gap: number;
  items: readonly FlexItem[];
}

export interface GridState {
  containerWidth: number;
  gap: number;
  tracks: readonly Track[];
  itemCount: number;
}

export interface Start {
  scenario: Scenario;
  flex: FlexState;
  grid: GridState;
  hideSwitcher: boolean;
}

function firstOf<K extends Scenario['kind']>(kind: K): Extract<Scenario, { kind: K }> {
  for (const scenario of SCENARIOS)
    if (scenario.kind === kind) return scenario as Extract<Scenario, { kind: K }>;
  throw new RangeError(`The engine ships no ${kind} scenario`);
}

const set = <T>(value: T | undefined, fallback: T): T => (value === undefined ? fallback : value);

/** An invalid preset is ignored whole: a half-applied preset would teach the wrong row. */
export function startFrom(preset: Record<string, unknown> | undefined): Start {
  const parsed = presetSchema.safeParse(preset ?? {});
  const given = parsed.success ? parsed.data : {};
  const scenario = scenarioById(given.scenario ?? DEFAULT_SCENARIO_ID);
  const flexSource = scenario.kind === 'flex' ? scenario : firstOf('flex');
  const gridSource = scenario.kind === 'grid' ? scenario : firstOf('grid');

  return {
    scenario,
    hideSwitcher: given.hideSwitcher === true,
    flex: {
      containerWidth: set(given.containerWidth, flexSource.containerWidth),
      gap: set(given.gap, flexSource.gap),
      items: flexSource.items.map((item, index) => {
        const over = given.items?.[index];
        return {
          ...item,
          grow: set(over?.grow, item.grow),
          shrink: set(over?.shrink, item.shrink),
          basis: set(over?.basis, item.basis),
          minWidth: set(over?.minWidth, item.minWidth),
        };
      }),
    },
    grid: {
      containerWidth: set(given.containerWidth, gridSource.containerWidth),
      gap: set(given.gap, gridSource.gap),
      itemCount: set(given.itemCount, gridSource.itemCount),
      tracks: gridSource.tracks.map((track) =>
        track.kind === 'repeat'
          ? {
              ...track,
              mode: set(given.repeatMode, track.mode),
              min: set(given.repeatMin, track.min),
            }
          : track,
      ),
    },
  };
}

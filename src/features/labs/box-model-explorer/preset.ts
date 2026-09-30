import { z } from 'zod';
import {
  DEFAULT_SCENARIO_ID,
  SCENARIO_IDS,
  SCENARIOS,
  scenarioById,
  type BoxInput,
  type Scenario,
  type StackInput,
} from '@/core/labs/box-model-explorer';

/** What the controls allow: wide enough to break the layout, narrow enough to stay legible. */
export const RANGE = {
  width: { min: 0, max: 280 },
  height: { min: 0, max: 200 },
  padding: { min: 0, max: 48 },
  border: { min: 0, max: 12 },
  margin: { min: 0, max: 48 },
  actMargin: { min: -24, max: 64 },
  parentPadding: { min: 0, max: 32 },
  parentBorder: { min: 0, max: 16 },
} as const;

const number = (range: { min: number; max: number }) => z.number().min(range.min).max(range.max);

/** A lesson may pick a scenario, override its figures and hide the switcher. */
const presetSchema = z.object({
  scenario: z.enum(SCENARIO_IDS).optional(),
  width: number(RANGE.width).optional(),
  height: number(RANGE.height).optional(),
  padding: number(RANGE.padding).optional(),
  paddingUnit: z.enum(['px', 'percent']).optional(),
  border: number(RANGE.border).optional(),
  margin: number(RANGE.margin).optional(),
  boxSizing: z.enum(['content-box', 'border-box']).optional(),
  marginTopA: number(RANGE.actMargin).optional(),
  marginBottomA: number(RANGE.actMargin).optional(),
  marginTopB: number(RANGE.actMargin).optional(),
  parent: z.enum(['plain', 'padding', 'border', 'flow-root', 'flex', 'grid']).optional(),
  parentPadding: number(RANGE.parentPadding).optional(),
  parentBorder: number(RANGE.parentBorder).optional(),
  hideSwitcher: z.boolean().optional(),
});

export interface Start {
  scenario: Scenario;
  box: BoxInput;
  stack: StackInput;
  hideSwitcher: boolean;
}

function firstBox(): BoxInput {
  for (const scenario of SCENARIOS) if (scenario.kind === 'box') return scenario.box;
  throw new RangeError('The engine ships no box scenario');
}

function firstStack(): StackInput {
  for (const scenario of SCENARIOS) if (scenario.kind === 'stack') return scenario.stack;
  throw new RangeError('The engine ships no stack scenario');
}

/** An invalid preset is ignored whole: a half-applied preset would teach the wrong box. */
export function startFrom(preset: Record<string, unknown> | undefined): Start {
  const parsed = presetSchema.safeParse(preset ?? {});
  const given = parsed.success ? parsed.data : {};
  const scenario = scenarioById(given.scenario ?? DEFAULT_SCENARIO_ID);
  const box = scenario.kind === 'box' ? scenario.box : firstBox();
  const stack = scenario.kind === 'stack' ? scenario.stack : firstStack();
  const set = <T>(value: T | undefined, fallback: T): T => (value === undefined ? fallback : value);

  return {
    scenario,
    hideSwitcher: given.hideSwitcher === true,
    box: {
      ...box,
      width: set(given.width, box.width),
      height: set(given.height, box.height),
      padding: set(given.padding, box.padding),
      paddingUnit: set(given.paddingUnit, box.paddingUnit),
      border: set(given.border, box.border),
      margin: set(given.margin, box.margin),
      boxSizing: set(given.boxSizing, box.boxSizing),
    },
    stack: {
      ...stack,
      marginTopA: set(given.marginTopA, stack.marginTopA),
      marginBottomA: set(given.marginBottomA, stack.marginBottomA),
      marginTopB: set(given.marginTopB, stack.marginTopB),
      parent: set(given.parent, stack.parent),
      parentPadding: set(given.parentPadding, stack.parentPadding),
      parentBorder: set(given.parentBorder, stack.parentBorder),
    },
  };
}

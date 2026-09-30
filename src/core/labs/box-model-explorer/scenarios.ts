import type { BoxInput, Scenario, ScenarioId, StackInput } from './types';

/** The stage is one 320 px column, so it fits a phone. */
export const CONTAINER_WIDTH = 320;

const CARD: BoxInput = {
  width: 200,
  height: 96,
  padding: 16,
  paddingUnit: 'px',
  border: 2,
  margin: 16,
  boxSizing: 'content-box',
  containerWidth: CONTAINER_WIDTH,
};

const PARAGRAPHS: StackInput = {
  marginTopA: 16,
  marginBottomA: 24,
  marginTopB: 16,
  parent: 'plain',
  parentPadding: 8,
  parentBorder: 4,
};

export const SCENARIOS: readonly Scenario[] = [
  {
    id: 'profile-card',
    kind: 'box',
    label: 'Card',
    prompt:
      'Before you step: the profile card declares width 200. How wide is it on screen, and what changes under border-box?',
    box: CARD,
  },
  {
    id: 'percent-padding',
    kind: 'box',
    label: 'Banner',
    prompt:
      'Before you step: the banner is 80 tall with padding 10%. Is its top padding 8 px, or something else?',
    box: { ...CARD, width: 160, height: 80, padding: 10, paddingUnit: 'percent', border: 1 },
  },
  {
    id: 'stacked-paragraphs',
    kind: 'stack',
    label: 'Stacked',
    prompt:
      'Before you step: the first paragraph has 24 below it, the second has 16 above it. How far apart are they: 40, 24 or 16?',
    stack: PARAGRAPHS,
  },
  {
    id: 'flex-paragraphs',
    kind: 'stack',
    label: 'Contained',
    prompt:
      'Before you step: the same two paragraphs, now in a flex column. Which of the two collapses still happens?',
    stack: { ...PARAGRAPHS, parent: 'flex' },
  },
];

export const SCENARIO_IDS = SCENARIOS.map((s) => s.id) as [ScenarioId, ...ScenarioId[]];
export const DEFAULT_SCENARIO_ID: ScenarioId = 'profile-card';

export function scenarioById(id: ScenarioId): Scenario {
  const found = SCENARIOS.find((s) => s.id === id);
  if (!found) throw new RangeError(`Unknown scenario: ${id}`);
  return found;
}

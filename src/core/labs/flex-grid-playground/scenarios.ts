import type { FlexItem, Scenario, ScenarioId, Track } from './types';

/** The stage is one 320 px column, so it fits a phone. */
export const CONTAINER_WIDTH = 320;

/**
 * Every item on the stage has 8 px of padding and a 1 px border on each side (`px-1` and
 * `border` in FlexStage), inside `box-sizing: border-box`. The engine needs the number:
 * shrinking is weighed by the content box, so leaving it out predicts 137.5 px where the
 * browser lays out 135.9 px.
 */
export const ITEM_EDGES = 18;

const item = (
  label: string,
  text: string,
  grow: number,
  shrink: number,
  basis: number,
  minWidth: FlexItem['minWidth'] = 'auto',
): FlexItem => ({ label, text, grow, shrink, basis, minWidth, edges: ITEM_EDGES });

export const SCENARIOS: readonly Scenario[] = [
  {
    id: 'grow-row',
    kind: 'flex',
    label: 'Three tabs',
    prompt:
      'Before you step: three tabs, the third with flex-grow 2. Is it twice as wide as the others?',
    containerWidth: CONTAINER_WIDTH,
    gap: 8,
    items: [
      item('Inbox', 'Inbox', 1, 1, 80),
      item('Sent', 'Sent', 1, 1, 80),
      item('Archive', 'Archive', 2, 1, 80),
    ],
  },
  {
    id: 'shrink-row',
    kind: 'flex',
    label: 'Price plans',
    prompt:
      'Before you step: the plans need 440 px and have 320. All three have flex-shrink 1. Do they give up the same amount?',
    containerWidth: CONTAINER_WIDTH,
    gap: 0,
    items: [
      item('Yearly', 'Yearly', 0, 1, 200),
      item('Monthly', 'Monthly', 0, 1, 120, 100),
      item('Weekly', 'Weekly', 0, 1, 120),
    ],
  },
  {
    id: 'long-text',
    kind: 'flex',
    label: 'Cart line',
    prompt:
      'Before you step: the product name has flex 1 1 0 and min-width auto. Does the row fit its 320 px? Then set min-width to 0.',
    containerWidth: CONTAINER_WIDTH,
    gap: 0,
    items: [
      item('Product name', 'Organic oat milk, unsweetened, one litre', 1, 1, 0),
      item('Quantity', '2 ×', 0, 0, 56),
      item('Price', '£3.40', 0, 0, 72),
    ],
  },
  {
    id: 'fr-columns',
    kind: 'grid',
    label: 'Photo grid',
    prompt: 'Before you step: the columns are 96px 1fr 2fr with a gap of 8. How wide is 1fr?',
    containerWidth: CONTAINER_WIDTH,
    gap: 8,
    tracks: [
      { kind: 'px', size: 96 },
      { kind: 'fr', fr: 1 },
      { kind: 'fr', fr: 2 },
    ],
    itemCount: 3,
  },
  {
    id: 'few-items',
    kind: 'grid',
    label: 'Few photos',
    prompt:
      'Before you step: three columns fit, and only two photos are left. How wide is each photo under auto-fill, and under auto-fit?',
    containerWidth: CONTAINER_WIDTH,
    gap: 8,
    tracks: [{ kind: 'repeat', mode: 'auto-fill', min: 100, max: 1, maxUnit: 'fr' }],
    itemCount: 2,
  },
];

export const SCENARIO_IDS = SCENARIOS.map((s) => s.id) as [ScenarioId, ...ScenarioId[]];
export const DEFAULT_SCENARIO_ID: ScenarioId = 'grow-row';

export function scenarioById(id: ScenarioId): Scenario {
  const found = SCENARIOS.find((s) => s.id === id);
  if (!found) throw new RangeError(`Unknown scenario: ${id}`);
  return found;
}

const maxCss = (max: number, unit: 'px' | 'fr') => `${max}${unit}`;

/** One track as written in CSS. */
export function trackCss(track: Track): string {
  switch (track.kind) {
    case 'px':
      return `${track.size}px`;
    case 'fr':
      return `${track.fr}fr`;
    case 'auto':
      return 'auto';
    case 'minmax':
      return `minmax(${track.min}px, ${maxCss(track.max, track.maxUnit)})`;
    case 'repeat':
      return `repeat(${track.mode}, minmax(${track.min}px, ${maxCss(track.max, track.maxUnit)}))`;
  }
}

/** The value of `grid-template-columns`. The view gives the browser this exact string. */
export function trackListCss(tracks: readonly Track[]): string {
  return tracks.map(trackCss).join(' ');
}

import type { Strategy } from './types';

export type ScenarioId = 'last-ticket' | 'on-sale' | 'four-oh-two' | 'abandoned-checkout';

export interface Scenario {
  readonly id: ScenarioId;
  readonly title: string;
  /** What is happening, in a sentence or two. */
  readonly story: string;
  /** Asked before the first step. Predicting first is what makes the lab teach. */
  readonly prediction: string;
  readonly family: 'reserve' | 'holds';
  readonly strategy: Strategy;
  readonly buyers: number;
  readonly capacity: number;
  readonly sold: number;
  readonly qtyEach: number;
  /** Chosen so that the seeded run of the default strategy shows the scenario's point. */
  readonly seed: number;
}

export const SCENARIOS: readonly Scenario[] = [
  {
    id: 'last-ticket',
    title: 'Last ticket, two buyers',
    story: 'A concert has one ticket left. Two buyers press Buy within the same few milliseconds.',
    prediction:
      'Before you step: both buyers run the same code. How many tickets will be sold when both have finished?',
    family: 'reserve',
    strategy: 'check-then-act',
    buyers: 2,
    capacity: 100,
    sold: 99,
    qtyEach: 1,
    seed: 1,
  },
  {
    id: 'on-sale',
    title: 'Booking opens: 6 buyers, 3 seats',
    story:
      'A cooking class opens booking at 10:00 with three seats. Six buyers arrive in the same second.',
    prediction:
      'Before you step: three seats, six buyers. How many of them wait, retry or fail, and does sold stop at 3?',
    family: 'reserve',
    strategy: 'optimistic',
    buyers: 6,
    capacity: 3,
    sold: 0,
    qtyEach: 1,
    seed: 1,
  },
  {
    id: 'four-oh-two',
    title: '402 sold, capacity 400',
    story:
      'The morning after booking opened, the dashboard says 402 of 400. The code ran inside a transaction. Start at 399 with three buyers of one ticket each.',
    prediction:
      'Before you step: every buyer runs in a transaction. What is the largest value sold can reach?',
    family: 'reserve',
    strategy: 'transaction',
    buyers: 3,
    capacity: 400,
    sold: 399,
    qtyEach: 1,
    seed: 1,
  },
  {
    id: 'abandoned-checkout',
    title: 'Abandoned checkout',
    story:
      "A holds the last ticket and left for the bank's confirmation page. The hold has run out. The expiry sweep starts, B is waiting for a ticket, and A's payment arrives late.",
    prediction:
      "Before you step: the sweep and A's late payment both act on the same hold. Who ends up with the last ticket?",
    family: 'holds',
    strategy: 'holds-read-then-write',
    buyers: 3,
    capacity: 400,
    sold: 399,
    qtyEach: 1,
    seed: 1,
  },
];

export const DEFAULT_SCENARIO = SCENARIOS[0] as Scenario;

export function scenarioById(id: string): Scenario | undefined {
  return SCENARIOS.find((s) => s.id === id);
}

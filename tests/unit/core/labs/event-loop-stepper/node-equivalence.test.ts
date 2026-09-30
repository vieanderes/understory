import { describe, expect, it } from 'vitest';
import { buildScenario, run } from '@/core/labs/event-loop-stepper';

/*
 * The display sources of the first three scenarios are real JavaScript. Each was written
 * to a file and run with Node v24.21.0 (`node classic-0.js`), for every value of its
 * parameter; the arrays below are what Node printed, copied verbatim. If the engine and
 * V8 disagree, the engine is wrong.
 */
const NODE_OUTPUT: readonly [
  id: 'classic' | 'microtask-chain' | 'async-await',
  value: number,
  printed: string[],
][] = [
  [
    'classic',
    0,
    ['checkout opened', 'script finished', 'microtask: seat confirmed', 'timeout: hold expired'],
  ],
  [
    'classic',
    10,
    ['checkout opened', 'script finished', 'microtask: seat confirmed', 'timeout: hold expired'],
  ],
  [
    'microtask-chain',
    1,
    ['script finished', 'microtask: check order 1', 'timeout: release unpaid seats'],
  ],
  [
    'microtask-chain',
    3,
    [
      'script finished',
      'microtask: check order 1',
      'microtask: check order 2',
      'microtask: check order 3',
      'timeout: release unpaid seats',
    ],
  ],
  [
    'microtask-chain',
    6,
    [
      'script finished',
      'microtask: check order 1',
      'microtask: check order 2',
      'microtask: check order 3',
      'microtask: check order 4',
      'microtask: check order 5',
      'microtask: check order 6',
      'timeout: release unpaid seats',
    ],
  ],
  [
    'async-await',
    1,
    ['hold: start', 'receipt: start', 'script finished', 'hold: seat reserved', 'receipt: sent'],
  ],
  [
    'async-await',
    2,
    [
      'hold: start',
      'receipt: start',
      'script finished',
      'hold: seat reserved',
      'receipt: sent',
      'hold: payment taken',
    ],
  ],
  [
    'async-await',
    3,
    [
      'hold: start',
      'receipt: start',
      'script finished',
      'hold: seat reserved',
      'receipt: sent',
      'hold: payment taken',
      'hold: ticket issued',
    ],
  ],
];

describe('equivalence with real Node output', () => {
  it.each(NODE_OUTPUT)('%s with %i logs what Node logged', (id, value, printed) => {
    expect(run(buildScenario(id, value)).at(-1)!.output).toEqual(printed);
  });
});

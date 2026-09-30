import { FSRS5_DEFAULT_DECAY, FSRS6_DEFAULT_DECAY, forgetting_curve, default_w } from 'ts-fsrs';
import * as fsrs from 'ts-fsrs';
import { retrievability } from '../../../src/core/scheduling/fsrs.ts';
import {
  weekKey,
  applyWeeks,
  calibrationGap,
  xpFor,
} from '../../../src/core/gamification/gamification.ts';
import { expectedSuccess, updateTheta } from '../../../src/core/mastery/difficulty.ts';
console.log('decay5', FSRS5_DEFAULT_DECAY, 'decay6', FSRS6_DEFAULT_DECAY);
console.log(
  'keys',
  Object.keys(fsrs)
    .filter((k) => /FACTOR|DECAY/i.test(k))
    .map((k) => [k, (fsrs as any)[k]]),
);
const cases: [number, number][] = [
  [7, 0],
  [7, 7],
  [7, 1 / 12],
  [7, 3],
  [1, 1],
  [2.5, 10],
  [21, 30],
  [100, 365],
  [0.4, 0.05],
  [7, -3],
  [0, 5],
  [36500, 1],
];
for (const [s, t] of cases) console.log(JSON.stringify([s, t, retrievability(s, t)]));
for (const d of [
  '2026-09-17',
  '2026-01-01',
  '2027-01-01',
  '2024-12-30',
  '2021-01-03',
  '2020-12-31',
  '2026-12-31',
  '2032-01-01',
])
  console.log(d, weekKey(d));
console.log(
  expectedSuccess(1200, 2),
  expectedSuccess(1000, 5),
  updateTheta(1200, 1, expectedSuccess(1200, 2)),
);
console.log(Math.round(2.5), Math.round(-2.5), Math.round(0.5), Math.round(1.5));

import { tripFare } from './fare.solution';

const FARES = { central: 280, inner: 230, outer: 190, shuttle: 0 };

test('adds the fare of every zone on the trip', () => {
  expect(tripFare(FARES, ['outer', 'inner', 'central'])).toBe(700);
});

test('a trip through no zones costs 0', () => {
  expect(tripFare(FARES, [])).toBe(0);
});

test('returns undefined, not NaN, for a zone with no fare', () => {
  expect(tripFare(FARES, ['harbour'])).toBe(undefined);
});

test('returns undefined when the unknown zone comes last', () => {
  expect(tripFare(FARES, ['outer', 'inner', 'harbour'])).toBe(undefined);
});

test('counts a free zone of 0 pence as a real fare', () => {
  expect(tripFare(FARES, ['shuttle', 'outer'])).toBe(190);
  expect(tripFare(FARES, ['shuttle'])).toBe(0);
});

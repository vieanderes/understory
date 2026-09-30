import { testAdultLimit, testFreeLimit } from './solution';

type Price = (age: number) => number;

// Your code and these checks run as one script, so this is your `ticketPence`. Each check
// swaps in a mutant, runs your tests, then puts the real one back.
declare let ticketPence: Price;
const real = ticketPence;
const yours = [testFreeLimit, testAdultLimit];

function failureOf(version: Price, check: () => void): string | null {
  ticketPence = version;
  try {
    check();
    return null;
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  } finally {
    ticketPence = real;
  }
}

function mutant(freeUnder: number, childUnder: number): Price {
  return (age) => (age < freeUnder ? 0 : age < childUnder ? 600 : 1200);
}

function expectKilled(version: Price, hint: string) {
  if (yours.every((check) => failureOf(version, check) === null)) {
    throw new Error(`The mutant survived. ${hint}`);
  }
}

test('your tests pass on the real prices', () => {
  for (const check of yours) {
    const failure = failureOf(real, check);
    if (failure !== null) throw new Error(`${check.name} fails on working code: ${failure}`);
  }
});

test('they kill `age <= 5`, where a five-year-old goes free', () => {
  expectKilled(mutant(6, 18), 'What should a five-year-old pay?');
});

test('they kill `age < 4`, where a four-year-old pays', () => {
  expectKilled(mutant(4, 18), 'What should a four-year-old pay?');
});

test('they kill `age <= 18`, where an eighteen-year-old pays the child price', () => {
  expectKilled(mutant(5, 19), 'What should an eighteen-year-old pay?');
});

test('they kill `age < 17`, where a seventeen-year-old pays the adult price', () => {
  expectKilled(mutant(5, 17), 'What should a seventeen-year-old pay?');
});

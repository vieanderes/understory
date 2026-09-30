import { testEmptyBasket, testThreeItems } from './solution';

type Total = (prices: number[]) => number;

// Your code and these checks run as one script, so this is your `total`. Each check below
// swaps in a copy, runs your tests, then puts the real one back.
declare let total: Total;
const real = total;
const yours = [testEmptyBasket, testThreeItems];

function failureOf(version: Total, check: () => void): string | null {
  total = version;
  try {
    check();
    return null;
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  } finally {
    total = real;
  }
}

function expectCaught(version: Total, hint: string) {
  if (yours.every((check) => failureOf(version, check) === null)) {
    throw new Error(`Both tests still pass. ${hint}`);
  }
}

test('your tests pass on the real total', () => {
  for (const check of yours) {
    const failure = failureOf(real, check);
    if (failure !== null) throw new Error(`${check.name} fails on working code: ${failure}`);
  }
});

test('they catch a total that skips the first price', () => {
  expectCaught((prices) => {
    let sum = 0;
    for (let i = 1; i < prices.length; i++) sum = sum + (prices[i] ?? 0);
    return sum;
  }, 'Which basket loses money when the first price is left out?');
});

test('they catch a total that counts items instead of adding prices', () => {
  expectCaught((prices) => prices.length, 'Check the exact total of three items.');
});

test('they catch a total that crashes on an empty basket', () => {
  expectCaught((prices) => prices.reduce((sum, price) => sum + price), 'Check what an empty basket costs.');
});

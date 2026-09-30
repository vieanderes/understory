import { testFiftyMugsGetTwentyPercentOff } from './solution';

type Price = (qty: number, unitPence: number) => number;

// Your code and these checks run as one script, so this is your `priceFor`.
declare let priceFor: Price;
const yours = priceFor;

// The rule as it stood before this step: ten percent off from 10 items, nothing more.
const tenPercentOnly: Price = (qty, unitPence) => {
  const full = qty * unitPence;
  return full - (qty >= 10 ? Math.floor(full / 10) : 0);
};

test('red: your new test fails on the old ten-percent rule', () => {
  priceFor = tenPercentOnly;
  let failed = false;
  try {
    testFiftyMugsGetTwentyPercentOff();
  } catch {
    failed = true;
  } finally {
    priceFor = yours;
  }
  if (!failed) throw new Error('Your test passes on the old code, so it asks for nothing new.');
});

test('green: your new test passes on your priceFor', () => {
  testFiftyMugsGetTwentyPercentOff();
});

test('one mug costs the unit price', () => {
  expect(priceFor(1, 400)).toBe(400);
});

test('ten mugs still get ten percent off', () => {
  expect(priceFor(10, 400)).toBe(3600);
});

test('forty-nine mugs still get ten percent, not twenty', () => {
  expect(priceFor(49, 400)).toBe(17640);
});

test('fifty mugs get twenty percent off', () => {
  expect(priceFor(50, 400)).toBe(16000);
});

test('the discount rounds down to a whole penny', () => {
  expect(priceFor(50, 333)).toBe(13320);
});

test('a quantity below one is still refused', () => {
  expect(() => priceFor(0, 400)).toThrow('bad order');
});

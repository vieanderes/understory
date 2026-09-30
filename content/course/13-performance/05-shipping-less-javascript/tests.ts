import { budgetReport } from './solution';

test('a file over its budget gets a line', () => {
  const files = [{ name: 'app-3f9a1c.js', bytes: 262_100 }];
  expect(budgetReport(files, { app: 200 })).toEqual([
    'app-3f9a1c.js is 262 kB, over its 200 kB budget',
  ]);
});

test('a file under or at its budget passes', () => {
  const files = [
    { name: 'app-3f9a1c.js', bytes: 150_000 },
    { name: 'preview-9b2e01.js', bytes: 44_000 },
  ];
  expect(budgetReport(files, { app: 200, preview: 44 })).toEqual([]);
});

test('the hash in the name does not matter', () => {
  const files = [{ name: 'app-77aa00.js', bytes: 250_000 }];
  expect(budgetReport(files, { app: 200 })).toHaveLength(1);
});

test('a file with no budget is left alone', () => {
  const files = [{ name: 'vendor-12ab34.js', bytes: 900_000 }];
  expect(budgetReport(files, { app: 200 })).toEqual([]);
});

test('every file over budget is reported', () => {
  const files = [
    { name: 'app-1.js', bytes: 300_000 },
    { name: 'preview-2.js', bytes: 60_000 },
  ];
  expect(budgetReport(files, { app: 200, preview: 50 })).toEqual([
    'app-1.js is 300 kB, over its 200 kB budget',
    'preview-2.js is 60 kB, over its 50 kB budget',
  ]);
});

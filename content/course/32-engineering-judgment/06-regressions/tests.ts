import { testsToRun, type ImportGraph } from './solution';

// A library app: due dates feed loans and emails, loans feed fines.
const graph: ImportGraph = {
  'src/dates.ts': [],
  'src/loans.ts': ['src/dates.ts'],
  'src/fines.ts': ['src/loans.ts'],
  'src/emails.ts': ['src/dates.ts'],
  'src/search.ts': [],
  'tests/loans.test.ts': ['src/loans.ts'],
  'tests/fines.test.ts': ['src/fines.ts'],
  'tests/emails.test.ts': ['src/emails.ts'],
  'tests/search.test.ts': ['src/search.ts'],
};

test('a file runs the tests that import it directly', () => {
  expect(testsToRun(graph, ['src/fines.ts'])).toEqual(['tests/fines.test.ts']);
});

test('a change reaches tests through other files', () => {
  expect(testsToRun(graph, ['src/loans.ts'])).toEqual(['tests/fines.test.ts', 'tests/loans.test.ts']);
});

test('a shared helper reaches every test above it, sorted, and no others', () => {
  expect(testsToRun(graph, ['src/dates.ts'])).toEqual([
    'tests/emails.test.ts',
    'tests/fines.test.ts',
    'tests/loans.test.ts',
  ]);
});

test('a changed test file runs itself', () => {
  expect(testsToRun(graph, ['tests/search.test.ts'])).toEqual(['tests/search.test.ts']);
});

test('two changes that reach the same test list it once', () => {
  expect(testsToRun(graph, ['src/fines.ts', 'src/loans.ts'])).toEqual([
    'tests/fines.test.ts',
    'tests/loans.test.ts',
  ]);
});

test('an import cycle still finishes', () => {
  const cyclic: ImportGraph = {
    'src/a.ts': ['src/b.ts'],
    'src/b.ts': ['src/a.ts'],
    'tests/a.test.ts': ['src/a.ts'],
  };
  expect(testsToRun(cyclic, ['src/b.ts'])).toEqual(['tests/a.test.ts']);
});

test('a file nothing imports runs no tests', () => {
  expect(testsToRun(graph, ['src/unused.ts'])).toEqual([]);
});

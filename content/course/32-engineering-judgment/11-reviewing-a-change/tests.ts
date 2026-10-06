import { writeVerdict, type Finding } from './solution';

const f = (label: Finding['label'], lens: Finding['lens'], note: string): Finding => ({ label, lens, note });

test('a review with must-fixes requests changes, most serious first', () => {
  const findings = [
    f('nit', 'confuses', 'rename rows to bookings'),
    f('suggestion', 'scales', 'count upcoming bookings in SQL'),
    f('must-fix', 'breaks', 'revert the seatLabel change'),
    f('question', 'tests', 'should the test pin the reply keys?'),
    f('must-fix', 'leaks', 'SELECT * sends payment_token'),
  ];
  expect(writeVerdict(findings)).toEqual({
    decision: 'request changes',
    lines: [
      'must-fix (leaks): SELECT * sends payment_token',
      'must-fix (breaks): revert the seatLabel change',
      'question (tests): should the test pin the reply keys?',
      'suggestion (scales): count upcoming bookings in SQL',
      'nit (confuses): rename rows to bookings',
    ],
  });
});

test('no findings is an approval with nothing to say', () => {
  expect(writeVerdict([])).toEqual({ decision: 'approve', lines: [] });
});

test('nits alone still approve, and are listed', () => {
  expect(writeVerdict([f('nit', 'confuses', 'typo in a comment')])).toEqual({
    decision: 'approve',
    lines: ['nit (confuses): typo in a comment'],
  });
});

test('a question or a suggestion without must-fixes is a comment', () => {
  expect(writeVerdict([f('question', 'breaks', 'what if the film is empty?')]).decision).toBe('comment');
  expect(writeVerdict([f('suggestion', 'scales', 'add an index')]).decision).toBe('comment');
});

test('within a label, lenses go in order, and equal findings keep their order', () => {
  const findings = [
    f('must-fix', 'tests', 'first tests note'),
    f('must-fix', 'leaks', 'leak'),
    f('must-fix', 'tests', 'second tests note'),
  ];
  expect(writeVerdict(findings).lines).toEqual([
    'must-fix (leaks): leak',
    'must-fix (tests): first tests note',
    'must-fix (tests): second tests note',
  ]);
});

import { firstBadStep, type Expectations, type Step } from './trace.solution';

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const fixed: Expectations = {
  contracts: { book_room: { hotel: /^h-\d+$/, date: ISO_DATE, nights: /^[1-9]\d*$/ } },
};

const booking = (date: string): Step[] => [
  { n: 1, kind: 'model', said: 'Two nights from 3 April, hotel h-204.' },
  { n: 2, kind: 'search', query: 'check-in rules', hits: [{ doc: 'kb-31', score: 0.88 }] },
  { n: 3, kind: 'tool', tool: 'book_room', args: { hotel: 'h-204', date, nights: 2, guest: '<email:7f3a>' } },
  { n: 4, kind: 'model', said: 'Booked: two nights from 3 April.' },
];

test('the 4 March booking breaks the new contract at step 3', () => {
  expect(firstBadStep(booking('03/04/2026'), fixed)).toEqual({
    step: 3,
    cause: 'contract',
    detail: 'date',
  });
});

test('the replayed run sends an ISO date and passes: case closed', () => {
  expect(firstBadStep(booking('2026-04-03'), fixed)).toBeNull();
});

test('a missing argument breaks the contract too', () => {
  const trace: Step[] = [
    { n: 1, kind: 'tool', tool: 'book_room', args: { hotel: 'h-204', date: '2026-04-03' } },
  ];
  expect(firstBadStep(trace, fixed)).toEqual({ step: 1, cause: 'contract', detail: 'nights' });
});

const cancellation: Step[] = [
  { n: 1, kind: 'model', said: 'Guest asks if they can cancel for free.' },
  {
    n: 2,
    kind: 'search',
    query: 'free cancellation',
    // recorded in arrival order, not by score
    hits: [
      { doc: 'kb-48', score: 0.71 },
      { doc: 'kb-03', score: 0.79 },
      { doc: 'kb-11', score: 0.77 },
      { doc: 'kb-25', score: 0.74 },
    ],
  },
  { n: 3, kind: 'model', said: 'Yes, free until the day before.' },
];

test('the right document ranked 4th with k = 3 is a retrieval fault', () => {
  const expectations = { contracts: {}, mustRetrieve: { doc: 'kb-48', k: 3 } };
  expect(firstBadStep(cancellation, expectations)).toEqual({
    step: 2,
    cause: 'retrieval',
    detail: 'kb-48',
  });
});

test('a document ranked exactly k counts as retrieved', () => {
  const expectations = { contracts: {}, mustRetrieve: { doc: 'kb-48', k: 4 } };
  expect(firstBadStep(cancellation, expectations)).toBeNull();
});

test('the earliest fault wins, and tools without a contract pass', () => {
  const trace: Step[] = [
    { n: 1, kind: 'tool', tool: 'find_guest', args: { email: '<email:7f3a>' } },
    ...cancellation.slice(1, 2),
    { n: 3, kind: 'tool', tool: 'book_room', args: { hotel: 'h-204', date: '03/04/2026', nights: 2 } },
  ];
  const expectations = { ...fixed, mustRetrieve: { doc: 'kb-48', k: 3 } };
  expect(firstBadStep(trace, expectations)).toEqual({ step: 2, cause: 'retrieval', detail: 'kb-48' });
});

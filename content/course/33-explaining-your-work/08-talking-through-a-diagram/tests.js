const bakery = [
  'flowchart LR',
  'customer --> app',
  'app --> api',
  'api --> queue',
  'api --> db',
  'queue --> worker',
];

test('tells the main path before the side branch', () => {
  expect(talkOrder(bakery, 'customer')).toEqual(['customer', 'app', 'api', 'queue', 'worker', 'db']);
});

test('reads arrows that carry a label', () => {
  const lines = ['app -->|order| api', 'api -->|order id| queue'];
  expect(talkOrder(lines, 'app')).toEqual(['app', 'api', 'queue']);
});

test('tells each box once when an arrow points back', () => {
  const lines = ['customer --> api', 'api --> worker', 'worker -->|receipt| customer'];
  expect(talkOrder(lines, 'customer')).toEqual(['customer', 'api', 'worker']);
});

test('leaves out boxes the start never reaches', () => {
  const lines = [...bakery, 'reports --> db'];
  expect(talkOrder(lines, 'customer')).not.toContain('reports');
});

test('ignores blank lines and lines without an arrow', () => {
  const lines = ['flowchart LR', '', '  customer --> app  ', 'classDef slow fill:#eee'];
  expect(talkOrder(lines, 'customer')).toEqual(['customer', 'app']);
});

test('returns only the start when it has no arrows', () => {
  expect(talkOrder(bakery, 'worker')).toEqual(['worker']);
});

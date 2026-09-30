import { groupBy } from './solution';

interface Ticket {
  id: string;
  tier: 'day' | 'weekend';
  priceMinor: number;
}

const tickets: Ticket[] = [
  { id: 'T-1', tier: 'day', priceMinor: 4500 },
  { id: 'T-2', tier: 'weekend', priceMinor: 12000 },
  { id: 'T-3', tier: 'day', priceMinor: 4500 },
];

test('groups tickets by a string property', () => {
  const byTier = groupBy(tickets, 'tier');
  expect(byTier.size).toBe(2);
  expect(byTier.get('day')).toEqual([tickets[0], tickets[2]]);
  expect(byTier.get('weekend')).toEqual([tickets[1]]);
});

test('groups by a number property, with number keys', () => {
  const byPrice = groupBy(tickets, 'priceMinor');
  expect(byPrice.get(4500)).toHaveLength(2);
  expect(byPrice.get(12000)).toHaveLength(1);
});

test('keeps groups in first-seen order', () => {
  expect([...groupBy(tickets, 'tier').keys()]).toEqual(['day', 'weekend']);
});

test('works for any item type, such as a hold', () => {
  const holds = [
    { holdId: 'H-1', orderId: 'O-1' },
    { holdId: 'H-2', orderId: 'O-1' },
  ];
  expect(groupBy(holds, 'orderId').get('O-1')).toHaveLength(2);
});

test('an empty list gives an empty Map', () => {
  const none: Ticket[] = [];
  expect(groupBy(none, 'tier').size).toBe(0);
});

test('does not change the input', () => {
  const frozen = Object.freeze([...tickets]);
  groupBy(frozen, 'id');
  expect(frozen).toHaveLength(3);
});

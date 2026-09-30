import { replay, type StockEvent } from './solution';

const log: StockEvent[] = [
  { seq: 1, type: 'StockReceived', sku: 'kettle', qty: 10 },
  { seq: 2, type: 'StockShipped', sku: 'kettle', qty: 3 },
  { seq: 3, type: 'StockReceived', sku: 'toaster', qty: 5 },
  { seq: 4, type: 'StockShipped', sku: 'kettle', qty: 2 },
];

test('an empty log gives empty stock', () => {
  expect(replay([], 10)).toEqual({});
});

test('the whole log folds to the current stock', () => {
  expect(replay(log, 4)).toEqual({ kettle: 5, toaster: 5 });
});

test('stopping early shows the stock as it was then', () => {
  expect(replay(log, 2)).toEqual({ kettle: 7 });
});

test('a redelivered event with a seen seq is applied once', () => {
  const withRepeat: StockEvent[] = [
    ...log,
    { seq: 4, type: 'StockShipped', sku: 'kettle', qty: 2 },
  ];
  expect(replay(withRepeat, 4)).toEqual({ kettle: 5, toaster: 5 });
});

test('upToSeq of 0 applies nothing', () => {
  expect(replay(log, 0)).toEqual({});
});

test('the log itself is not changed', () => {
  replay(log, 4);
  expect(log).toHaveLength(4);
  expect(log.map((event) => event.qty).join()).toBe('10,3,5,2');
});

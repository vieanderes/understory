import { estimate } from './solution';

const chat = {
  dailyUsers: 10_000_000,
  actionsPerUser: 40,
  bytesPerAction: 200,
  retentionDays: 365,
  replicas: 3,
  peakFactor: 3,
};

test('a million actions a day is about 12 a second', () => {
  const result = estimate({ ...chat, dailyUsers: 1_000_000, actionsPerUser: 1, peakFactor: 1 });
  expect(result.averagePerSecond).toBe(12);
  expect(result.peakPerSecond).toBe(12);
});

test('the chat app averages 4,630 messages a second', () => {
  expect(estimate(chat).averagePerSecond).toBe(4630);
});

test('the peak multiplies the exact rate, then rounds up', () => {
  expect(estimate(chat).peakPerSecond).toBe(13_889);
});

test('storage counts every day kept and every copy', () => {
  expect(estimate(chat).storageBytes).toBe(87_600_000_000_000);
});

test('one replica stores a third as much', () => {
  expect(estimate({ ...chat, replicas: 1 }).storageBytes).toBe(29_200_000_000_000);
});

test('no users means no load and no storage', () => {
  expect(estimate({ ...chat, dailyUsers: 0 })).toEqual({
    averagePerSecond: 0,
    peakPerSecond: 0,
    storageBytes: 0,
  });
});

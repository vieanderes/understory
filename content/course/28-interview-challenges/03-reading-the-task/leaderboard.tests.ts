import { leaderboard } from './leaderboard.solution';

test('the example from the statement', () => {
  const results = [
    { name: 'ada', points: 30 },
    { name: 'bo', points: 50 },
    { name: 'ada', points: 40 },
  ];
  expect(leaderboard(results, 2)).toEqual(['ada(70)', 'bo(50)']);
});

test('a name that appears several times is summed', () => {
  const results = [
    { name: 'kim', points: 10 },
    { name: 'kim', points: 10 },
    { name: 'lee', points: 15 },
  ];
  expect(leaderboard(results, 1)).toEqual(['kim(20)']);
});

test('the format is name(total), with no spaces', () => {
  expect(leaderboard([{ name: 'sam', points: 7 }], 1)).toEqual(['sam(7)']);
});

test('a tie goes to the name that comes first', () => {
  const results = [
    { name: 'mo', points: 20 },
    { name: 'jo', points: 20 },
  ];
  expect(leaderboard(results, 2)).toEqual(['jo(20)', 'mo(20)']);
});

test('ties use string order, so capitals come first', () => {
  const results = [
    { name: 'amy', points: 5 },
    { name: 'Zoe', points: 5 },
  ];
  expect(leaderboard(results, 2)).toEqual(['Zoe(5)', 'amy(5)']);
});

test('a total of zero still counts', () => {
  expect(leaderboard([{ name: 'pat', points: 0 }], 3)).toEqual(['pat(0)']);
});

test('n larger than the number of players returns them all', () => {
  const results = [
    { name: 'ivy', points: 3 },
    { name: 'eli', points: 9 },
  ];
  expect(leaderboard(results, 10)).toEqual(['eli(9)', 'ivy(3)']);
});

test('n of zero returns an empty list', () => {
  expect(leaderboard([{ name: 'ivy', points: 3 }], 0)).toEqual([]);
});

test('no results returns an empty list', () => {
  expect(leaderboard([], 5)).toEqual([]);
});

test('large: 100,000 results for 1,000 players', () => {
  const results = [];
  for (let i = 0; i < 100000; i++) results.push({ name: `p${i % 1000}`, points: i % 7 });
  expect(leaderboard(results, 3)).toEqual(['p104(305)', 'p111(305)', 'p118(305)']);
});

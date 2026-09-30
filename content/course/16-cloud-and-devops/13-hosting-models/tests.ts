import { monthlyCost, type Plan } from './solution';

const vps: Plan = { kind: 'fixed', perServer: 10, millionsPerServer: 20, minServers: 2 };
const platform: Plan = { kind: 'usage', base: 20, includedMillions: 1, perMillion: 2 };

test('a quiet month still pays for the minimum servers', () => {
  expect(monthlyCost(vps, 0)).toBe(20);
});

test('servers are bought whole', () => {
  expect(monthlyCost(vps, 41)).toBe(30);
});

test('inside the allowance, a usage plan costs its base', () => {
  expect(monthlyCost(platform, 0.5)).toBe(20);
});

test('past the allowance, each extra million is charged', () => {
  expect(monthlyCost(platform, 11)).toBe(40);
});

test('the cheaper plan changes with traffic', () => {
  expect(monthlyCost(platform, 1) <= monthlyCost(vps, 1)).toBe(true);
  expect(monthlyCost(platform, 100) > monthlyCost(vps, 100)).toBe(true);
});

test('negative traffic throws', () => {
  expect(() => monthlyCost(vps, -1)).toThrow();
});

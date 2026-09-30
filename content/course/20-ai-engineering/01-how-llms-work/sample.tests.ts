import { sample, softmax } from './sample.solution';

// Logits whose softmax is exactly these probabilities, so the tests are easy to read.
const FOUR = [Math.log(0.5), Math.log(0.3), Math.log(0.15), Math.log(0.05)];
const ALL = { temperature: 1, topK: Infinity, topP: 1 };

test('softmax gives probabilities that add up to 1', () => {
  const probs = softmax([2, 1, 0]);
  expect(probs.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 10);
  expect(probs[0]).toBeGreaterThan(probs[1] ?? 1);
});

test('softmax survives huge scores', () => {
  expect(softmax([1000, 1000])).toEqual([0.5, 0.5]);
});

test('temperature 0 always picks the highest score', () => {
  expect(sample([0.2, 3, 1], { ...ALL, temperature: 0 }, () => 0.99)).toBe(1);
});

test('the draw follows the probabilities, and returns the token id', () => {
  expect(sample(FOUR, ALL, () => 0.1)).toBe(0);
  expect(sample(FOUR, ALL, () => 0.7)).toBe(1);
  expect(sample(FOUR, ALL, () => 0.99)).toBe(3);
});

test('top-k keeps only the k likeliest tokens', () => {
  expect(sample(FOUR, { ...ALL, topK: 2 }, () => 0.99)).toBe(1);
  expect(sample(FOUR, { ...ALL, topK: 1 }, () => 0.99)).toBe(0);
});

test('top-p keeps the fewest tokens that reach p, including the one that crosses it', () => {
  expect(sample(FOUR, { ...ALL, topP: 0.75 }, () => 0.99)).toBe(1);
  expect(sample(FOUR, { ...ALL, topP: 0.45 }, () => 0.99)).toBe(0);
});

test('a high temperature gives the long shot more chances', () => {
  expect(sample([2, 0], ALL, () => 0.8)).toBe(0);
  expect(sample([2, 0], { ...ALL, temperature: 10 }, () => 0.8)).toBe(1);
});

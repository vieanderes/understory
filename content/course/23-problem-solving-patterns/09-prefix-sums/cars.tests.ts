import { passingCars } from './cars.solution';

test('the example from the task', () => {
  expect(passingCars([0, 1, 0, 1, 1])).toBe(5);
});

test('a west car before every east car passes nobody', () => {
  expect(passingCars([1, 1, 0])).toBe(0);
});

test('all one direction gives no pairs', () => {
  expect(passingCars([0, 0, 0])).toBe(0);
  expect(passingCars([1])).toBe(0);
});

test('exactly 1,000,000,000 pairs is still returned', () => {
  const cars: number[] = [];
  for (let i = 0; i < 50000; i++) cars.push(0);
  for (let i = 0; i < 20000; i++) cars.push(1);
  expect(passingCars(cars)).toBe(1000000000);
});

test('more than 1,000,000,000 pairs gives -1', () => {
  const cars: number[] = [];
  for (let i = 0; i < 50000; i++) cars.push(0);
  for (let i = 0; i < 20001; i++) cars.push(1);
  expect(passingCars(cars)).toBe(-1);
});

test('performance: 100,000 alternating cars', () => {
  const cars: number[] = [];
  for (let i = 0; i < 100000; i++) cars.push(i % 2);
  expect(passingCars(cars)).toBe(-1);
  expect(passingCars(cars.slice(0, 60000))).toBe(450015000);
});

import { reconcile, type Pod } from './solution';

const running = (name: string): Pod => ({ name, phase: 'Running' });

test('nothing to do when reality matches', () => {
  expect(reconcile(3, [running('a'), running('b'), running('c')])).toEqual({ start: 0, remove: [] });
});

test('a lost pod is replaced', () => {
  expect(reconcile(3, [running('a'), running('b')])).toEqual({ start: 1, remove: [] });
});

test('scaling from zero starts every pod', () => {
  expect(reconcile(2, [])).toEqual({ start: 2, remove: [] });
});

test('extra pods are removed from the end of the list', () => {
  expect(reconcile(1, [running('a'), running('b'), running('c')])).toEqual({ start: 0, remove: ['b', 'c'] });
});

test('a pending pod counts towards the desired number', () => {
  expect(reconcile(2, [running('a'), { name: 'b', phase: 'Pending' }])).toEqual({ start: 0, remove: [] });
});

test('a failed pod is removed and replaced', () => {
  expect(reconcile(2, [running('a'), { name: 'b', phase: 'Failed' }])).toEqual({ start: 1, remove: ['b'] });
});

test('scaling to zero removes everything', () => {
  expect(reconcile(0, [running('a'), { name: 'b', phase: 'Failed' }])).toEqual({ start: 0, remove: ['b', 'a'] });
});

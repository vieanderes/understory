import { pickRoute, type State } from './solution';

const healthy: State = { permissions: 'ok', cached: false, retrieval: 'ok', primary: 'ok', fallback: 'ok' };

test('everything healthy uses the primary model', () => {
  expect(pickRoute(healthy)).toBe('primary');
});

test('a cached answer wins when all is healthy', () => {
  expect(pickRoute({ ...healthy, cached: true })).toBe('cached-answer');
});

test('primary down falls back to the smaller model', () => {
  expect(pickRoute({ ...healthy, primary: 'down' })).toBe('fallback-model');
});

test('both models down shows search results', () => {
  expect(pickRoute({ ...healthy, primary: 'down', fallback: 'down' })).toBe('search-results');
});

test('retrieval down sends people to the help desk', () => {
  expect(pickRoute({ ...healthy, retrieval: 'down' })).toBe('help-desk');
});

test('retrieval down still serves a cached answer', () => {
  expect(pickRoute({ ...healthy, retrieval: 'down', cached: true })).toBe('cached-answer');
});

test('permissions down refuses, even with a cached answer', () => {
  expect(pickRoute({ ...healthy, permissions: 'down', cached: true })).toBe('refuse');
});

test('permissions down refuses when everything else is fine', () => {
  expect(pickRoute({ ...healthy, permissions: 'down' })).toBe('refuse');
});

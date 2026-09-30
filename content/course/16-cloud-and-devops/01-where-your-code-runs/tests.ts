import { listenOptions } from './solution';

test('uses the port the platform sets', () => {
  expect(listenOptions({ PORT: '8080' })).toEqual({ hostname: '0.0.0.0', port: 8080 });
});

test('falls back to 3000 on your laptop', () => {
  expect(listenOptions({})).toEqual({ hostname: '0.0.0.0', port: 3000 });
});

test('always listens on every address', () => {
  expect(listenOptions({ PORT: '3000' }).hostname).toBe('0.0.0.0');
});

test('refuses a PORT that is not a number', () => {
  expect(() => listenOptions({ PORT: 'eighty' })).toThrow('PORT');
});

test('refuses an empty or out-of-range PORT', () => {
  expect(() => listenOptions({ PORT: '' })).toThrow('PORT');
  expect(() => listenOptions({ PORT: '70000' })).toThrow('PORT');
  expect(() => listenOptions({ PORT: '80.5' })).toThrow('PORT');
});

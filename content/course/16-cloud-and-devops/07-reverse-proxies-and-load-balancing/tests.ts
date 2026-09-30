import { clientIp } from './solution';

test('one proxy: the last entry is the visitor', () => {
  expect(clientIp('203.0.113.7', 1)).toBe('203.0.113.7');
});

test('an entry the client made up is ignored', () => {
  expect(clientIp('10.0.0.1, 203.0.113.7', 1)).toBe('203.0.113.7');
});

test('two proxies: the visitor is second from the end', () => {
  expect(clientIp('10.0.0.1, 203.0.113.7, 198.51.100.2', 2)).toBe('203.0.113.7');
});

test('spaces around an entry are trimmed', () => {
  expect(clientIp('203.0.113.7 ,  198.51.100.2 ', 2)).toBe('203.0.113.7');
});

test('a missing header gives null', () => {
  expect(clientIp(undefined, 1)).toBe(null);
});

test('fewer entries than proxies gives null', () => {
  expect(clientIp('198.51.100.2', 2)).toBe(null);
});

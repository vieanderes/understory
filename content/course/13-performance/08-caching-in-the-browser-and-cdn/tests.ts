import { cacheControlFor } from './solution';

test('a hashed asset is cached for a year and never checked', () => {
  expect(cacheControlFor('/assets/app.3f9a1c.js')).toBe('public, max-age=31536000, immutable');
});

test('an account page is kept out of shared caches', () => {
  expect(cacheControlFor('/account')).toBe('private, no-cache');
  expect(cacheControlFor('/account/orders')).toBe('private, no-cache');
});

test('any other page is checked before every reuse', () => {
  expect(cacheControlFor('/')).toBe('no-cache');
  expect(cacheControlFor('/prices')).toBe('no-cache');
});

test('a page whose name only contains "assets" is not an asset', () => {
  expect(cacheControlFor('/about-assets')).toBe('no-cache');
});

import { isAllowedUrl } from './solution';

const allowed = ['api.weather.com'];

test('an allow-listed host over https passes', () => {
  expect(isAllowedUrl('https://api.weather.com/forecast', allowed)).toBe(true);
});

test('the cloud metadata address is refused', () => {
  expect(isAllowedUrl('http://169.254.169.254/latest/meta-data/', allowed)).toBe(false);
});

test('a non-http scheme is refused', () => {
  expect(isAllowedUrl('file:///etc/passwd', allowed)).toBe(false);
});

test('credentials in the URL are refused', () => {
  expect(isAllowedUrl('https://user:pass@api.weather.com/', allowed)).toBe(false);
});

test('the host must match, not merely appear in the path', () => {
  expect(isAllowedUrl('https://evil.com/api.weather.com', allowed)).toBe(false);
});

test('a port on an allow-listed host is fine', () => {
  expect(isAllowedUrl('https://api.weather.com:8443/forecast', allowed)).toBe(true);
});

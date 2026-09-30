import { escapeHtml } from './solution';

test('a script tag becomes inert text', () => {
  expect(escapeHtml('<script>alert(1)</script>')).toBe('&lt;script&gt;alert(1)&lt;/script&gt;');
});

test('ampersand is escaped first, and once', () => {
  expect(escapeHtml('Tom & Jerry')).toBe('Tom &amp; Jerry');
});

test('an already-escaped entity is escaped again', () => {
  expect(escapeHtml('&lt;')).toBe('&amp;lt;');
});

test('both quote kinds are escaped for attribute safety', () => {
  expect(escapeHtml(`"it's"`)).toBe('&quot;it&#39;s&quot;');
});

test('ordinary text is unchanged', () => {
  expect(escapeHtml('Lemon cake, 3 left')).toBe('Lemon cake, 3 left');
});

test('an empty string stays empty', () => {
  expect(escapeHtml('')).toBe('');
});

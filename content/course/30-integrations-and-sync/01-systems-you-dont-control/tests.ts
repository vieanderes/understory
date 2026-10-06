import { parseParcelReply } from './solution';

const JSON_TYPE = 'application/json; charset=utf-8';

test('a good reply becomes a typed parcel, and extra fields are dropped', () => {
  const body = '{"id":"p-77","status":"delivered","delivered_at":"2026-10-03T09:12:00Z","driver":"x"}';
  expect(parseParcelReply(200, JSON_TYPE, body)).toEqual({
    ok: true,
    parcel: { id: 'p-77', status: 'delivered', deliveredAt: '2026-10-03T09:12:00Z' },
  });
});

test('a status the vendor added last week becomes unknown', () => {
  const body = '{"id":"p-78","status":"held_at_customs"}';
  expect(parseParcelReply(200, JSON_TYPE, body)).toEqual({
    ok: true,
    parcel: { id: 'p-78', status: 'unknown', deliveredAt: null },
  });
});

test('an HTML maintenance page sent with 200 is a retryable error', () => {
  const body = '<html><body>Down for maintenance</body></html>';
  expect(parseParcelReply(200, 'text/html', body)).toEqual({ ok: false, retryable: true, reason: 'not-json' });
});

test('a 200 with an error body is an error, retryable by its code', () => {
  const body = '{"error":{"code":"rate_limited","message":"Slow down"}}';
  expect(parseParcelReply(200, JSON_TYPE, body)).toEqual({
    ok: false,
    retryable: true,
    reason: 'vendor:rate_limited',
  });
});

test('a 500 that is really a validation error is not retried', () => {
  const body = '{"error":{"code":"invalid_postcode","message":"Postcode is invalid"}}';
  expect(parseParcelReply(500, JSON_TYPE, body)).toEqual({
    ok: false,
    retryable: false,
    reason: 'vendor:invalid_postcode',
  });
});

test('a reply without an id is a shape error, not a parcel', () => {
  expect(parseParcelReply(200, JSON_TYPE, '{"status":"in_transit"}')).toEqual({
    ok: false,
    retryable: false,
    reason: 'bad-shape',
  });
});

test('a 502 with a JSON body but no error object is an HTTP error', () => {
  expect(parseParcelReply(502, JSON_TYPE, '{}')).toEqual({ ok: false, retryable: true, reason: 'http-502' });
});

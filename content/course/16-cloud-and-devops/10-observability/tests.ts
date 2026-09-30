import { logLine } from './solution';

test('the request id and the event come first', () => {
  expect(logLine('req-7', 'summary.done', { status: 200, ms: 912 })).toBe(
    '{"requestId":"req-7","event":"summary.done","status":200,"ms":912}',
  );
});

test('an email is redacted, and its key stays', () => {
  expect(logLine('req-7', 'summary.done', { status: 200, email: 'ana@example.com' })).toBe(
    '{"requestId":"req-7","event":"summary.done","status":200,"email":"[redacted]"}',
  );
});

test('a prompt and a password are redacted too', () => {
  const line = logLine('req-8', 'login.failed', { prompt: 'Summarise my notes', password: 'hunter2' });
  expect(line).not.toContain('Summarise');
  expect(line).not.toContain('hunter2');
});

test('a field cannot overwrite the request id or the event', () => {
  expect(logLine('req-9', 'order.paid', { requestId: 'fake', event: 'other', total: 1250 })).toBe(
    '{"requestId":"req-9","event":"order.paid","total":1250}',
  );
});

test('no fields still gives a full record', () => {
  expect(logLine('req-10', 'health.checked', {})).toBe('{"requestId":"req-10","event":"health.checked"}');
});

test('every line parses back as JSON', () => {
  const record = JSON.parse(logLine('req-11', 'model.called', { tokens: 1350, ok: true }));
  expect(record.tokens).toBe(1350);
  expect(record.ok).toBe(true);
});

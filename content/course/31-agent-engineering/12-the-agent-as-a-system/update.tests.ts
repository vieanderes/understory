import { applyUpdate, type TicketRecord } from './update.solution';

const ticket: TicketRecord = {
  id: 't-88',
  version: 3,
  fields: { priority: 'urgent', draft: '' },
};

test('the owner writes on the current version, and the version goes up', () => {
  const result = applyUpdate(ticket, { agent: 'writer', baseVersion: 3, changes: { draft: 'Sorry about that' } });
  expect(result).toEqual({
    ok: true,
    record: { id: 't-88', version: 4, fields: { priority: 'urgent', draft: 'Sorry about that' } },
  });
});

test('a write based on an old version is refused as stale', () => {
  const result = applyUpdate(ticket, { agent: 'triage', baseVersion: 2, changes: { priority: 'normal' } });
  expect(result).toEqual({ ok: false, reason: 'stale' });
});

test('an agent cannot write a field another agent owns', () => {
  const result = applyUpdate(ticket, { agent: 'writer', baseVersion: 3, changes: { priority: 'normal' } });
  expect(result).toEqual({ ok: false, reason: 'not-owner', field: 'priority' });
});

test('a field nobody owns is refused too', () => {
  const result = applyUpdate(ticket, { agent: 'triage', baseVersion: 3, changes: { refundAmount: '500' } });
  expect(result).toEqual({ ok: false, reason: 'not-owner', field: 'refundAmount' });
});

test('the first field the agent does not own is the one reported', () => {
  const result = applyUpdate(ticket, { agent: 'triage', baseVersion: 3, changes: { priority: 'low', draft: 'Hi' } });
  expect(result).toEqual({ ok: false, reason: 'not-owner', field: 'draft' });
});

test('ownership is checked before the version', () => {
  const result = applyUpdate(ticket, { agent: 'research', baseVersion: 1, changes: { draft: 'Hi' } });
  expect(result).toEqual({ ok: false, reason: 'not-owner', field: 'draft' });
});

test('several owned fields land together, and the input is left alone', () => {
  const result = applyUpdate(ticket, {
    agent: 'triage',
    baseVersion: 3,
    changes: { priority: 'low', category: 'refund' },
  });
  expect(result.ok && result.record.fields).toEqual({ priority: 'low', draft: '', category: 'refund' });
  expect(ticket.version).toBe(3);
  expect(ticket.fields.priority).toBe('urgent');
});

export type TicketRecord = {
  id: string;
  version: number;
  fields: Record<string, string>;
};

export type Update = {
  agent: string;
  baseVersion: number;
  changes: Record<string, string>;
};

export type UpdateResult =
  | { ok: true; record: TicketRecord }
  | { ok: false; reason: 'not-owner'; field: string }
  | { ok: false; reason: 'stale' };

// Each field has exactly one agent that may write it.
export const OWNERS: Record<string, string> = {
  priority: 'triage',
  category: 'triage',
  orderId: 'research',
  refundable: 'research',
  draft: 'writer',
};

export function applyUpdate(record: TicketRecord, update: Update): UpdateResult {
  // Last write wins: whoever saves last erases everyone else.
  return {
    ok: true,
    record: { ...record, fields: { ...record.fields, ...update.changes } },
  };
}

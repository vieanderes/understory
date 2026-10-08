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
  // Ownership first: a write the agent may never make won't succeed on a retry either.
  for (const field of Object.keys(update.changes)) {
    if (OWNERS[field] !== update.agent) {
      return { ok: false, reason: 'not-owner', field };
    }
  }
  if (update.baseVersion !== record.version) {
    return { ok: false, reason: 'stale' };
  }
  return {
    ok: true,
    record: {
      ...record,
      version: record.version + 1,
      fields: { ...record.fields, ...update.changes },
    },
  };
}

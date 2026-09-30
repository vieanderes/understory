export interface Session {
  userId: string;
}

export interface Hire {
  userId: string;
  bikeId: string;
  hours: number;
}

export type Checked = { ok: true; hire: Hire } | { ok: false; error: string };

export function checkHire(session: Session | null, fields: Record<string, unknown>): Checked {
  if (!session) return { ok: false, error: 'Sign in first' };
  const bikeId = typeof fields.bikeId === 'string' ? fields.bikeId.trim() : '';
  if (bikeId === '') return { ok: false, error: 'Choose a bike' };
  const hours = typeof fields.hours === 'string' ? Number(fields.hours) : NaN;
  if (!Number.isInteger(hours) || hours < 1 || hours > 8) {
    return { ok: false, error: 'Choose 1 to 8 hours' };
  }
  return { ok: true, hire: { userId: session.userId, bikeId, hours } };
}

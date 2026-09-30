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
  // Replace this. It trusts the form for everything, even who is hiring.
  return {
    ok: true,
    hire: { userId: String(fields.userId), bikeId: String(fields.bikeId), hours: Number(fields.hours) },
  };
}

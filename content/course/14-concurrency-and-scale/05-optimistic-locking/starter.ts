export interface Ticket {
  title: string;
  labels: string[];
}

export interface Store {
  read(id: string): Promise<{ data: Ticket; version: number }>;
  // Saves only if the ticket is still at `version`. Returns false if someone saved first.
  saveIf(id: string, version: number, data: Ticket): Promise<boolean>;
}

export async function saveWithRetry(
  store: Store,
  id: string,
  change: (ticket: Ticket) => Ticket,
): Promise<Ticket> {
  // One try, and a refused save is ignored. Retry on a fresh read, up to 3 attempts.
  const { data, version } = await store.read(id);
  const changed = change(data);
  await store.saveIf(id, version, changed);
  return changed;
}

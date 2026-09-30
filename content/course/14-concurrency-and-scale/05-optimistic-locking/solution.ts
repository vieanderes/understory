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
  for (let attempt = 1; attempt <= 3; attempt++) {
    // Each attempt reads again, so the change applies to what's there now.
    const { data, version } = await store.read(id);
    const changed = change(data);
    if (await store.saveIf(id, version, changed)) return changed;
  }
  throw new Error(`Ticket ${id} kept changing: gave up after 3 attempts`);
}

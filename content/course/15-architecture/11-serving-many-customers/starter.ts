export type Appointment = { tenantId: number; patient: string; day: string };
export type TenantStore = { onDay(day: string): Appointment[] };

// Today every function gets every clinic's rows and filters by tenant by hand. One forgot.
export function dayView(all: Appointment[], tenantId: number, day: string): string[] {
  return all.filter((a) => a.tenantId === tenantId && a.day === day).map((a) => a.patient);
}

export function exportDay(all: Appointment[], tenantId: number, day: string): string {
  return all
    .filter((a) => a.day === day)
    .map((a) => `${a.patient},${a.day}`)
    .join('\n');
}

// A store that can only ever see one tenant's rows.
export function scopedTo(all: Appointment[], tenantId: number): TenantStore {
  throw new Error(`write the store for tenant ${tenantId} of ${all.length} rows`);
}

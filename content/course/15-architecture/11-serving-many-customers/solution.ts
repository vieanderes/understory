export type Appointment = { tenantId: number; patient: string; day: string };
export type TenantStore = { onDay(day: string): Appointment[] };

// The views never see other clinics' rows, so none of them can forget the filter.
export function dayView(store: TenantStore, day: string): string[] {
  return store.onDay(day).map((a) => a.patient);
}

export function exportDay(store: TenantStore, day: string): string {
  return store
    .onDay(day)
    .map((a) => `${a.patient},${a.day}`)
    .join('\n');
}

// The tenant filter, written once. Every read goes through it.
export function scopedTo(all: Appointment[], tenantId: number): TenantStore {
  return {
    onDay: (day) => all.filter((a) => a.tenantId === tenantId && a.day === day),
  };
}

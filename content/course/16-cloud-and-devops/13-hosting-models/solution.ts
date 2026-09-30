export type Plan =
  | { kind: 'fixed'; perServer: number; millionsPerServer: number; minServers: number }
  | { kind: 'usage'; base: number; includedMillions: number; perMillion: number };

// A fixed plan pays for whole servers, used or not. A usage plan pays for what runs.
export function monthlyCost(plan: Plan, requestsMillions: number): number {
  if (requestsMillions < 0) throw new Error('requests cannot be negative');
  if (plan.kind === 'fixed') {
    const needed = Math.ceil(requestsMillions / plan.millionsPerServer);
    return Math.max(plan.minServers, needed) * plan.perServer;
  }
  const billable = Math.max(0, requestsMillions - plan.includedMillions);
  return plan.base + billable * plan.perMillion;
}

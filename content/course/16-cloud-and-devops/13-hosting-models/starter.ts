export type Plan =
  | { kind: 'fixed'; perServer: number; millionsPerServer: number; minServers: number }
  | { kind: 'usage'; base: number; includedMillions: number; perMillion: number };

export function monthlyCost(plan: Plan, requestsMillions: number): number {
  // A fixed plan pays per whole server. A usage plan pays a base, plus requests over the allowance.
  return plan.kind === 'fixed' ? plan.perServer : requestsMillions;
}

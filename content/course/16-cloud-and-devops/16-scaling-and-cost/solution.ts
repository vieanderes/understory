export type Load = { peakRps: number; rpsPerInstance: number; headroomPercent: number };
export type Costs = { pencePerInstance: number; ordersPerMonth: number };
export type Plan = { instances: number; monthlyPence: number; pencePerOrder: number };

// Capacity to buy is peak demand plus headroom, divided by what one instance was measured to serve.
export function capacityPlan(load: Load, costs: Costs): Plan {
  if (load.rpsPerInstance <= 0) throw new Error('rpsPerInstance must be measured and above 0');
  const target = (load.peakRps * (100 + load.headroomPercent)) / 100;
  // Never fewer than two, or one failure takes the service down.
  const instances = Math.max(2, Math.ceil(target / load.rpsPerInstance));
  const monthlyPence = instances * costs.pencePerInstance;
  const pencePerOrder = costs.ordersPerMonth > 0 ? monthlyPence / costs.ordersPerMonth : 0;
  return { instances, monthlyPence, pencePerOrder };
}

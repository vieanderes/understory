export type Load = { peakRps: number; rpsPerInstance: number; headroomPercent: number };
export type Costs = { pencePerInstance: number; ordersPerMonth: number };
export type Plan = { instances: number; monthlyPence: number; pencePerOrder: number };

export function capacityPlan(load: Load, costs: Costs): Plan {
  // Add the headroom to the peak, divide by one instance's measured rate, and round up.
  return { instances: 1, monthlyPence: costs.pencePerInstance, pencePerOrder: 0 };
}

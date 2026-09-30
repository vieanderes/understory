export type ConnectionPlan = { needed: number; fits: boolean; maxInstances: number };

// Every instance holds its own pool, so connections multiply with instances.
export function connectionPlan(
  instances: number,
  poolSize: number,
  maxConnections: number,
  reserved: number,
): ConnectionPlan {
  if (poolSize < 1) throw new Error('poolSize must be at least 1');
  const available = Math.max(0, maxConnections - reserved);
  const needed = instances * poolSize;
  return {
    needed,
    fits: needed <= available,
    maxInstances: Math.floor(available / poolSize),
  };
}

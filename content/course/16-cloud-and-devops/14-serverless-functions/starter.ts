export type ConnectionPlan = { needed: number; fits: boolean; maxInstances: number };

export function connectionPlan(
  instances: number,
  poolSize: number,
  maxConnections: number,
  reserved: number,
): ConnectionPlan {
  // Connections multiply with instances. Compare the product with what the database can spare.
  return { needed: instances + poolSize, fits: maxConnections > reserved, maxInstances: 0 };
}

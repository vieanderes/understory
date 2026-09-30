export type Network = {
  edgeRttMs: number;
  originRttMs: number;
  edgeToDbRttMs: number;
  originToDbRttMs: number;
  queryMs: number;
};
export type Placement = { edgeMs: number; originMs: number; best: 'edge' | 'origin' | 'same' };

// One trip from the user to the code, then one trip to the database per query.
export function bestPlacement(network: Network, queries: number): Placement {
  const edgeMs = network.edgeRttMs + queries * (network.edgeToDbRttMs + network.queryMs);
  const originMs = network.originRttMs + queries * (network.originToDbRttMs + network.queryMs);
  let best: Placement['best'] = 'same';
  if (edgeMs < originMs) best = 'edge';
  if (originMs < edgeMs) best = 'origin';
  return { edgeMs, originMs, best };
}

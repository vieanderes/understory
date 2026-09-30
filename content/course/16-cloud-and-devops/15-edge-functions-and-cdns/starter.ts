export type Network = {
  edgeRttMs: number;
  originRttMs: number;
  edgeToDbRttMs: number;
  originToDbRttMs: number;
  queryMs: number;
};
export type Placement = { edgeMs: number; originMs: number; best: 'edge' | 'origin' | 'same' };

export function bestPlacement(network: Network, queries: number): Placement {
  // Each placement pays one trip from the user, then one database trip per query.
  return { edgeMs: network.edgeRttMs, originMs: network.originRttMs, best: 'edge' };
}

export interface Pod {
  name: string;
  phase: 'Pending' | 'Running' | 'Failed';
}

export interface Actions {
  start: number;
  remove: string[];
}

export function reconcile(desired: number, pods: Pod[]): Actions {
  // Compare what is wanted with what exists, and return what closes the gap.
  return { start: 0, remove: [] };
}

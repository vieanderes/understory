export interface Pod {
  name: string;
  phase: 'Pending' | 'Running' | 'Failed';
}

export interface Actions {
  start: number;
  remove: string[];
}

export function reconcile(desired: number, pods: Pod[]): Actions {
  const failed = pods.filter((pod) => pod.phase === 'Failed').map((pod) => pod.name);
  const live = pods.filter((pod) => pod.phase !== 'Failed');
  const extra = live.slice(desired).map((pod) => pod.name);
  return {
    start: Math.max(0, desired - live.length),
    remove: [...failed, ...extra],
  };
}

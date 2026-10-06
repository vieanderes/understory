export interface Transition {
  from: string;
  to: string;
  event: string;
}

export interface Machine {
  initial: string;
  terminal: string[];
  transitions: Transition[];
}

export function checkWorkflow(machine: Machine): string[] {
  const problems: string[] = [];
  const { initial, terminal, transitions } = machine;
  const states = [...new Set([initial, ...transitions.flatMap((t) => [t.from, t.to]), ...terminal])];
  // Everything reachable from the starts, following `next`.
  const walk = (starts: string[], next: (state: string) => string[]) => {
    const seen = new Set(starts);
    const queue = [...starts];
    for (const state of queue) {
      for (const n of next(state)) {
        if (!seen.has(n)) {
          seen.add(n);
          queue.push(n);
        }
      }
    }
    return seen;
  };
  const reachable = walk([initial], (s) => transitions.filter((t) => t.from === s).map((t) => t.to));
  // Walk backwards from the ends: these states can still finish.
  const canFinish = walk(terminal, (s) => transitions.filter((t) => t.to === s).map((t) => t.from));
  for (const state of states) {
    if (!reachable.has(state)) problems.push(`unreachable: ${state}`);
    if (!canFinish.has(state)) problems.push(`stuck: ${state}`);
  }
  return problems;
}

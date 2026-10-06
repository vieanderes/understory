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
  // Nothing is checked yet, so every workflow looks fine.
  return problems;
}

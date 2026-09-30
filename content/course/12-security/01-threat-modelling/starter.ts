export interface Flow {
  from: string;
  to: string;
  data: string;
}

export function boundaryCrossings(trust: Record<string, number>, flows: Flow[]): string[] {
  // Replace this. It treats every flow as safe, so nothing is ever checked.
  return [];
}

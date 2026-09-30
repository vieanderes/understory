export interface Flow {
  from: string;
  to: string;
  data: string;
}

export function boundaryCrossings(trust: Record<string, number>, flows: Flow[]): string[] {
  const crossings: string[] = [];
  for (const flow of flows) {
    const fromTrust = trust[flow.from];
    const toTrust = trust[flow.to];
    if (fromTrust === undefined || toTrust === undefined) continue;
    if (fromTrust < toTrust) crossings.push(`${flow.data} from ${flow.from} to ${flow.to}`);
  }
  return crossings;
}

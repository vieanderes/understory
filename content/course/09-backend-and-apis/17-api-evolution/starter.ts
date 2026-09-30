export interface Field {
  type: string;
  required: boolean;
}

export type Schema = Record<string, Field>;

export function breakingChanges(before: Schema, after: Schema): string[] {
  // Replace this. It reports every difference, so adding an optional field counts as breaking.
  const changes: string[] = [];
  for (const name of Object.keys(after)) {
    if (before[name] === undefined) changes.push(`added ${name}`);
  }
  return changes;
}

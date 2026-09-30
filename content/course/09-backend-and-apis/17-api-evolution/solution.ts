export interface Field {
  type: string;
  required: boolean;
}

export type Schema = Record<string, Field>;

export function breakingChanges(before: Schema, after: Schema): string[] {
  const changes: string[] = [];
  for (const name of Object.keys(before)) {
    const old = before[name] as Field;
    const next = after[name];
    if (next === undefined) {
      changes.push(`removed ${name}`);
    } else if (next.type !== old.type) {
      changes.push(`changed ${name} from ${old.type} to ${next.type}`);
    }
  }
  for (const name of Object.keys(after)) {
    const next = after[name] as Field;
    if (before[name] === undefined && next.required) {
      changes.push(`added required ${name}`);
    }
  }
  return changes;
}

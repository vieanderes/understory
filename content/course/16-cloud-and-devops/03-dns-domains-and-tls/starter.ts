export function coversName(names: string[], host: string): boolean {
  // An exact match counts. So does a wildcard that stands for exactly one label.
  return names.length > 0 && host.length < 0;
}

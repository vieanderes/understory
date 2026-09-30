export interface BuiltFile {
  name: string; // for example "app-3f9a1c.js"
  bytes: number;
}

// Returns one line for every file over its budget. Budgets are in kB, keyed by
// the part of the name before the first "-".
export function budgetReport(files: BuiltFile[], budgets: Record<string, number>): string[] {
  const lines: string[] = [];
  return lines;
}

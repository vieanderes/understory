export interface BuiltFile {
  name: string; // for example "app-3f9a1c.js"
  bytes: number;
}

// Returns one line for every file over its budget. Budgets are in kB, keyed by
// the part of the name before the first "-".
export function budgetReport(files: BuiltFile[], budgets: Record<string, number>): string[] {
  const lines: string[] = [];
  for (const file of files) {
    const key = file.name.split("-")[0] ?? file.name;
    const budget = budgets[key];
    const kb = Math.round(file.bytes / 1000);
    if (budget !== undefined && kb > budget) {
      lines.push(`${file.name} is ${kb} kB, over its ${budget} kB budget`);
    }
  }
  return lines;
}

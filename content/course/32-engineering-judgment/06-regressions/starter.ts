// Each key is a file. Its list names the files it imports.
export type ImportGraph = Record<string, string[]>;

export function testsToRun(imports: ImportGraph, changed: string[]): string[] {
  // Only runs a test file if the change touched it directly.
  return changed.filter((file) => file.endsWith('.test.ts')).sort();
}
